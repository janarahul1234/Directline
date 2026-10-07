"use client";

/**
 * useCall — the single seam between Stream Video and our custom UI.
 *
 * Previously this hook hand-wired our own SSE signaling to a raw
 * RTCPeerConnection. That whole P2P stack is gone: Stream's `@stream-io/
 * video-client` now owns signaling, the SFU media connection, device capture,
 * and simulcast. This file only:
 *
 *   1. connects an ephemeral user (via a token minted by /api/stream-token),
 *   2. creates/joins the call whose id is the room code,
 *   3. turns the camera / microphone on,
 *   4. maps Stream's reactive state onto the MediaStreams + status our
 *      components already consume.
 *
 * The returned shape (status, localStream, remoteStream, mic/cam toggles,
 * leave) is intentionally IDENTICAL to the old hook, so CallRoom / VideoStage /
 * ControlBar / VideoTile needed no changes.
 *
 * NOTE: audio and video arrive as two separate MediaStreams per participant.
 * Video is handed to the UI; remote audio is played through a hidden <audio>
 * element we manage here (the same thing Stream's <Audio> component does).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CallingState,
  type Call,
  type StreamVideoClient,
  type StreamVideoParticipant,
} from "@stream-io/video-client";

import { CALL_TYPE, createStreamClient } from "@/lib/stream/client";
import { generatePeerId } from "@/lib/room";

export type CallStatus =
  | "initializing" // connecting to Stream + capturing devices
  | "waiting" // in the call, no one else yet
  | "connecting" // joining / negotiating with the SFU
  | "connected" // media flowing through the SFU
  | "ended" // we left / the call closed
  | "error";

interface UseCallResult {
  status: CallStatus;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  camMuted: boolean;
  hasVideo: boolean;
  toggleMic: () => void;
  toggleCam: () => void;
  leave: () => void;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useCall(roomId: string): UseCallResult {
  const [status, setStatus] = useState<CallStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);

  // Imperative, non-rendering objects live in refs (never in state).
  const clientRef = useRef<StreamVideoClient | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    let disposed = false;
    let client: StreamVideoClient | null = null;
    let call: Call | null = null;

    // Hidden, self-managed audio elements for remote participants (1 per session).
    let audioHost: HTMLDivElement | null = null;
    const audioBySession = new Map<string, HTMLAudioElement>();

    const fail = (message: string) => {
      if (disposed) return;
      setError(message);
      setStatus("error");
    };

    /** Keep one <audio> element per remote participant that has an audio track. */
    const syncRemoteAudio = (participants: StreamVideoParticipant[]) => {
      if (typeof document === "undefined") return;
      if (!audioHost) {
        audioHost = document.createElement("div");
        audioHost.style.display = "none";
        document.body.appendChild(audioHost);
      }
      const live = new Set<string>();
      for (const p of participants) {
        if (!p.audioStream || !p.sessionId) continue;
        live.add(p.sessionId);
        let el = audioBySession.get(p.sessionId);
        if (!el) {
          el = document.createElement("audio");
          el.setAttribute("autoplay", "");
          el.autoplay = true;
          audioHost.appendChild(el);
          audioBySession.set(p.sessionId, el);
        }
        if (el.srcObject !== p.audioStream) el.srcObject = p.audioStream;
      }
      // Drop elements for participants who left.
      for (const [id, el] of audioBySession) {
        if (!live.has(id)) {
          el.srcObject = null;
          el.remove();
          audioBySession.delete(id);
        }
      }
    };

    /**
     * Resolve the visible remote tile: prefer a participant who is actually
     * sending video; otherwise fall back to any remote (audio-only peer stays
     * audible via the hidden <audio>, and the stage shows a placeholder).
     */
    const pickRemote = (
      participants: StreamVideoParticipant[],
    ): MediaStream | null =>
      participants.find((p) => p.videoStream)?.videoStream ?? null;

    async function setup() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        fail("WebRTC is not supported in this browser.");
        return;
      }

      setStatus("initializing");
      const userId = generatePeerId();

      // The constructor kicks off connectUser using our tokenProvider; the SDK
      // refreshes the token automatically. We surface hard failures via the
      // callingState/roster subscriptions below rather than awaiting connect.
      let client0: StreamVideoClient;
      try {
        client0 = createStreamClient(userId);
      } catch (e) {
        fail(messageFrom(e));
        return;
      }
      client = client0;
      clientRef.current = client;

      // Call id == the human-shareable room code.
      call = client!.call(CALL_TYPE, roomId);
      callRef.current = call;

      // React to local media (our own preview).
      const localSub = call.state.localParticipant$.subscribe((p) => {
        if (disposed) return;
        setLocalStream(p?.videoStream ?? null);
      });

      // React to the room roster: presence, remote video, remote audio, status.
      const remoteSub = call.state.remoteParticipants$.subscribe((participants) => {
        if (disposed) return;
        setRemoteStream(pickRemote(participants));
        syncRemoteAudio(participants);
        setStatus((s) => {
          if (s === "error" || s === "ended") return s;
          if (s === "initializing" || s === "connecting") return s;
          return participants.length > 0 ? "connected" : "waiting";
        });
      });

      // React to the overall calling state (join progress / hard failures).
      const stateSub = call.state.callingState$.subscribe((cs) => {
        if (disposed) return;
        if (cs === CallingState.RECONNECTING_FAILED) {
          fail("The connection to the call was lost.");
        } else if (cs === CallingState.LEFT) {
          setStatus("ended");
        } else if (cs === CallingState.JOINED) {
          // Joined but roster not settled yet; the roster subscription flips to
          // "connected"/"waiting". Here only leave the transient states.
          setStatus((s) => (s === "initializing" || s === "connecting" ? "waiting" : s));
        }
      });

      try {
        // Ensure the call exists, then join it (create:true is idempotent).
        await call.join({ create: true });

        // Capture devices. Camera is best-effort: a missing/denied camera
        // degrades to audio-only instead of killing the call.
        try {
          await call.camera.enable();
          setHasVideo(true);
        } catch {
          setHasVideo(false);
        }
        try {
          await call.microphone.enable();
        } catch {
          // No mic: continue video-only; the mute toggle stays harmless.
        }

        setStatus((s) => (s === "error" ? s : "connecting"));
      } catch (e) {
        fail(messageFrom(e));
      }

      return () => {
        localSub.unsubscribe();
        remoteSub.unsubscribe();
        stateSub.unsubscribe();
      };
    }

    let detach: (() => void) | undefined;
    void setup().then((cleanup) => {
      detach = cleanup;
      if (disposed && cleanup) cleanup();
    });

    return () => {
      disposed = true;
      detach?.();

      // Tear down any hidden audio elements.
      for (const el of audioBySession.values()) {
        el.srcObject = null;
        el.remove();
      }
      audioBySession.clear();
      audioHost?.remove();

      void call?.leave();
      void client?.disconnectUser();
      callRef.current = null;
      clientRef.current = null;
    };
    // roomId is stable for the lifetime of the page; we deliberately run this
    // once per room. Mute intent is applied directly through the call managers.
  }, [roomId]);

  const toggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      const call = callRef.current;
      if (call) {
        if (next) void call.microphone.disable();
        else void call.microphone.enable();
      }
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamMuted((prev) => {
      const next = !prev;
      const call = callRef.current;
      if (call) {
        if (next) void call.camera.disable();
        else void call.camera.enable();
      }
      return next;
    });
  }, []);

  const leave = useCallback(() => {
    const call = callRef.current;
    const client = clientRef.current;
    callRef.current = null;
    clientRef.current = null;
    if (call) void call.leave();
    if (client) void client.disconnectUser();
    setLocalStream(null);
    setRemoteStream(null);
    setStatus("ended");
  }, []);

  return {
    status,
    error,
    localStream,
    remoteStream,
    micMuted,
    camMuted,
    hasVideo,
    toggleMic,
    toggleCam,
    leave,
  };
}

"use client";

/**
 * useCall — the single place where the SIGNALING layer and the WEBRTC layer are
 * wired together. Keeping this glue in one hook is what lets the two layers stay
 * independent and easy to reason about:
 *
 *   signaling/  = "how do I move a JSON message to the other browser?"
 *   webrtc/     = "how do I negotiate and stream media once I have a peer?"
 *   useCall()   = "when a message says X, tell the peer to do Y" (this file).
 *
 * It owns the whole call: ask for devices, open the signaling channel, pick who
 * initiates, create the RTCPeerConnection, expose streams + mute controls.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acquireMedia,
} from "@/lib/webrtc/config";
import { Peer, type ConnectionState } from "@/lib/webrtc/peerConnection";
import { openSignalingChannel } from "@/lib/signaling/client";
import type { SignalingChannel } from "@/lib/signaling/client";
import type { SignalingMessage } from "@/lib/signaling/messages";
import { generatePeerId, shouldInitiateCall } from "@/lib/room";

export type CallStatus =
  | "initializing" // asking for camera/mic
  | "waiting" // in the room, no peer yet
  | "connecting" // negotiating with a peer
  | "connected" // media flowing peer-to-peer
  | "ended" // we hung up / peer left
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

function setTracksEnabled(
  stream: MediaStream | null,
  kind: "audio" | "video",
  enabled: boolean
): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    if (track.kind === kind) track.enabled = enabled;
  }
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
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<SignalingChannel | null>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    // Guard against effects firing after we have torn down (e.g. StrictMode).
    let disposed = false;
    let manuallyClosed = false;
    let started = false; // did we already send the initial offer?
    let peer: Peer | null = null;
    let remotePeerId: string | null = null;

    const myId = generatePeerId();
    peerRef.current = null;

    const fail = (message: string) => {
      if (disposed) return;
      setError(message);
      setStatus("error");
    };

    /** Map the RTCPeerConnection state onto our UI status. */
    const onConnectionState = (state: ConnectionState) => {
      if (disposed) return;
      if (state === "connected") {
        setError(null);
        setStatus("connected");
      } else if (state === "failed") {
        setStatus("error");
        setError(
          "Could not establish a direct connection. Both peers need a reachable " +
            "network path (this demo uses no media relay / TURN server)."
        );
      } else if (state === "disconnected") {
        setStatus("connecting");
      } else if (state === "closed") {
        setStatus("ended");
      }
    };

    /** Create (once) the media Peer for the single remote participant. */
    const ensurePeer = (otherId: string): Peer => {
      if (peer) return peer;
      const stream = localStreamRef.current;
      if (!stream) throw new Error("No local media available yet.");

      remotePeerId = otherId;
      peer = new Peer(stream, {
        localOffer: (sdp) =>
          channelRef.current?.send({ to: otherId, type: "offer", sdp }),
        localAnswer: (sdp) =>
          channelRef.current?.send({ to: otherId, type: "answer", sdp }),
        localCandidate: (candidate) =>
          channelRef.current?.send({ to: otherId, type: "ice", candidate }),
        remoteStream: (remote) => !disposed && setRemoteStream(remote),
        connectionState: onConnectionState,
      });
      peerRef.current = peer;
      return peer;
    };

    /** If I'm the initiator for this peer, start negotiating. */
    const maybeInitiate = (otherId: string) => {
      setStatus("connecting");
      const created = ensurePeer(otherId);
      // Only the peer with the alphabetically-later id sends the offer.
      if (!started && shouldInitiateCall(myId, otherId)) {
        started = true;
        created.start().catch((e) => fail(String(e)));
      }
    };

    const handleSignal = (msg: Extract<SignalingMessage, { from: string }>) => {
      // Any inbound negotiation implies a peer; make sure our Peer exists.
      const created = ensurePeer(msg.from);
      setStatus((s) => (s === "connected" ? s : "connecting"));
      if (msg.type === "offer") {
        created.handleOffer(msg.sdp).catch((e) => fail(String(e)));
      } else if (msg.type === "answer") {
        created.handleAnswer(msg.sdp).catch((e) => fail(String(e)));
      } else if (msg.type === "ice") {
        created.handleIce(msg.candidate).catch(() => {});
      }
    };

    const onMessage = (msg: SignalingMessage) => {
      if (disposed) return;
      switch (msg.type) {
        case "room-info":
          // Peers already in the room when we arrived.
          if (msg.occupants.length > 0) {
            maybeInitiate(msg.occupants[0]);
          } else {
            setStatus("waiting");
          }
          break;
        case "peer-joined":
          maybeInitiate(msg.peerId);
          break;
        case "peer-left":
          if (msg.peerId === remotePeerId) {
            peer?.close();
            peer = null;
            peerRef.current = null;
            remotePeerId = null;
            started = false;
            setRemoteStream(null);
            setStatus("waiting");
          }
          break;
        case "room-full":
          fail("This call already has two participants.");
          break;
        case "offer":
        case "answer":
        case "ice":
          handleSignal(msg);
          break;
      }
    };

    const setup = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        fail("WebRTC is not supported in this browser.");
        return;
      }
      setStatus("initializing");
      try {
        const { stream, hasVideo: video } = await acquireMedia();
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasVideo(video);
        // Respect any mute the user toggled before a peer existed.
        setTracksEnabled(stream, "audio", !micMuted);
        setTracksEnabled(stream, "video", !camMuted);

        // Only open signaling after media is ready, so we can offer immediately.
        channelRef.current = openSignalingChannel({
          roomId,
          peerId: myId,
          onMessage,
          onError: (e) => !manuallyClosed && fail(e.message),
        });
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
      }
    };

    const teardown = () => {
      disposed = true;
      manuallyClosed = true;
      channelRef.current?.close();
      channelRef.current = null;
      peer?.close();
      peer = null;
      peerRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };

    void setup();
    return teardown;
    // roomId is stable for the lifetime of the page; mic/cam intent is applied
    // to tracks directly, so we deliberately run this effect once per room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const toggleMic = useCallback(() => {
    setMicMuted((prev) => {
      const next = !prev;
      setTracksEnabled(localStreamRef.current, "audio", !next);
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamMuted((prev) => {
      const next = !prev;
      setTracksEnabled(localStreamRef.current, "video", !next);
      return next;
    });
  }, []);

  const leave = useCallback(() => {
    // Closing the signaling stream makes the relay notify the other peer.
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
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

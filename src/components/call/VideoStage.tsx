"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { VideoTile } from "./VideoTile";
import { cn } from "@/lib/utils";
import { Radio, Users, VideoOff } from "lucide-react";

interface VideoStageProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Local camera muted by the user (shows "You: camera off"). */
  localCamOff: boolean;
  /** Local device has no camera at all (audio-only). */
  hasVideo: boolean;
  /** Remote peer still hasn't joined. */
  waiting: boolean;
}

/**
 * The main call surface. The remote (the person you are talking to) owns the
 * whole frame; your own camera sits in a small picture-in-picture tile.
 */
export function VideoStage({
  localStream,
  remoteStream,
  localCamOff,
  hasVideo,
  waiting,
}: VideoStageProps) {
  // WebRTC exposes the peer's video track with a live, mutable `muted` flag: it
  // is true while a track isn't flowing (right at connect, or when the peer turns
  // their camera off) and fires "mute"/"unmute" as it changes. We model that as
  // an external store so React re-reads it whenever it changes. This is both
  // correct under the React Compiler (a value derived inline during render gets
  // memoized and would go stale) and lint-clean (no setState inside an effect).
  const tracks = useMemo(
    () => remoteStream?.getVideoTracks() ?? [],
    [remoteStream]
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      for (const track of tracks) {
        track.addEventListener("mute", onChange);
        track.addEventListener("unmute", onChange);
      }
      return () => {
        for (const track of tracks) {
          track.removeEventListener("mute", onChange);
          track.removeEventListener("unmute", onChange);
        }
      };
    },
    [tracks]
  );

  // "Camera off" = there is a video track and every one is currently
  // muted/disabled. Returns a boolean primitive, so React compares by value.
  const getSnapshot = useCallback(
    () => tracks.length > 0 && tracks.every((t) => t.muted || !t.enabled),
    [tracks]
  );

  // Third arg = server snapshot (this screen is SSR'd before any media exists).
  const remoteCamOff = useSyncExternalStore(subscribe, getSnapshot, () => false);

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl bg-black">
      {/* Remote video = the whole stage. */}
      <VideoTile
        stream={remoteStream}
        off={remoteCamOff}
        className="absolute inset-0"
        placeholder={
          waiting ? (
            <StagePlaceholder
              icon={<Users className="size-6" />}
              title="No one here yet"
              body="Share the room code. Your call connects the moment a second person joins."
            />
          ) : remoteCamOff ? (
            <StagePlaceholder
              icon={<VideoOff className="size-6" />}
              title="Their camera is off"
              body="You're still connected — audio is live."
            />
          ) : (
            <StagePlaceholder
              icon={<Radio className="size-6" />}
              title="Connecting…"
              body="Establishing the media connection."
            />
          )
        }
        label={waiting ? undefined : <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
          Peer
        </span>}
      />

      {/* Local preview = picture-in-picture. */}
      <VideoTile
        stream={localStream}
        muted
        mirrored
        off={localCamOff || !hasVideo}
        className={cn(
          "absolute right-3 bottom-3 aspect-video w-32 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/15 sm:w-44",
          "transition-transform duration-300 hover:scale-[1.03]"
        )}
        placeholder={
          <div className="flex flex-col items-center gap-1 text-[11px] text-zinc-400">
            <VideoOff className="size-4" />
            {!hasVideo ? "No camera" : localCamOff ? "Camera off" : ""}
          </div>
        }
        label={<span>You</span>}
      />
    </div>
  );
}

function StagePlaceholder({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-white/5 text-zinc-300 ring-1 ring-white/10">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-200">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

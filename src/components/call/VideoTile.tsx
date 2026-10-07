"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface VideoTileProps {
  /** The stream to display (local or remote). */
  stream: MediaStream | null;
  /** Local tiles must be muted to avoid an audio feedback loop. */
  muted?: boolean;
  /** Mirror the local preview so it feels like a mirror (not to others). */
  mirrored?: boolean;
  /** Show a "camera off" layer (e.g. after toggling the cam, or peer muted). */
  off?: boolean;
  /** Small caption pinned to the tile (e.g. "You"). */
  label?: ReactNode;
  /** Shown across the tile when there is no video yet. */
  placeholder?: ReactNode;
  className?: string;
}

/**
 * A thin, self-contained wrapper around a <video> element that knows how to bind
 * a live MediaStream via `srcObject`. Keeping the ref/effect here means the rest
 * of the UI can stay declarative.
 */
export function VideoTile({
  stream,
  muted = false,
  mirrored = false,
  off = false,
  label,
  placeholder,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) {
      // Autoplay can reject if sound is not yet unlocked; video has muted tracks
      // so it usually plays. Swallow the rejection to avoid noisy console errors.
      void el.play().catch(() => {});
    }
  }, [stream]);

  const hasVideo = stream !== null && !off;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-zinc-950 ring-1 ring-white/10",
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn(
          "size-full object-cover transition-opacity duration-300",
          mirrored && "-scale-x-100",
          hasVideo ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Camera-off / no-video-yet state. */}
      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center text-zinc-500">
          {placeholder}
        </div>
      )}

      {label && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
          {label}
        </div>
      )}
    </div>
  );
}

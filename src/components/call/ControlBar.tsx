"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

interface ControlBarProps {
  micMuted: boolean;
  camMuted: boolean;
  /** Disable the camera button when there is no camera (audio-only device). */
  hasVideo: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onHangup: () => void;
}

/**
 * The floating control cluster at the bottom of a call. Every button is labelled
 * (title + aria) so the icon-only controls stay usable and keyboard accessible.
 */
export function ControlBar({
  micMuted,
  camMuted,
  hasVideo,
  onToggleMic,
  onToggleCam,
  onHangup,
}: ControlBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 p-2 shadow-2xl backdrop-blur-md">
      <ControlButton
        active={micMuted}
        onClick={onToggleMic}
        label={micMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {micMuted ? <MicOff /> : <Mic />}
      </ControlButton>

      <ControlButton
        active={camMuted || !hasVideo}
        disabled={!hasVideo}
        onClick={onToggleCam}
        label={camMuted ? "Turn camera on" : "Turn camera off"}
      >
        {camMuted ? <VideoOff /> : <Video />}
      </ControlButton>

      <Button
        size="icon-lg"
        onClick={onHangup}
        aria-label="Leave call"
        title="Leave call"
        className="ml-1 size-11 rounded-full bg-red-600 text-white hover:bg-red-500 active:translate-y-0"
      >
        <PhoneOff className="size-5" />
      </Button>
    </div>
  );
}

function ControlButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="icon-lg"
      variant={active ? "destructive" : "ghost"}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "size-11 rounded-full text-white",
        active
          ? "bg-white/15 text-red-300 hover:bg-white/20"
          : "hover:bg-white/10"
      )}
    >
      {children}
    </Button>
  );
}

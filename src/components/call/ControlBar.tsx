"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface ControlBarProps {
  micMuted: boolean;
  camMuted: boolean;
  /** Disable the camera button when there is no camera (audio-only device). */
  hasVideo: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
}

/**
 * The call control bubble (mic + camera). The destructive hang-up control is
 * deliberately NOT here — the call screen renders it as its own separate
 * button so it can never be tapped by accident while reaching for a toggle.
 */
export function ControlBar({
  micMuted,
  camMuted,
  hasVideo,
  onToggleMic,
  onToggleCam,
}: ControlBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border p-1">
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
        active
          ? "bg-white/15 text-red-300 hover:bg-white/20"
          : "hover:bg-white/10",
      )}
    >
      {children}
    </Button>
  );
}

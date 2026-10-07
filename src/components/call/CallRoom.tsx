"use client";

import { useRouter } from "next/navigation";

import { ConnectionBadge } from "./ConnectionBadge";
import { ControlBar } from "./ControlBar";
import { RoomCodeChip } from "./RoomCodeChip";
import { VideoStage } from "./VideoStage";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useCall } from "@/hooks/useCall";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";

/**
 * The whole call experience for one room. It owns nothing beyond composing the
 * `useCall` hook's state into a screen — all the WebRTC + signaling work lives
 * behind that hook.
 */
export function CallRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const call = useCall(roomId);

  const hangup = () => {
    call.leave();
    router.push("/");
  };

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      {/* Top bar: identity, room code, lifecycle status. */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-white/90">
          <Logo className="size-6 text-emerald-400" />
          <span className="font-heading text-sm font-semibold tracking-tight">
            Directline
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RoomCodeChip code={roomId} />
          <ConnectionBadge status={call.status} className="hidden sm:inline-flex" />
        </div>
      </header>

      {/* Stage. */}
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
        {call.status === "error" ? (
          <ErrorPanel message={call.error} onLeave={hangup} />
        ) : (
          <VideoStage
            localStream={call.localStream}
            remoteStream={call.remoteStream}
            localCamOff={call.camMuted}
            hasVideo={call.hasVideo}
            waiting={call.status === "waiting" || call.status === "initializing"}
          />
        )}

        {/* Mobile status row (the header hides it on small screens). */}
        <div className="mt-2 sm:hidden">
          <ConnectionBadge status={call.status} />
        </div>

        {/* Controls float over the stage. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center sm:bottom-7">
          <div className="pointer-events-auto">
            <ControlBar
              micMuted={call.micMuted}
              camMuted={call.camMuted}
              hasVideo={call.hasVideo}
              onToggleMic={call.toggleMic}
              onToggleCam={call.toggleCam}
              onHangup={hangup}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ErrorPanel({
  message,
  onLeave,
}: {
  message: string | null;
  onLeave: () => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-zinc-950 ring-1 ring-white/10">
      <div className="flex max-w-sm flex-col items-center gap-4 px-8 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-red-500/15 text-red-300 ring-1 ring-red-500/30">
          <TriangleAlert className="size-6" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-white">
            We couldn&apos;t connect
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            {message ??
              "Something went wrong while setting up the direct connection."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button variant="ghost" onClick={onLeave} className="text-zinc-300">
            <ArrowLeft />
            Back home
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <ShieldCheck className="size-3.5" />
          Media is never routed through our servers, so some strict networks block
          a direct connection.
        </p>
      </div>
    </div>
  );
}

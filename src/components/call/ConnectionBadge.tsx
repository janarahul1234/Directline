import { cn } from "@/lib/utils";
import type { CallStatus } from "@/hooks/useCall";

/**
 * A single glanceable indicator of where the call is in its lifecycle.
 * Color is semantic, not decorative: teal = a live direct link, amber = still
 * negotiating, neutral = waiting, red = a problem.
 */
const CONFIG: Record<
  CallStatus,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  initializing: {
    label: "Starting camera & mic",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
  },
  waiting: {
    label: "Waiting for someone to join",
    dot: "bg-zinc-400",
    text: "text-zinc-300",
    pulse: true,
  },
  connecting: {
    label: "Negotiating direct link",
    dot: "bg-amber-400",
    text: "text-amber-200",
    pulse: true,
  },
  connected: {
    label: "Connected — peer-to-peer",
    dot: "bg-emerald-400",
    text: "text-emerald-200",
  },
  ended: { label: "Call ended", dot: "bg-zinc-500", text: "text-zinc-300" },
  error: { label: "Connection problem", dot: "bg-red-500", text: "text-red-200" },
};

export function ConnectionBadge({
  status,
  className,
}: {
  status: CallStatus;
  className?: string;
}) {
  const { label, dot, text, pulse } = CONFIG[status];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium",
        text,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none",
              dot
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            dot,
            "bg-opacity-90"
          )}
        />
      </span>
      {label}
    </div>
  );
}

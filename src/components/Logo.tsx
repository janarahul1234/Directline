import { cn } from "@/lib/utils";

/**
 * Directline's mark: two endpoints joined by a single direct line — a literal
 * picture of peer-to-peer (the media goes straight between the two, no hub).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      <path
        d="M8 14h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="7" cy="14" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="21" cy="14" r="3.25" fill="currentColor" />
    </svg>
  );
}

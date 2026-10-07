"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Copy, Share2 } from "lucide-react";

/**
 * The room code is the hero artifact of this product: it is the *only* thing two
 * people need to share to start a direct call. We show it in a monospace font
 * (like a shareable secret) with one-tap copy and share.
 */
export function RoomCodeChip({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const flash = (kind: "code" | "link") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    flash("code");
  };

  const shareLink = async () => {
    const link = window.location.href;
    // Web Share API is not in every browser (and its type is not in every DOM
    // lib), so feature-detect through a narrowly-typed view of `navigator`.
    const shareable = navigator as Navigator & {
      share?: (data: { title?: string; url?: string }) => Promise<void>;
    };
    if (shareable.share) {
      try {
        await shareable.share({ title: "Directline call", url: link });
        return;
      } catch {
        // User dismissed the share sheet — fall back to copying.
      }
    }
    await navigator.clipboard.writeText(link);
    flash("link");
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 py-1 pr-1 pl-3 text-white/90",
        className
      )}
    >
      <span className="font-mono text-sm tracking-[0.15em] tabular-nums">
        {code}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={copyCode}
        aria-label="Copy room code"
        title="Copy room code"
        className="text-white/70 hover:bg-white/10 hover:text-white"
      >
        {copied === "code" ? <Check /> : <Copy />}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={shareLink}
        aria-label="Copy invite link"
        title="Copy invite link"
        className="text-white/70 hover:bg-white/10 hover:text-white"
      >
        {copied === "link" ? <Check /> : <Share2 />}
      </Button>
    </div>
  );
}

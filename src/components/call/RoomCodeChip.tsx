"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RoomCodeChip({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border py-1 pr-1 pl-3",
        className,
      )}
    >
      <span className="text-sm tabular-nums">{code}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={copyCode}
        aria-label="Copy room code"
        title="Copy room code"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

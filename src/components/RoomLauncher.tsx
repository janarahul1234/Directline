"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRoomId, isValidRoomCode, normalizeRoomCode } from "@/lib/room";
import { ArrowRight, Phone } from "lucide-react";

export function RoomLauncher() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () => router.push(`/${generateRoomId()}`);

  // Live validity of the typed code: drives the embedded Join button and the
  // Enter-to-join shortcut below.
  const canJoin = isValidRoomCode(normalizeRoomCode(code));

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setError(
        "That doesn't look like a room code yet — ask your friend for theirs, like abc-12345-xyz.",
      );
      return;
    }
    setError(null);
    router.push(`/${normalized}`);
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <Button
        size="lg"
        onClick={create}
        className="h-12 justify-between gap-2 px-4 text-base"
      >
        <span className="flex items-center gap-2">
          <Phone />
          Start a direct call
        </span>
        <ArrowRight className="opacity-70" />
      </Button>

      <form onSubmit={join} className="flex flex-col gap-2">
        <div className="relative">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !canJoin) e.preventDefault();
            }}
            placeholder="abc-12345-xyz"
            spellCheck={false}
            autoComplete="off"
            aria-label="Room code"
            aria-invalid={error ? true : undefined}
            className="h-12 pr-24 pl-4"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!canJoin}
            className="absolute right-1.5 top-1/2 h-9 w-18 -translate-y-1/2"
          >
            Join
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

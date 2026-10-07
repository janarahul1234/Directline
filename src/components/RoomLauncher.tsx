"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRoomId, isValidRoomCode, normalizeRoomCode } from "@/lib/room";
import { ArrowRight, Phone } from "lucide-react";

/**
 * The entry point of the product, and deliberately the hero of the landing page:
 * create a room (one tap) or join one with a code. The generated code *is* the
 * whole protocol — two people who share it get a direct line.
 */
export function RoomLauncher() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = () => router.push(`/${generateRoomId()}`);

  const join = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setError("Enter a valid room code, like abc-12345-xyz.");
      return;
    }
    setError(null);
    router.push(`/${normalized}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <Button
        size="lg"
        onClick={create}
        className="h-12 justify-between gap-2 rounded-xl px-5 text-base"
      >
        <span className="flex items-center gap-2">
          <Phone />
          Start a direct call
        </span>
        <ArrowRight className="opacity-70" />
      </Button>

      <form onSubmit={join} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="abc-12345-xyz"
            spellCheck={false}
            autoComplete="off"
            aria-label="Room code"
            aria-invalid={error ? true : undefined}
            className="h-12 rounded-xl font-mono tracking-[0.12em] uppercase placeholder:normal-case placeholder:tracking-normal placeholder:font-mono"
          />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="h-12 shrink-0 rounded-xl px-5"
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

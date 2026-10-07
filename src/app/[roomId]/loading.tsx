import { Logo } from "@/components/Logo";

/**
 * Suspense fallback for `/[roomId]`. The call screen has no server data to fetch
 * (everything is client-side WebRTC), so this is just a tasteful momentary shell
 * while the client component mounts and requests camera/mic access.
 */
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header className="flex items-center gap-2 px-4 py-3 sm:px-6">
        <Logo className="size-6 text-emerald-400" />
        <span className="font-heading text-sm font-semibold tracking-tight">
          Directline
        </span>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="grid min-h-0 flex-1 place-items-center rounded-2xl bg-zinc-950 ring-1 ring-white/10">
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-emerald-400 motion-reduce:animate-none" />
            <span className="text-sm">Opening camera &amp; microphone…</span>
          </div>
        </div>
      </main>
    </div>
  );
}

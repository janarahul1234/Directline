import { Logo } from "@/components/Logo";
import { RoomLauncher } from "@/components/RoomLauncher";

export default function Home() {
  return (
    <div className="relative flex flex-1 overflow-hidden">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-7 px-5 py-16 text-center sm:gap-8 sm:px-6 sm:py-20">
        <div className="flex items-center gap-2.5">
          <Logo className="text-primary" />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Directline
          </span>
        </div>
        <div className="flex flex-col items-center gap-4">
          <h1 className="max-w-[16ch] font-heading text-3xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Direct calls between two people.
          </h1>
          <p className="max-w-[42ch] text-base leading-relaxed text-muted-foreground text-pretty">
            Press the button, share the code you get, and talk. No app, no
            sign-up — it runs right in the browser.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-4 sm:max-w-lg">
          <RoomLauncher />
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Free to use</span>
          <span aria-hidden>·</span>
          <span>No app or account needed</span>
          <span aria-hidden>·</span>
          <span>Private between the two of you</span>
        </p>
      </main>
    </div>
  );
}

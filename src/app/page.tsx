import { HowItWorks } from "@/components/HowItWorks";
import { Logo } from "@/components/Logo";
import { RoomLauncher } from "@/components/RoomLauncher";

export default function Home() {
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* One deliberate accent: a soft signal glow, nothing more. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 size-[26rem] rounded-full bg-primary/20 blur-[120px]"
      />

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        {/* Hero = the product's real first action: start or join a call. */}
        <section className="flex flex-col justify-center gap-7">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8 text-primary" />
            <span className="font-heading text-lg font-semibold tracking-tight">
              Directline
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <h1 className="max-w-[16ch] font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              Direct calls between two people.
            </h1>
            <p className="max-w-[46ch] text-base leading-relaxed text-muted-foreground">
              Peer-to-peer audio &amp; video over WebRTC. Your conversation goes
              straight between the two browsers — our servers only help you find
              each other, then step out of the way.
            </p>
          </div>

          <RoomLauncher />

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">no TURN relay</span>
            <span aria-hidden>·</span>
            <span>one room, one call, two endpoints</span>
          </p>
        </section>

        {/* The lifecycle, next to the action it explains. */}
        <section className="flex flex-col gap-4">
          <ConnectionDiagram />
          <div className="rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
            <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight text-card-foreground">
              How a connection is made
            </h2>
            <HowItWorks />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * The memorable element: a tiny literal diagram of the architecture — two
 * endpoints joined by a direct media line, with the relay off to the side only
 * handing over a few text notes. Motion is a single restrained loop and is
 * disabled for users who prefer reduced motion.
 */
function ConnectionDiagram() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <svg
        viewBox="0 0 320 120"
        className="h-auto w-full"
        role="img"
        aria-label="Two devices connected directly for media, with a small signaling relay that only exchanges text"
      >
        {/* direct media line */}
        <line
          x1="66"
          y1="44"
          x2="254"
          y2="44"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary/40"
        />
        {/* animated travelling packet along the media line */}
        <circle r="4" className="fill-primary motion-reduce:hidden">
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M66,44 L254,44" />
        </circle>

        {/* endpoints */}
        <g className="text-foreground">
          <circle cx="52" cy="44" r="16" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <circle cx="268" cy="44" r="16" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        </g>

        {/* signaling relay node below, connected only by dashed text lines */}
        <rect x="140" y="82" width="40" height="24" rx="6" className="fill-muted" stroke="currentColor" strokeOpacity="0.2" />
        <line x1="52" y1="60" x2="150" y2="90" strokeDasharray="3 4" strokeWidth="1.5" className="text-muted-foreground/50" />
        <line x1="268" y1="60" x2="170" y2="90" strokeDasharray="3 4" strokeWidth="1.5" className="text-muted-foreground/50" />

        <text x="52" y="30" textAnchor="middle" className="fill-current text-muted-foreground" style={{ fontSize: 11 }}>
          You
        </text>
        <text x="268" y="30" textAnchor="middle" className="fill-current text-muted-foreground" style={{ fontSize: 11 }}>
          Them
        </text>
        <text x="160" y="98" textAnchor="middle" className="fill-current text-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
          signal
        </text>
      </svg>
    </div>
  );
}

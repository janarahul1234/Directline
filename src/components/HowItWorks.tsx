import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Server, Waves } from "lucide-react";

/**
 * A compact, human explanation of the WebRTC lifecycle, shown on the landing
 * page. The numbered list is a genuine sequence (this is the literal order
 * operations happen in), which is why step numbering is appropriate here.
 */
const STEPS: { title: string; body: string }[] = [
  {
    title: "Share a code",
    body: "One person creates a room; the other opens the same code. Our server only notes that two browsers want to meet.",
  },
  {
    title: "Offer",
    body: "The initiator sends a Session Description (SDP) — a plain-text list of the media it can send and receive.",
  },
  {
    title: "Answer",
    body: "The other browser replies with its own SDP, and the two agree on how the call will be built.",
  },
  {
    title: "ICE",
    body: "Each side gathers candidate network addresses (helped by STUN) and tests pairs until a direct path is found.",
  },
  {
    title: "Connected",
    body: "Encrypted audio and video now travel straight between the two browsers. The server is out of the media path entirely.",
  },
];

export function HowItWorks() {
  return (
    <section className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card size="sm">
              <CardContent className="flex items-start gap-3.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 font-mono text-xs font-semibold text-primary tabular-nums">
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-card-foreground">
                    {step.title}
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </span>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="grid gap-2 sm:grid-cols-3">
        <Principle
          icon={<Server className="size-4" />}
          title="Signaling only"
          body="The server forwards tiny text messages — never a frame of video."
        />
        <Principle
          icon={<Waves className="size-4" />}
          title="Direct media"
          body="Audio & video go peer-to-peer over an encrypted DTLS-SRTP channel."
        />
        <Principle
          icon={<ShieldCheck className="size-4" />}
          title="No relay"
          body="We run no TURN relay on purpose, so media can't be touched mid-call."
        />
      </div>
    </section>
  );
}

function Principle({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5">
      <span className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </span>
      <span className="text-xs leading-relaxed text-muted-foreground">{body}</span>
    </div>
  );
}

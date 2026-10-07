# Directline — peer-to-peer audio & video calls

A small, beginner-friendly WebRTC app for **1-to-1** audio and video calls.
The whole point of this project is the architecture rule it is built around:

> **Media never passes through a server.** Audio and video travel *directly*
> between the two browsers. The only server involved is a tiny **signaling
> relay** that exchanges SDP **offers / answers** and **ICE candidates** so the
> two peers can find each other — then it steps completely out of the path.

There is **no media relay server and no TURN server on purpose**. See
[Tradeoffs](#tradeoffs--why-these-choices) for what that buys and costs.

---

## Table of contents

- [Quick start](#quick-start)
- [How to use it](#how-to-use-it)
- [Architecture: signaling vs. media](#architecture-signaling-vs-media)
- [The WebRTC connection lifecycle](#the-webrtc-connection-lifecycle)
- [The signaling protocol](#the-signaling-protocol)
- [File map](#file-map)
- [Tradeoffs & why these choices](#tradeoffs--why-these-choices)
- [Deploying](#deploying)
- [Tech stack](#tech-stack)

---

## Quick start

**Requirements:** Node.js 18+ (developed on Node 24) and a modern browser
(Chrome / Edge / Firefox / Safari). Camera and microphone access required.

```bash
npm install      # install dependencies
npm run dev      # start the dev server on http://localhost:3000
```

Open **two browser windows** (ideally one normal + one incognito, or two
different browsers) so the browser treats them as separate peers:

1. In window A, click **Start a direct call** → you land on a URL like
   `/kmp-7r2xq-9wt`. That last path segment is the **room code**.
2. Copy the code (or the whole URL) with the buttons in the top bar.
3. In window B, paste the code into **Join** (or open the shared URL).
4. Accept camera/mic prompts. The two windows connect **directly** — the status
   pill changes to **"Connected — peer-to-peer"**.

> WebRTC needs a **secure context**. `http://localhost` counts as secure, so dev
> works out of the box. To test between two *physical* machines you must serve
> over HTTPS.

## How to use it

| Control            | What it does                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| **Start a direct call** | Creates a room and generates a fresh, shareable room code.                    |
| **Join `<code>`**  | Opens an existing room as the second participant.                                   |
| Copy / Share       | Copies the room code, or the full invite link.                                      |
| **Mic**            | Mute/unmute. This only flips the audio track's `enabled` flag — no renegotiation.   |
| **Camera**         | Turn your camera on/off, the same way.                                              |
| **Red hangup**     | Leaves the call. The relay tells the other peer you're gone.                         |

The peer sees your mute/camera changes through WebRTC's own `mute`/`unmute`
track events — **not** through any extra server message. The signaling channel
stays strictly about offer/answer/ICE.

---

## Architecture: signaling vs. media

The single most important design goal is a **clean separation** between the two
concerns. Neither layer knows about the other; `useCall` is the only place that
connects them.

```
        ┌──────────────────────── BROWSER A ────────────────────────┐
        │  useCall (orchestrator)                                    │
        │     ├── lib/signaling/*  ── moves JSON control messages    │
        │     └── lib/webrtc/*     ── RTCPeerConnection + media      │
        └───────────────┬───────────────────────────────┬────────────┘
                        │                               │
            SIGNALING   │  (JSON: offer / answer / ICE) │
          (SSE + POST)  ▼                               ▼  MEDIA (audio/video)
        ┌───────────────────────┐              ══ DIRECT P2P ══  encrypted
        │  Next.js Route Handler│              ══ DTLS-SRTP ══   media, no
        │  /api/room/[roomId]   │◀──────────────────────────────▶ relay
        │  relays TEXT only     │            peers negotiate, then
        └───────────────────────┘            stream straight to each other
                        ▲
                        │  SIGNALING (JSON only — never media)
        ┌───────────────┴───────────────────────────────┐
        │                 BROWSER B                      │
        └────────────────────────────────────────────────┘
```

- **Signaling layer** (`src/lib/signaling/`) answers: *"how does a small JSON
  message get from this browser to the other one?"* It knows about SSE + POST
  and nothing about WebRTC.
- **WebRTC layer** (`src/lib/webrtc/`) answers: *"once I have a peer, how do I
  negotiate and stream media?"* It knows about `RTCPeerConnection` and nothing
  about HTTP or rooms.
- **`src/hooks/useCall.ts`** is the bridge: "when signaling says X, tell the
  peer to do Y." Keeping this glue in one hook is what lets the two halves be
  understood — or replaced — independently.

---

## The WebRTC connection lifecycle

This is the detailed explanation the app is built to demonstrate. It maps
one-to-one onto [`src/lib/webrtc/peerConnection.ts`](./src/lib/webrtc/peerConnection.ts).

```
Browser A (initiator)                       Browser B (receiver)
   │                                              │
   │  new RTCPeerConnection + addTrack(mic,cam)   │  (same)
   │                                              │
   │  1. createOffer()  ── localDescription       │
   │                                              │
   │  ── 2. "offer" (SDP) ────── signaling ────▶  │  setRemoteDescription(offer)
   │                                              │  3. createAnswer() ── localDescription
   │  ◀── "answer" (SDP) ────── signaling ──────  │
   │  setRemoteDescription(answer)                │
   │                                              │
   │  4. onicecandidate ─▶ "ice" ── signaling ──▶ │  addIceCandidate(...)
   │  ◀── "ice" ────────── signaling ── onicecandidate
   │        (gather host/srflx candidates via STUN, try pairs)
   │                                              │
   │  ══════════ 5. CONNECTED: media flows ══════  │  ontrack fires → attach to <video>
   │                                              │
   │  6. close()  ◀──── hangup / disconnect ────▶ │  (relay announces peer-left)
```

### 1. Create the connection
Each browser makes an `RTCPeerConnection` and adds its local microphone +
camera tracks (`getUserMedia`). Adding tracks **before** the offer guarantees
they are included in the negotiation.

### 2. Offer
The initiator calls `createOffer()`. The result is an **SDP** (Session
Description Protocol) text blob describing the media it can send/receive and
how it wants to secure it. It saves this as its `localDescription` and sends it
to the other peer **over signaling** (an `"offer"` message). Nothing about the
actual media is in there — only the "blueprint."

### 3. Answer
The receiver sets the offer as its `remoteDescription`, calls `createAnswer()`,
saves that as its own `localDescription`, and sends an `"answer"` back. At this
point both sides agree on codecs, encryption, and multiplexing — but they don't
yet know each other's network addresses.

### 4. ICE (candidate exchange)
While the SDP is exchanged, each `RTCPeerConnection` fires `onicecandidate` as
it gathers candidate network addresses:

- **host** — a local/LAN address,
- **srflx** — a server-reflexive (public) address, discovered by a **STUN**
  server that only answers *"what public address do you appear to come from?"*
  (STUN never touches media).

Every candidate is relayed as an `"ice"` message and fed to the other side's
`addIceCandidate()`. The peers then form candidate pairs and test them until a
**direct** path works. `Peer` buffers any candidate that arrives *before* the
remote description is set (a classic ordering race) and flushes it afterwards —
see `handleIce` / `flushPendingCandidates`.

### 5. Connected — media flows peer-to-peer
Once a usable path is found, `connectionState` goes `connecting → connected`
and the browsers negotiate keys (DTLS) and stream **encrypted audio/video
directly** over SRTP. `ontrack` fires as soon as inbound media arrives, so the
remote `<video>` starts playing. The signaling server is now completely out of
the loop.

### 6. Close
Hanging up (or closing the tab) calls `close()`. Closing the signaling stream
makes the relay send a `peer-left` to the other side, which tears its peer down
back to "waiting."

### Muting without renegotiating
Mic/camera toggles set `track.enabled = false/true`. WebRTC propagates this to
the peer as a `mute`/`unmute` event on the **inbound track** — the app reads
that in `VideoStage` to show "their camera is off." No new offer/answer, and no
extra signaling message, is needed.

---

## The signaling protocol

Defined in [`src/lib/signaling/messages.ts`](./src/lib/signaling/messages.ts).
The relay only ever forwards these small JSON objects — never media.

**WebRTC negotiation (relayed peer → peer):**

| type       | fields              | meaning                              |
| ---------- | ------------------- | ------------------------------------ |
| `offer`    | `to`, `from`, `sdp` | caller's SDP session description      |
| `answer`   | `to`, `from`, `sdp` | callee's SDP reply                    |
| `ice`      | `to`, `from`, `candidate` | one ICE candidate (address hint) |

**Room membership (emitted by the relay, required to bootstrap the above):**

| type          | fields        | meaning                                     |
| ------------- | ------------- | ------------------------------------------- |
| `room-info`   | `occupants`   | peers already in the room when you arrive    |
| `peer-joined` | `peerId`      | someone entered while you were present        |
| `peer-left`   | `peerId`      | someone disconnected                          |
| `room-full`   | —             | the room already has its two participants     |

The server's `POST` handler **only** relays `offer`/`answer`/`ice` and drops
anything else, so the "signaling only carries negotiation" rule is enforced in
code, not just by convention.

---

## File map

```
src/
  app/
    page.tsx                    Landing: hero + create/join + lifecycle explainer
    layout.tsx                  Root layout (dark-first shell, fonts, metadata)
    globals.css                 Tailwind + shadcn theme tokens
    [roomId]/
      page.tsx                  Server component: reads roomId, renders <CallRoom/>
      loading.tsx               Suspense fallback (Cache Components boundary)
    api/room/[roomId]/
      route.ts                  ★ THE ONLY SERVER CODE: SSE downlink + POST relay
  components/
    Logo.tsx                    Brand mark (two endpoints + a direct line)
    RoomLauncher.tsx            Create / join form (client)
    HowItWorks.tsx              In-app WebRTC lifecycle explanation (server)
    call/
      CallRoom.tsx              The call screen; composes useCall into UI
      VideoStage.tsx            Remote (full) + local (PiP), remote mute tracking
      VideoTile.tsx             <video> + MediaStream binding
      ControlBar.tsx            Mic / camera / hangup controls
      ConnectionBadge.tsx       Lifecycle status pill
      RoomCodeChip.tsx          The shareable room code + copy/share
  hooks/
    useCall.ts                  ★ The bridge: getUserMedia + signaling + peer
  lib/
    room.ts                     Room/peer id generation; deterministic initiator
    signaling/
      messages.ts               Signaling protocol types (offer/answer/ICE + presence)
      client.ts                 SSE + POST transport (no WebRTC knowledge)
    webrtc/
      config.ts                 STUN-only ICE config; getUserMedia with graceful fallback
      peerConnection.ts         ★ RTCPeerConnection wrapper: the media lifecycle
  components/ui/                shadcn (Base UI) primitives: button, card, input…
```

---

## Tradeoffs & why these choices

**Signaling transport = Server-Sent Events + POST (no WebSocket, no extra process).**
A WebRTC app always needs *some* signaling channel. Rather than add a WebSocket
dependency and a second process, the signaling relay is a single Next.js Route
Handler: `GET` opens an SSE stream (server → peer) and `POST` delivers a message
to be relayed (peer → server → peer). Zero new dependencies, works with plain
`npm run dev`. It is a **signaling server, not a media server** — it only ever
forwards text.

**STUN only, deliberately no TURN.** TURN *relays media*, which would violate the
project's core rule. Without TURN, a few network combinations (both peers behind
symmetric NAT / strict firewall) can't establish a direct path and the call won't
connect — the app surfaces that clearly in the error state. Between two tabs on
one machine, or across most normal NATs, a direct connection works. This is the
honest price of "no relay," and it's the interesting lesson of the project.

**Strict 1-to-1.** The room rejects a third participant (`room-full`), which keeps
the negotiation (and the teaching value) simple.

**Deterministic initiator.** Both peers must agree on exactly *one* side sending
the offer, or you get glare (both offer) or deadlock (neither does). Instead of
fragile join-order, the peer whose id sorts alphabetically later initiates
(`shouldInitiateCall` in `lib/room.ts`). Both sides compute it from the same two
ids, so they always agree regardless of who joined first.

---

## Deploying

The presence registry lives in **one Node process's memory** (`globalThis` map in
the route handler), which is perfect for `next dev` and for a single
`next start`. For horizontal scaling / serverless you'd swap that map for shared
state (Redis pub/sub, or a managed realtime channel) — **without touching the
client**, because the client only speaks the small protocol in `lib/signaling`.
On serverless platforms, long-lived SSE connections are also bounded by the
platform's function `maxDuration` (EventSource reconnects automatically, and an
already-established call keeps working because media is peer-to-peer).

---

## Tech stack

- **Next.js 16** (App Router, Turbopack, Cache Components) + **React 19**
- **shadcn/ui** on **Base UI**, **Tailwind CSS v4**, **lucide-react** icons
- **WebRTC** (`RTCPeerConnection`, `getUserMedia`) with the raw browser APIs
- Signaling via **Server-Sent Events** + **Route Handlers** — no third-party
  realtime service, no media server

/**
 * SIGNaling RELAY — the *only* server code in this app.
 *
 * Its entire responsibility is to forward small JSON control messages between
 * the two browsers that share a room code. It NEVER handles, buffers, parses or
 * relays audio/video — media flows directly peer-to-peer between the browsers.
 *
 * Transport choice (why SSE + POST, not a WebSocket server):
 *   - GET  -> Server-Sent Events. An open HTTP stream the browser consumes with
 *     EventSource. Perfect for the server pushing messages DOWN to a peer.
 *   - POST -> a peer sending a message UP to be relayed to the other peer.
 * This needs no extra dependencies, no separate process, and works with a plain
 * `npm run dev`.
 *
 * State model: an in-memory map  roomId -> (peerId -> stream controller).
 * Because the presence registry lives in this process's memory, it is designed
 * for a SINGLE server instance (self-hosted `next start`, or local dev). For a
 * multi-instance / serverless deployment you would swap this map for something
 * shared (Redis pub/sub, or a managed realtime channel) WITHOUT changing the
 * client — the client only speaks the small protocol in lib/signaling.
 */

// We keep the registry on `globalThis` so it survives hot-module reloads during
// `next dev`; without this, editing this file would silently drop active rooms.
const globalForRooms = globalThis as unknown as {
  __rtcRooms?: Map<string, Map<string, Controller>>;
};

type Controller = ReadableStreamDefaultController<Uint8Array>;

const rooms: Map<string, Map<string, Controller>> =
  globalForRooms.__rtcRooms ??= new Map();

const encoder = new TextEncoder();

/** Encode one Server-Sent Events frame: `data: <json>\n\n`. */
function sseFrame(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Write a message to one peer's stream, ignoring it if they already left. */
function sendTo(
  room: Map<string, Controller>,
  peerId: string,
  payload: unknown
): void {
  const controller = room.get(peerId);
  if (!controller) return;
  try {
    controller.enqueue(sseFrame(payload));
  } catch {
    // Stream already closed/cancelled — nothing to do.
  }
}

/** Remove a peer from a room and announce the departure, if it is the active one. */
function leaveRoom(
  roomId: string,
  room: Map<string, Controller>,
  peerId: string,
  controller: Controller | undefined
): void {
  // Only remove if the registered controller is still the one we own. On an
  // auto-reconnect the new stream may already have replaced this one.
  if (controller && room.get(peerId) === controller) {
    room.delete(peerId);
    for (const otherId of room.keys()) {
      sendTo(room, otherId, { type: "peer-left", peerId });
    }
  }
  if (room.size === 0) rooms.delete(roomId);
}

/**
 * GET /api/room/[roomId]?peerId=<id>
 * Open the SSE downlink and register this peer in the room.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<Response> {
  const { roomId } = await params;
  const url = new URL(request.url);
  const peerId = url.searchParams.get("peerId");

  if (!peerId) {
    return new Response("Missing peerId", { status: 400 });
  }

  const room = rooms.get(roomId) ?? new Map<string, Controller>();
  rooms.set(roomId, room);

  // Everyone else currently in the room (excluding a stale copy of ourselves).
  const occupants = [...room.keys()].filter((id) => id !== peerId);

  let myController: Controller | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      myController = controller;

      // This app is strictly 1-to-1: refuse a third participant.
      if (occupants.length >= 2) {
        controller.enqueue(sseFrame({ type: "room-full" }));
        controller.close();
        return;
      }

      room.set(peerId, controller);

      // 1) Tell me who is already here.
      controller.enqueue(sseFrame({ type: "room-info", occupants }));
      // 2) Tell them I arrived.
      for (const occupantId of occupants) {
        sendTo(room, occupantId, { type: "peer-joined", peerId });
      }
    },
    cancel() {
      leaveRoom(roomId, room, peerId, myController);
    },
  });

  // Belt-and-suspenders cleanup if the client disconnects abnormally.
  request.signal.addEventListener("abort", () => {
    leaveRoom(roomId, room, peerId, myController);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable buffering in nginx-style proxies so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * POST /api/room/[roomId]
 * Relay ONE negotiation message (offer | answer | ice) to its recipient.
 * Any other type is intentionally dropped — the server forwards signaling and
 * nothing else.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
): Promise<Response> {
  const { roomId } = await params;

  let body: { to?: unknown; from?: unknown; type?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { to, from, type, ...rest } = body as Record<string, unknown>;

  if (
    typeof to !== "string" ||
    typeof from !== "string" ||
    (type !== "offer" && type !== "answer" && type !== "ice")
  ) {
    return Response.json(
      { ok: false, error: "Relay only accepts offer/answer/ice with a target" },
      { status: 400 }
    );
  }

  const room = rooms.get(roomId);
  if (room?.has(to)) {
    sendTo(room, to, { type, from, ...rest });
  }
  // If the target is gone we still return 200; the peer-left event handles it.

  return Response.json({ ok: true });
}

// NOTE: This route runs on the default Node.js runtime (needed for the in-memory
// presence registry above). We do NOT export a `runtime` segment config here
// because it is incompatible with `cacheComponents` in next.config.ts, where the
// Node runtime is already the default for Route Handlers.

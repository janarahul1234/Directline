/**
 * Signaling *transport* for the browser.
 *
 * This module is deliberately dumb and contains ZERO WebRTC knowledge. Its one
 * job is to move JSON control messages between the two browsers. It is the only
 * file that knows *how* signaling travels (Server-Sent Events down, POST up).
 * Everything else in the app talks to this abstraction, never to SSE directly.
 *
 *   - Downlink (server -> you): a Server-Sent Events stream via EventSource.
 *   - Uplink   (you -> server): a plain POST to the same room endpoint.
 *
 * The server just forwards whatever you POST to the target peer's SSE stream.
 */

import type { OutgoingSignal, SignalingMessage } from "./messages";

export interface SignalingChannel {
  /** Relay an offer/answer/ICE message to one specific peer. */
  send(signal: OutgoingSignal): Promise<void>;
  /** Close the downlink stream (server will then tell the peer you left). */
  close(): void;
}

export interface OpenChannelOptions {
  roomId: string;
  peerId: string;
  /** Called for every message received from the relay. */
  onMessage: (message: SignalingMessage) => void;
  /** Called when the connection drops permanently (EventSource gave up). */
  onError?: (error: Error) => void;
}

function endpoint(roomId: string): string {
  return `/api/room/${encodeURIComponent(roomId)}`;
}

export function openSignalingChannel({
  roomId,
  peerId,
  onMessage,
  onError,
}: OpenChannelOptions): SignalingChannel {
  // `peerId` is sent as a query param so the relay can register *this* stream
  // under our id and route messages back to us.
  const streamUrl = `${endpoint(roomId)}?peerId=${encodeURIComponent(peerId)}`;
  const source = new EventSource(streamUrl);

  source.onmessage = (event: MessageEvent<string>) => {
    try {
      onMessage(JSON.parse(event.data) as SignalingMessage);
    } catch {
      // Ignore any malformed frame (should not happen).
    }
  };

  source.onerror = () => {
    // EventSource auto-reconnects while readyState is CONNECTING. It only
    // reaches CLOSED when the server ends the stream for good (e.g. room full),
    // in which case we surface an error to the caller.
    if (source.readyState === EventSource.CLOSED) {
      onError?.(new Error("Signaling connection closed."));
    }
  };

  return {
    async send(signal: OutgoingSignal): Promise<void> {
      const res = await fetch(endpoint(roomId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Stamp our id as `from` so the relay can forward it to the target.
        body: JSON.stringify({ ...signal, from: peerId }),
      });
      if (!res.ok) {
        throw new Error(`Signaling send failed (${res.status})`);
      }
    },
    close(): void {
      source.close();
    },
  };
}

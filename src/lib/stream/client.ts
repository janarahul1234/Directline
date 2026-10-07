/**
 * Browser-side Stream Video client factory.
 *
 * Wraps the headless `@stream-io/video-client`. We use the *client* SDK (not the
 * React SDK) so the existing custom UI (VideoStage / ControlBar / VideoTile)
 * keeps rendering raw MediaStreams — `useCall` stays the single seam between
 * Stream and our components.
 *
 * The API key is public by design (it identifies the app, not a secret); the
 * secret lives only on the server and is used by `/api/stream-token`.
 */

"use client";

import { StreamVideoClient, type User } from "@stream-io/video-client";

/**
 * Call type defined in the Stream dashboard. The `default` type allows any
 * authenticated user to create/join, which matches this app's open room-code
 * model. Change here if you introduce a locked-down call type.
 */
export const CALL_TYPE = "default";

function apiKey(): string {
  const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_STREAM_API_KEY. Add it to your environment to enable calls.",
    );
  }
  return key;
}

/** Fetch a short-lived user token from our server route for the given user id. */
async function fetchToken(userId: string): Promise<string> {
  const res = await fetch(`/api/stream-token?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = (await res.json()) as { token?: string; error?: string };
  if (!data.token) throw new Error(data.error ?? "No token returned.");
  return data.token;
}

/**
 * Creates a client and connects `userId` to it. The SDK calls the tokenProvider
 * on first connect and again whenever the token needs refreshing.
 */
export function createStreamClient(userId: string): StreamVideoClient {
  const user: User = { id: userId };
  return new StreamVideoClient({
    apiKey: apiKey(),
    user,
    tokenProvider: () => fetchToken(userId),
  });
}

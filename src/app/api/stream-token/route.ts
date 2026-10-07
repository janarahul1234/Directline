/**
 * STREAM VIDEO TOKEN ROUTE
 *
 * The browser cannot mint its own Stream auth tokens — that requires the
 * API *secret*, which must never ship to the client. This server-only route
 * uses the `@stream-io/node-sdk` (server SDK) to sign a short-lived user token
 * for the id the client asks for, and returns just the token.
 *
 * There is no user account system in this app: every browser tab is treated as
 * an ephemeral, randomly-identified participant, so we happily mint a token for
 * whatever `userId` is passed in. In a real product you would only ever issue a
 * token for the *authenticated* user that owns the current session.
 *
 * Runs on the default Node.js runtime (Route Handlers default to Node under
 * `cacheComponents`). We deliberately do NOT export a `runtime` segment config,
 * matching the convention used elsewhere in this app.
 */

import { StreamClient } from "@stream-io/node-sdk";

/** A Stream user id: keep it to a safe, bounded character set. */
const USER_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export async function GET(request: Request): Promise<Response> {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return Response.json(
      { error: "Stream is not configured on this server." },
      { status: 500 },
    );
  }

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId || !USER_ID_RE.test(userId)) {
    return Response.json({ error: "Missing or invalid userId." }, { status: 400 });
  }

  try {
    const stream = new StreamClient(apiKey, apiSecret);
    // 1-hour token; the client SDK refreshes via the tokenProvider automatically.
    const token = stream.generateUserToken({
      user_id: userId,
      validity_in_seconds: 60 * 60,
    });
    return Response.json({ token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Token generation failed." },
      { status: 500 },
    );
  }
}

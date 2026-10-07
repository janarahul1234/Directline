/**
 * Room + peer identity helpers.
 *
 * A "room" is just a short, human-shareable code. Two browsers that open the
 * same code join the same signaling room and can then connect directly to each
 * other over WebRTC. Nothing about these codes touches the media stream — they
 * are only used to pair the two peers on the signaling channel.
 */

// An alphabet without visually ambiguous characters (no l/i/1/o/0) so codes are
// easy to read aloud and type on a phone.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** e.g. "kmp-7r2xq-9wt" — grouped so it is easy to read and share. */
export function generateRoomId(): string {
  return `${randomString(3)}-${randomString(5)}-${randomString(3)}`;
}

/** Format a code for display: lowercase, only [a-z0-9-], collapsed whitespace. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/**
 * Validate a room code. We accept either the strict grouped form
 * (abc-xxxxx-xxx) or any loose 6-20 char [a-z0-9-] string, so users who paste
 * or mistype a code are not blocked by formatting alone.
 */
export function isValidRoomCode(code: string): boolean {
  return /^[a-z0-9-]{6,20}$/.test(code);
}

/**
 * A per-tab identifier. Used only to decide which of the two peers starts the
 * negotiation (see `shouldInitiateCall`) and to route signaling messages.
 */
export function generatePeerId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Deterministic role selection for a 1-to-1 call.
 *
 * Both peers need to agree on exactly ONE of them sending the initial SDP
 * "offer" so the call does not deadlock and does not "glare" (both offering at
 * once). Instead of relying on fragile join-order, we simply let the peer whose
 * id sorts *later* alphabetically be the initiator. Both sides can compute this
 * independently from the same pair of ids, so it always agrees.
 */
export function shouldInitiateCall(myId: string, otherId: string): boolean {
  return myId > otherId;
}

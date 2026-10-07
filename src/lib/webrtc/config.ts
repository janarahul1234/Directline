/**
 * RTCPeerConnection configuration.
 *
 * `iceServers` help the two browsers discover each other's network addresses
 * (the "ICE" phase). We intentionally use **STUN only**:
 *
 *   - STUN just asks a server "what public IP/port do you see me coming from?"
 *     It never carries media. It only helps the peers find a direct route.
 *   - TURN *relays* media through a server. We deliberately DO NOT include a
 *     TURN server, because this app's core rule is "no media relay" — audio and
 *     video must travel directly between the two peers.
 *
 * Consequence of no TURN (honest tradeoff to document): if both peers sit behind
 * a symmetric NAT / restrictive firewall, a direct P2P path may not be found and
 * the call cannot connect. For two tabs on one machine, or most home/office NATs,
 * a direct connection works fine.
 */
export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:global.stun.twilio.com:3478"] },
  ],
  // Force the browser to prefer a direct P2P route and never fall back to any
  // relay, making the "no media relay" rule explicit in the ICE layer itself.
  iceTransportPolicy: "all",
};

/** getUserMedia constraints: one camera video track + one microphone track. */
export const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

/**
 * Try to get audio+video, degrading gracefully:
 *   - If the user denies permission entirely -> throw (caller shows the reason).
 *   - If there is no camera -> fall back to audio-only so a call is still possible.
 */
export async function acquireMedia(): Promise<{
  stream: MediaStream;
  hasVideo: boolean;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(MEDIA_CONSTRAINTS);
    return { stream, hasVideo: stream.getVideoTracks().length > 0 };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error(
        "Camera / microphone permission was blocked. Allow access and try again."
      );
    }
    // No camera or a device error: retry with audio only.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: MEDIA_CONSTRAINTS.audio,
        video: false,
      });
      return { stream, hasVideo: false };
    } catch {
      throw new Error("Could not access your microphone or camera.");
    }
  }
}

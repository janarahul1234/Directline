/**
 * The P2P media connection.
 *
 * A `Peer` wraps a single `RTCPeerConnection` for ONE remote participant. It is
 * the "media" half of the app and is intentionally kept separate from signaling:
 * it does NOT know about SSE, POST, fetch, or room ids. It communicates with the
 * outside world only through the `PeerEvents` callbacks it is given, and the
 * `handle*` methods the caller invokes when a signaling message arrives.
 *
 * ---------------------------------------------------------------------------
 * THE WEBRTC CONNECTION LIFECYCLE (what happens inside this class)
 * ---------------------------------------------------------------------------
 *
 *  1. CREATE        A new RTCPeerConnection is made with our STUN config, and
 *                   every local track (mic + camera) is added to it.
 *
 *  2. OFFER         The initiating peer calls createOffer(). This produces an
 *                   SDP blob ("offer") describing what media we can send/receive
 *                   and how we'd like to negotiate. We store it as our
 *                   localDescription and hand it to `events.localOffer` so the
 *                   caller can send it over signaling.
 *
 *  3. ANSWER        The receiving peer gets the offer, sets it as its
 *                   remoteDescription, then createAnswer() produces its "answer"
 *                   SDP. It stores that as localDescription and emits
 *                   `events.localAnswer` to be sent back.
 *
 *  4. ICE           While the SDP is exchanged, each side gathers ICE candidates
 *                   (possible network addresses: host / srflx via STUN). Each
 *                   candidate is emitted via `events.localCandidate` and relayed
 *                   to the other peer, which feeds it to addIceCandidate().
 *                   The two peers try candidate pairs until a DIRECT path works.
 *
 *  5. CONNECTED     When a working path is found, connectionState moves
 *                   "connecting" -> "connected" and encrypted media (DTLS-SRTP)
 *                   starts flowing peer-to-peer. `events.remoteStream` fires as
 *                   soon as the first inbound track arrives, so video can render
 *                   even before the whole connection reports "connected".
 *
 *  6. CLOSE         hangup()/unmount closes the connection and releases resources.
 *
 * NOTE ON MUTE: muting the mic/camera does NOT renegotiate. We simply flip the
 * track's `enabled` flag (see setTracksEnabled). WebRTC propagates that to the
 * other side as a "mute" on their inbound track — no signaling message needed.
 */

import { RTC_CONFIGURATION } from "./config";

export type ConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export interface PeerEvents {
  /** We produced an SDP offer (initiator side). */
  localOffer: (sdp: RTCSessionDescriptionInit) => void;
  /** We produced an SDP answer (receiver side). */
  localAnswer: (sdp: RTCSessionDescriptionInit) => void;
  /** A new ICE candidate was gathered and should be sent to the peer. */
  localCandidate: (candidate: RTCIceCandidateInit) => void;
  /** The peer's inbound media stream is available to display. */
  remoteStream: (stream: MediaStream) => void;
  /** The overall connection state changed. */
  connectionState: (state: ConnectionState) => void;
}

export class Peer {
  private connection: RTCPeerConnection;
  // Candidates that arrive before the remote description are set are queued here
  // and applied afterwards (a classic WebRTC race — see handleIce).
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(
    private readonly localStream: MediaStream,
    private readonly events: PeerEvents
  ) {
    this.connection = new RTCPeerConnection(RTC_CONFIGURATION);

    // 1. Add every local track so it is included in the offer/answer.
    for (const track of this.localStream.getTracks()) {
      this.connection.addTrack(track, this.localStream);
    }

    // 4. Trickle ICE: emit each candidate as it is gathered.
    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.events.localCandidate(event.candidate.toJSON());
      }
    };

    // 5. Surface connection state transitions to the UI.
    this.connection.onconnectionstatechange = () => {
      this.events.connectionState(
        this.connection.connectionState as ConnectionState
      );
    };

    // 5. The peer's media arrived. `event.streams[0]` is the MediaStream we can
    //    attach to a <video> element.
    this.connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) this.events.remoteStream(stream);
    };
  }

  /** Step 2 — only the initiator (the later peer id) calls this. */
  async start(): Promise<void> {
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    // Emit the *complete* local description (its .sdp carries all we gathered).
    const local = this.connection.localDescription;
    if (local) this.events.localOffer(local.toJSON());
  }

  /** Receiver side of step 2/3: got an offer, produce an answer. */
  async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.connection.setRemoteDescription(sdp);
    this.flushPendingCandidates();

    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    const local = this.connection.localDescription;
    if (local) this.events.localAnswer(local.toJSON());
  }

  /** Initiator side of step 3: got the answer back. */
  async handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.connection.setRemoteDescription(sdp);
    this.flushPendingCandidates();
  }

  /** Step 4: the peer sent us an ICE candidate to try. */
  async handleIce(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.connection.remoteDescription) {
      // Remote description not ready yet — hold it until it is.
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.connection.addIceCandidate(candidate);
    } catch {
      // A stray/late candidate is not fatal; ignore it.
    }
  }

  private flushPendingCandidates(): void {
    const queued = this.pendingCandidates.splice(0);
    for (const candidate of queued) {
      this.connection.addIceCandidate(candidate).catch(() => {});
    }
  }

  /**
   * Mute / unmute without renegotiation. Disabling a track makes WebRTC fire a
   * "mute" event on the other peer's inbound track automatically.
   */
  setTracksEnabled(kind: "audio" | "video", enabled: boolean): void {
    for (const track of this.localStream.getTracks()) {
      if (track.kind === kind) track.enabled = enabled;
    }
  }

  /** Step 6 — tear down the connection. */
  close(): void {
    this.connection.onicecandidate = null;
    this.connection.onconnectionstatechange = null;
    this.connection.ontrack = null;
    this.connection.close();
    this.pendingCandidates = [];
  }
}

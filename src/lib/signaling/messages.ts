/**
 * The signaling message protocol.
 *
 * IMPORTANT — read this before touching the architecture:
 * The signaling server ONLY ever relays these small JSON control messages. It
 * never sees, touches, or forwards a single byte of audio or video. Media flows
 * directly between the two browsers (peer-to-peer) via RTCPeerConnection.
 *
 * There are two families of messages:
 *
 *  1. WebRTC negotiation messages (the actual "signaling" per the WebRTC spec):
 *     - "offer"   : the caller's session description (SDP)
 *     - "answer"  : the callee's SDP reply
 *     - "ice"     : an ICE candidate (a network address hint for discovery)
 *
 *  2. Room membership events the relay emits so the two peers know about each
 *     other. These carry no media and are strictly required to bootstrap #1
 *     (you cannot exchange an offer until you know a peer is present):
 *     - "room-info"   : who is already in the room when you arrive
 *     - "peer-joined" : someone entered while you were here
 *     - "peer-left"   : someone disconnected
 *     - "room-full"   : the room already has its two participants
 */

export type RoomInfoMessage = { type: "room-info"; occupants: string[] };
export type PeerJoinedMessage = { type: "peer-joined"; peerId: string };
export type PeerLeftMessage = { type: "peer-left"; peerId: string };
export type RoomFullMessage = { type: "room-full" };

export type OfferMessage = {
  type: "offer";
  from: string;
  sdp: RTCSessionDescriptionInit;
};
export type AnswerMessage = {
  type: "answer";
  from: string;
  sdp: RTCSessionDescriptionInit;
};
export type IceMessage = {
  type: "ice";
  from: string;
  candidate: RTCIceCandidateInit;
};

/** Everything the browser can *receive* from the signaling channel. */
export type SignalingMessage =
  | RoomInfoMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | RoomFullMessage
  | OfferMessage
  | AnswerMessage
  | IceMessage;

/**
 * What a browser *sends* to the relay to be forwarded to the other peer.
 * A `to` recipient is always required — the relay never broadcasts these.
 */
export type OutgoingSignal = { to: string } & (
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
);

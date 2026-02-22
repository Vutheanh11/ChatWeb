/* ============================================================
   state.js — Shared mutable application state
   All modules import { st } and read/write properties here
   so cross-module state changes propagate correctly.
   ============================================================ */

export const st = {
  // ── Auth ─────────────────────────────────────────────────
  currentUser:    null,   // Firebase Auth user object
  currentProfile: null,   // Firestore /users/{uid} document data

  // ── Chat UI ──────────────────────────────────────────────
  activeConvId:    null,  // Currently open conversation ID
  activePeer:      null,  // { uid, name, color, … } of other user
  allConvs:        [],    // All conversations for current user
  peerStatusUnsubs:{},    // { [uid]: unsubFn } — per-peer status listeners
  convFilter:      'all', // sidebar filter tab
  typingTimer:     null,
  blockedByPeer:   false, // true when active peer has blocked current user

  // ── Unsubscribe handles ──────────────────────────────────
  unsubConvs:      null,
  unsubMsgs:       null,
  unsubReqs:       null,
  unsubPeerStatus: null,

  // ── Block list ───────────────────────────────────────────
  blockedUsers: {},       // { [uid]: true } — UIDs blocked by current user

  // ── Add Friend ───────────────────────────────────────────
  incomingRequests: [],   // cached incoming friend request docs
};

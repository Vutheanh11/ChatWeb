/* ============================================================
   calls.js — WebRTC Voice & Video Calls (Frontend)
   Signalling via Firestore `calls` collection.
   STUN-only, no TURN — suitable for most NAT topologies.
   ============================================================ */

import {
  db,
  collection, doc, addDoc, updateDoc, getDoc,
  onSnapshot, serverTimestamp,
  query, where,
} from './firebase-init.js';
import { $, showToast } from './utils.js';
import { st } from './state.js';

// ── STUN config ───────────────────────────────────────────────
const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── Call state (module-private) ───────────────────────────────
let _vc_pc            = null;
let _vc_callId        = null;
let _vc_role          = null;       // 'caller' | 'callee'
let _vc_type          = 'audio';    // 'audio' | 'video'
let _vc_localStream   = null;
let _vc_remoteAudio   = null;
let _vc_timerInt      = null;
let _vc_timerSecs     = 0;
let _vc_muted         = false;
let _vc_camOff        = false;
let _vc_unsubCall     = null;
let _vc_unsubCallerIC = null;
let _vc_unsubCalleeIC = null;
let _vc_unsubIncoming = null;
let _vc_incomingName  = '';

// ── Voice call (audio only) ───────────────────────────────────
export async function startVoiceCall(peerId) {
  peerId = peerId || st.activePeer?.uid;
  if (!st.currentUser || !peerId) { showToast('Select a conversation first.', 'warning'); return; }
  if (_vc_pc) { showToast('Already in a call.', 'warning'); return; }
  try {
    _vc_localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showToast('Microphone access denied.', 'danger'); return;
  }
  _vc_role = 'caller';
  _vc_type = 'audio';
  _vc_pc   = new RTCPeerConnection(STUN_SERVERS);
  _vc_localStream.getTracks().forEach(t => _vc_pc.addTrack(t, _vc_localStream));
  _vc_remoteAudio = new Audio(); _vc_remoteAudio.autoplay = true;
  _vc_pc.ontrack = e => { _vc_remoteAudio.srcObject = e.streams[0]; };

  const callRef = await addDoc(collection(db, 'calls'), {
    caller:     st.currentUser.uid,
    callerName: st.currentProfile?.name || st.currentUser.displayName || 'Unknown',
    callee:     peerId,
    status:     'calling',
    type:       'audio',
    createdAt:  serverTimestamp(),
  });
  _vc_callId = callRef.id;

  _vc_pc.onicecandidate = async e => {
    if (e.candidate)
      await addDoc(collection(db, 'calls', _vc_callId, 'callerCandidates'), e.candidate.toJSON());
  };
  const offer = await _vc_pc.createOffer();
  await _vc_pc.setLocalDescription(offer);
  await updateDoc(doc(db, 'calls', _vc_callId), { offer: { type: offer.type, sdp: offer.sdp } });

  _vcShowUI('outgoing', st.activePeer?.name || 'Unknown');

  _vc_unsubCall = onSnapshot(doc(db, 'calls', _vc_callId), async snap => {
    const d = snap.data();
    if (!d) return;
    if (d.status === 'declined') { vcCleanup('Call declined.'); return; }
    if (d.status === 'ended')    { vcCleanup('Call ended.');    return; }
    if (d.answer && _vc_pc && !_vc_pc.remoteDescription) {
      await _vc_pc.setRemoteDescription(new RTCSessionDescription(d.answer));
      _vcShowUI('active', st.activePeer?.name || 'Unknown');
      _vcStartTimer();
    }
  });
  _vc_unsubCalleeIC = onSnapshot(collection(db, 'calls', _vc_callId, 'calleeCandidates'), snap => {
    snap.docChanges().forEach(async ch => {
      if (ch.type === 'added' && _vc_pc)
        await _vc_pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
    });
  });
}

// ── Video call ────────────────────────────────────────────────
export async function startVideoCall(peerId) {
  peerId = peerId || st.activePeer?.uid;
  if (!st.currentUser || !peerId) { showToast('Select a conversation first.', 'warning'); return; }
  if (_vc_pc) { showToast('Already in a call.', 'warning'); return; }
  if (st.blockedByPeer) { showToast('Bạn đã bị khóa mồm.', 'danger'); return; }
  try {
    _vc_localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch {
    showToast('Camera/microphone access denied.', 'danger'); return;
  }
  _vc_type = 'video';
  _vc_role = 'caller';
  _attachLocalVideo();
  _vc_pc = new RTCPeerConnection(STUN_SERVERS);
  _vc_localStream.getTracks().forEach(t => _vc_pc.addTrack(t, _vc_localStream));
  _vc_pc.ontrack = e => _attachRemoteVideo(e.streams[0]);

  const callRef = await addDoc(collection(db, 'calls'), {
    caller:     st.currentUser.uid,
    callerName: st.currentProfile?.name || st.currentUser.displayName || 'Unknown',
    callee:     peerId,
    status:     'calling',
    type:       'video',
    createdAt:  serverTimestamp(),
  });
  _vc_callId = callRef.id;

  _vc_pc.onicecandidate = async e => {
    if (e.candidate)
      await addDoc(collection(db, 'calls', _vc_callId, 'callerCandidates'), e.candidate.toJSON());
  };
  const offer = await _vc_pc.createOffer();
  await _vc_pc.setLocalDescription(offer);
  await updateDoc(doc(db, 'calls', _vc_callId), { offer: { type: offer.type, sdp: offer.sdp } });

  _vcShowUI('video-outgoing', st.activePeer?.name || 'Unknown');

  _vc_unsubCall = onSnapshot(doc(db, 'calls', _vc_callId), async snap => {
    const d = snap.data();
    if (!d) return;
    if (d.status === 'declined') { vcCleanup('Call declined.'); return; }
    if (d.status === 'ended')    { vcCleanup('Call ended.');    return; }
    if (d.answer && _vc_pc && !_vc_pc.remoteDescription) {
      await _vc_pc.setRemoteDescription(new RTCSessionDescription(d.answer));
      _vcShowUI('video-active', st.activePeer?.name || 'Unknown');
      _vcStartTimer();
    }
  });
  _vc_unsubCalleeIC = onSnapshot(collection(db, 'calls', _vc_callId, 'calleeCandidates'), snap => {
    snap.docChanges().forEach(async ch => {
      if (ch.type === 'added' && _vc_pc)
        await _vc_pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
    });
  });
}

// ── Answer (handles both audio and video) ────────────────────
export async function answerVoiceCall() {
  if (!_vc_callId || _vc_role !== 'callee') return;
  const constraints = _vc_type === 'video' ? { audio: true, video: true } : { audio: true };
  try {
    _vc_localStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    showToast(_vc_type === 'video' ? 'Camera/microphone access denied.' : 'Microphone access denied.', 'danger');
    await declineVoiceCall(); return;
  }
  _vc_pc = new RTCPeerConnection(STUN_SERVERS);
  _vc_localStream.getTracks().forEach(t => _vc_pc.addTrack(t, _vc_localStream));
  if (_vc_type === 'video') {
    _attachLocalVideo();
    _vc_pc.ontrack = e => _attachRemoteVideo(e.streams[0]);
  } else {
    _vc_remoteAudio = new Audio(); _vc_remoteAudio.autoplay = true;
    _vc_pc.ontrack = e => { _vc_remoteAudio.srcObject = e.streams[0]; };
  }
  _vc_pc.onicecandidate = async e => {
    if (e.candidate)
      await addDoc(collection(db, 'calls', _vc_callId, 'calleeCandidates'), e.candidate.toJSON());
  };
  const snap = await getDoc(doc(db, 'calls', _vc_callId));
  await _vc_pc.setRemoteDescription(new RTCSessionDescription(snap.data().offer));
  _vc_unsubCallerIC = onSnapshot(collection(db, 'calls', _vc_callId, 'callerCandidates'), snap => {
    snap.docChanges().forEach(async ch => {
      if (ch.type === 'added' && _vc_pc)
        await _vc_pc.addIceCandidate(new RTCIceCandidate(ch.doc.data())).catch(() => {});
    });
  });
  const answer = await _vc_pc.createAnswer();
  await _vc_pc.setLocalDescription(answer);
  await updateDoc(doc(db, 'calls', _vc_callId), {
    answer: { type: answer.type, sdp: answer.sdp },
    status: 'answered',
  });
  _vcShowUI(_vc_type === 'video' ? 'video-active' : 'active', _vc_incomingName);
  _vcStartTimer();
  _vc_unsubCall = onSnapshot(doc(db, 'calls', _vc_callId), snap => {
    if (snap.data()?.status === 'ended') vcCleanup('Call ended.');
  });
}

export async function declineVoiceCall() {
  if (_vc_callId)
    await updateDoc(doc(db, 'calls', _vc_callId), { status: 'declined' }).catch(() => {});
  vcCleanup();
}

export async function endVoiceCall() {
  if (_vc_callId)
    await updateDoc(doc(db, 'calls', _vc_callId), { status: 'ended' }).catch(() => {});
  vcCleanup('Call ended.');
}

// ── Mute / camera ─────────────────────────────────────────────
export function toggleCallMute() {
  _vc_muted = !_vc_muted;
  _vc_localStream?.getAudioTracks().forEach(t => { t.enabled = !_vc_muted; });
  ['call-mute-btn', 'vid-mute-btn'].forEach(id => {
    const btn = $(id);
    if (btn) { btn.classList.toggle('active', _vc_muted); btn.title = _vc_muted ? 'Unmute' : 'Mute'; }
  });
}

export function toggleVideoCamera() {
  _vc_camOff = !_vc_camOff;
  _vc_localStream?.getVideoTracks().forEach(t => { t.enabled = !_vc_camOff; });
  const btn = $('vid-cam-btn');
  if (btn) { btn.classList.toggle('active', _vc_camOff); btn.title = _vc_camOff ? 'Turn camera on' : 'Turn camera off'; }
}

// ── Subscribe to incoming calls ───────────────────────────────
export function subscribeIncomingCalls() {
  if (_vc_unsubIncoming || !st.currentUser) return;
  const q = query(
    collection(db, 'calls'),
    where('callee', '==', st.currentUser.uid),
    where('status', '==', 'calling')
  );
  _vc_unsubIncoming = onSnapshot(q, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added' && !_vc_pc) {
        const d         = ch.doc.data();
        _vc_callId       = ch.doc.id;
        _vc_role         = 'callee';
        _vc_type         = d.type === 'video' ? 'video' : 'audio';
        _vc_incomingName = d.callerName || 'Unknown';
        _vcShowUI(_vc_type === 'video' ? 'video-incoming' : 'incoming', _vc_incomingName);
      }
    });
  });
}

// ── Cleanup (exported so chat.js can call on beforeunload) ────
export function vcCleanup(msg) {
  [_vc_unsubCall, _vc_unsubCallerIC, _vc_unsubCalleeIC].forEach(u => u?.());
  _vc_unsubCall = _vc_unsubCallerIC = _vc_unsubCalleeIC = null;
  _vc_pc?.close(); _vc_pc = null;
  _vc_localStream?.getTracks().forEach(t => t.stop()); _vc_localStream = null;
  if (_vc_remoteAudio) { _vc_remoteAudio.srcObject = null; _vc_remoteAudio = null; }
  const rv = $('remote-video'); if (rv) rv.srcObject = null;
  const lv = $('local-video');  if (lv) lv.srcObject = null;
  clearInterval(_vc_timerInt); _vc_timerInt = null;
  _vc_callId = null; _vc_role = null; _vc_muted = false; _vc_camOff = false; _vc_type = 'audio';
  ['call-outgoing','call-incoming','call-active',
   'call-video-outgoing','call-video-incoming','call-video-active']
    .forEach(id => $(id)?.classList.add('hidden'));
  if (msg) showToast(msg, 'info');
}

// ── Private helpers ───────────────────────────────────────────
function _attachLocalVideo() {
  const v = $('local-video');
  if (v) { v.srcObject = _vc_localStream; v.play().catch(() => {}); }
}

function _attachRemoteVideo(stream) {
  const v = $('remote-video');
  if (v) { v.srcObject = stream; v.play().catch(() => {}); }
}

function _vcStartTimer() {
  _vc_timerSecs = 0;
  clearInterval(_vc_timerInt);
  _vc_timerInt = setInterval(() => {
    _vc_timerSecs++;
    const m = String(Math.floor(_vc_timerSecs / 60)).padStart(2, '0');
    const s = String(_vc_timerSecs % 60).padStart(2, '0');
    const txt = `${m}:${s}`;
    const el1 = $('call-timer'); if (el1) el1.textContent = txt;
    const el2 = $('vid-timer');  if (el2) el2.textContent = txt;
  }, 1000);
}

function _vcShowUI(type, peerName) {
  ['call-outgoing','call-incoming','call-active',
   'call-video-outgoing','call-video-incoming','call-video-active']
    .forEach(id => $(id)?.classList.add('hidden'));
  const idMap = {
    'outgoing':       'call-outgoing',
    'incoming':       'call-incoming',
    'active':         'call-active',
    'video-outgoing': 'call-video-outgoing',
    'video-incoming': 'call-video-incoming',
    'video-active':   'call-video-active',
  };
  const el = $(idMap[type]);
  if (!el) return;
  el.querySelectorAll('.call-peer-name').forEach(n => n.textContent = peerName);
  const t1 = $('call-timer'); if (t1) t1.textContent = '00:00';
  const t2 = $('vid-timer');  if (t2) t2.textContent = '00:00';
  const avMap = {
    'outgoing':'call-out-av', 'incoming':'call-in-av', 'active':'call-active-av',
    'video-outgoing':'vid-out-av', 'video-incoming':'vid-in-av',
  };
  const avEl = $(avMap[type]);
  if (avEl) avEl.textContent = peerName.charAt(0).toUpperCase() || '?';
  el.classList.remove('hidden');
}

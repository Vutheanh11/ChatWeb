/* ============================================================
   chat.js — Chat page logic (IS_CHAT page)
   Conversations, messages, contacts, presence,
   notifications, voice messages, GIFs, block, friends.
   ============================================================ */

import {
  auth, db, giphyApiKey,
  onAuthStateChanged, signOut,
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
} from './firebase-init.js';
import { $, showToast, sanitize, fmtTime, fmtDate, EMOJI_CATEGORIES, applyTheme, applyChatTheme } from './utils.js';
import { st } from './state.js';
import { createUserProfile } from './auth.js';
import { subscribeIncomingCalls, vcCleanup } from './calls.js';

// ── Firestore query alias (avoids shadowing the 'query' import) ──
const query_ = query;

// ── BANNED WORDS ──────────────────────────────────────────────
const BANNED_WORDS = [
  'nigger','nigga','n1gger','n1gga','nigg3r','nigg4',
  'faggot','fag','f4ggot','f4g',
  'kike','k1ke',
  'spic','sp1c',
  'chink','ch1nk',
  'gook',
  'wetback','beaner',
  'tranny','tr4nny',
  'retard','ret4rd',
  'cunt','c0nt',
  'Đói ai hẻo','Địt Mẹ Mày',
];

async function checkAndRecordViolation(text) {
  const normalized = text
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .toLowerCase();
  const stripped = normalized.replace(/[^a-z]/g, '');
  const spaced   = normalized.replace(/[^a-z\s]/g, ' ');
  const hit = BANNED_WORDS.some(bw => {
    const bwClean = bw.replace(/[^a-z]/g, '');
    return spaced.includes(bw) || stripped.includes(bwClean);
  });
  if (!hit) return true;

  const userRef = doc(db, 'users', st.currentUser.uid);
  try {
    const snap       = await getDoc(userRef);
    const violations = (snap.data()?.violations || 0) + 1;
    if (violations >= 10) {
      await updateDoc(userRef, { violations, banned: true });
      showToast('Your account has been permanently banned for repeated use of prohibited language.', 'danger');
      setTimeout(() => signOut(auth), 2500);
      return false;
    }
    await updateDoc(userRef, { violations });
    const left = 10 - violations;
    const sev  = violations >= 8 ? 'danger' : 'warning';
    showToast(`⚠️ Prohibited language detected. Warning ${violations}/10 — ${left} more violation${left === 1 ? '' : 's'} until permanent ban.`, sev);
  } catch (e) { console.warn('Violation tracking error:', e); }
  return false;
}

// ── REPLY / RECALL / MESSAGE MENU ─────────────────────────────
let _replyTo = null;

export function setReplyTo(msgId, text, fromName) {
  _replyTo = { msgId, text, fromName };
  const bar = $('reply-preview-bar');
  if (bar) {
    $('reply-preview-name').textContent = fromName;
    $('reply-preview-text').textContent = text.length > 80 ? text.slice(0, 80) + '…' : text;
    bar.classList.remove('hidden');
  }
  $('message-box')?.focus();
  hideMsgMenu();
}

export function clearReplyTo() {
  _replyTo = null;
  $('reply-preview-bar')?.classList.add('hidden');
}

export function showMsgMenu(event, msgId, isMe, msgText, msgFromName) {
  event.stopPropagation();
  const menu = $('msg-context-menu');
  if (!menu) return;
  const encoded  = btoa(encodeURIComponent(String(msgText).slice(0, 200)));
  const safeName = String(msgFromName).replace(/'/g, "\\'");

  const replyBtn = `<button class="msg-menu-item" onclick="setReplyTo('${msgId}',decodeURIComponent(atob('${encoded}')),'${safeName}')">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>Reply</button>`;
  const recallBtn = isMe ? `<button class="msg-menu-item" onclick="recallMessage('${msgId}')">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Recall</button>` : '';
  const deleteBtn = isMe ? `<button class="msg-menu-item danger" onclick="deleteMsg('${msgId}')">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete</button>` : '';
  const selectBtn = `<button class="msg-menu-item" onclick="enterSelectMode('${msgId}')">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 11 5 15 3 13"/><line x1="13" y1="13" x2="21" y2="13"/><line x1="13" y1="17" x2="21" y2="17"/><line x1="13" y1="9" x2="21" y2="9"/></svg>Select messages</button>`;

  menu.innerHTML = replyBtn + recallBtn + deleteBtn + selectBtn;

  const itemCount = 2 + (isMe ? 2 : 0);
  const menuW = 185, menuH = itemCount * 40 + 8;
  let top  = event.clientY + 4;
  let left = event.clientX - menuW + 16;
  if (left < 8)                             left = 8;
  if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
  if (top + menuH > window.innerHeight - 8) top  = event.clientY - menuH - 4;
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
  menu.classList.remove('hidden');
}

export function hideMsgMenu() { $('msg-context-menu')?.classList.add('hidden'); }

export async function recallMessage(msgId) {
  hideMsgMenu();
  if (!st.activeConvId) return;
  try {
    await updateDoc(doc(db, 'conversations', st.activeConvId, 'messages', msgId), {
      recalled: true, text: 'Message recalled', audioData: null, gifUrl: null,
    });
  } catch (err) { showToast('Failed to recall: ' + err.message, 'danger'); }
}

export async function deleteMsg(msgId) {
  hideMsgMenu();
  if (!st.activeConvId) return;
  try {
    await deleteDoc(doc(db, 'conversations', st.activeConvId, 'messages', msgId));
    showToast('Message deleted.', 'success');
  } catch (err) { showToast('Failed to delete: ' + err.message, 'danger'); }
}

// ── SELECT MODE ───────────────────────────────────────────────
let _selectMode   = false;
let _selectedMsgs = new Set();

export function enterSelectMode(firstMsgId) {
  hideMsgMenu();
  _selectMode = true;
  _selectedMsgs = new Set([firstMsgId]);
  rerenderSelectBar();
  const area = $('messages-area');
  if (!area) return;
  area.querySelectorAll('.msg-row').forEach(row => {
    const id = row.dataset.msgId;
    if (!id) return;
    let cb = row.querySelector('.msg-checkbox');
    if (!cb) {
      cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'msg-checkbox';
      cb.onchange = () => toggleMsgSelect(id, cb.checked);
      row.prepend(cb);
    }
    cb.checked = _selectedMsgs.has(id);
    row.classList.add('select-mode');
    if (_selectedMsgs.has(id)) row.classList.add('selected');
  });
}

export function exitSelectMode() {
  _selectMode = false; _selectedMsgs = new Set();
  $('select-actions-bar')?.classList.add('hidden');
  $('messages-area')?.querySelectorAll('.msg-row').forEach(row => {
    row.classList.remove('select-mode', 'selected');
    row.querySelector('.msg-checkbox')?.remove();
  });
}

export function toggleMsgSelect(msgId, checked) {
  if (checked) _selectedMsgs.add(msgId); else _selectedMsgs.delete(msgId);
  $('messages-area')?.querySelector(`[data-msg-id="${msgId}"]`)?.classList.toggle('selected', checked);
  rerenderSelectBar();
  if (_selectedMsgs.size === 0) exitSelectMode();
}

export function rerenderSelectBar() {
  const bar = $('select-actions-bar');
  if (!bar) return;
  const n = _selectedMsgs.size;
  if (n === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  $('select-count').textContent = `${n} selected`;
}

export async function deleteSelectedMsgs() {
  if (!st.activeConvId || _selectedMsgs.size === 0) return;
  try {
    await Promise.all([..._selectedMsgs].map(id =>
      deleteDoc(doc(db, 'conversations', st.activeConvId, 'messages', id))
    ));
    showToast(`Deleted ${_selectedMsgs.size} message${_selectedMsgs.size > 1 ? 's' : ''}.`, 'success');
  } catch (err) { showToast('Failed to delete: ' + err.message, 'danger'); }
  exitSelectMode();
}

// ── BLOCK USER ────────────────────────────────────────────────
export async function loadBlockedUsers() {
  if (!st.currentUser) return;
  const snap = await getDoc(doc(db, 'users', st.currentUser.uid));
  st.blockedUsers = snap.data()?.blocked || {};
}

export async function blockUser(peerId) {
  peerId = peerId || st.activePeer?.uid;
  if (!peerId || !st.currentUser) return;
  const isBlocked = !!st.blockedUsers[peerId];
  try {
    if (isBlocked) delete st.blockedUsers[peerId];
    else           st.blockedUsers[peerId] = true;
    await updateDoc(doc(db, 'users', st.currentUser.uid), { blocked: st.blockedUsers });
    renderConvList(getFilteredConvs($('search-input')?.value || ''));
    updateBlockBtn(peerId);
    updateBlockedBanner();
    showToast(isBlocked ? 'User unblocked.' : 'User blocked.', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'danger'); }
}

export function updateBlockBtn(peerId) {
  const btn = $('pp-block-btn');
  if (!btn || !peerId) return;
  const isBlocked = !!st.blockedUsers[peerId];
  btn.textContent = isBlocked ? '🔓 Unblock User' : '🚫 Block User';
  btn.className   = isBlocked ? 'pp-action-btn' : 'pp-action-btn danger';
}

export function updateBlockedBanner() {
  const banner  = $('blocked-banner');
  const toolbar = $('input-toolbar');
  if (!st.activePeer) return;
  const isBlocked = !!st.blockedUsers[st.activePeer.uid];
  banner?.classList.toggle('hidden',  !isBlocked);
  toolbar?.classList.toggle('hidden',  isBlocked);
}

export function updatePeerBlockedMeBanner(isBlockedByPeer) {
  st.blockedByPeer = isBlockedByPeer;
  const banner  = $('peer-blocked-me-banner');
  const toolbar = $('input-toolbar');
  const msgBox  = $('message-box');
  const sendBtn = $('send-btn');
  banner?.classList.toggle('hidden', !isBlockedByPeer);
  if (isBlockedByPeer) {
    toolbar?.classList.add('hidden');
    if (msgBox) { msgBox.contentEditable = 'false'; msgBox.textContent = ''; }
    if (sendBtn) sendBtn.disabled = true;
  } else {
    if (st.activePeer && !st.blockedUsers[st.activePeer.uid])
      toolbar?.classList.remove('hidden');
    if (msgBox) msgBox.contentEditable = 'true';
    if (sendBtn) sendBtn.disabled = false;
  }
}

function updatePeerBannedBanner(isBanned) {
  $('peer-banned-banner')?.classList.toggle('hidden', !isBanned);
  const msgBox  = $('message-box');
  const sendBtn = $('send-btn');
  if (!msgBox) return;
  if (isBanned) {
    msgBox.contentEditable = 'false';
    msgBox.dataset.placeholder = 'Người dùng này đã bị cấm vì vi phạm quy định';
    msgBox.textContent = '';
    msgBox.classList.add('input-banned');
    if (sendBtn) sendBtn.disabled = true;
  } else {
    msgBox.contentEditable = 'true';
    msgBox.dataset.placeholder = 'Type a message…';
    msgBox.classList.remove('input-banned');
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── CHAT PAGE INIT ────────────────────────────────────────────
export function initChatPage() {
  applyTheme();
  applyChatTheme();

  onAuthStateChanged(auth, async user => {
    if (!user || !user.emailVerified) { window.location.href = 'index.html'; return; }
    st.currentUser = user;

    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      await createUserProfile(user, user.displayName || user.email.split('@')[0]);
      st.currentProfile = (await getDoc(doc(db, 'users', user.uid))).data();
    } else {
      st.currentProfile = snap.data();
    }

    if (st.currentProfile?.banned) {
      showToast('Your account has been permanently banned for violating community guidelines.', 'danger');
      setTimeout(() => signOut(auth), 2500);
      return;
    }

    await updateDoc(doc(db, 'users', user.uid), { status: 'online' });

    $('my-name').textContent = st.currentProfile.name;
    const av = $('my-avatar');
    if (av) {
      av.textContent = st.currentProfile.name.charAt(0).toUpperCase();
      av.style.background = st.currentProfile.color;
    }

    buildEmojiPicker();
    subscribeConversations();
    subscribeIncomingCalls();
    subscribeIncomingRequests();
    initNotifications();

    document.addEventListener('click', e => {
      if (!e.target.closest('.chat-actions'))
        $('dropdown-menu')?.classList.add('hidden');
      if (!e.target.closest('.msg-menu-btn') && !e.target.closest('.msg-context-menu'))
        hideMsgMenu();
      if (e.target.id === 'new-chat-modal')    closeNewChat();
      if (e.target.id === 'settings-modal')    closeSettings();
      if (e.target.id === 'add-friend-modal')  closeAddFriend();
      if (e.target.id === 'my-profile-modal')  closeMyProfile();
    });

    $('chat-avatar')?.addEventListener('dblclick',
      () => $('profile-panel')?.classList.remove('hidden'));
  });

  // ── Presence ──────────────────────────────────────────────
  function _setPresence(online) {
    if (!st.currentUser) return;
    const data = online
      ? { status: 'online',  lastActive: serverTimestamp() }
      : { status: 'offline', lastSeen:   serverTimestamp() };
    updateDoc(doc(db, 'users', st.currentUser.uid), data).catch(() => {});
  }

  window.addEventListener('beforeunload', () => {
    _setPresence(false);
    vcCleanup();
    if (st.unsubConvs)      st.unsubConvs();
    if (st.unsubMsgs)       st.unsubMsgs();
    if (st.unsubReqs)       st.unsubReqs();
    if (st.unsubPeerStatus) st.unsubPeerStatus();
  });
  window.addEventListener('pagehide', () => _setPresence(false));
  document.addEventListener('visibilitychange', () => {
    if (!st.currentUser) return;
    _setPresence(document.visibilityState !== 'hidden');
  });

  // Heartbeat — refresh lastActive every 55 s
  setInterval(() => {
    if (st.currentUser && document.visibilityState !== 'hidden')
      updateDoc(doc(db, 'users', st.currentUser.uid), {
        status: 'online', lastActive: serverTimestamp(),
      }).catch(() => {});
  }, 55_000);
}

// ── CONVERSATIONS ─────────────────────────────────────────────
function subscribeConversations() {
  const knownLastAt = {};
  let initialLoad = true;

  const q = query_(
    collection(db, 'conversations'),
    where('members', 'array-contains', st.currentUser.uid)
  );
  st.unsubConvs = onSnapshot(q, snap => {
    st.allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    st.allConvs.sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0));

    if (!initialLoad) {
      st.allConvs.forEach(conv => {
        const newSec = conv.lastAt?.seconds || 0;
        const oldSec = knownLastAt[conv.id] || 0;
        if (newSec > oldSec && conv.lastFrom && conv.lastFrom !== st.currentUser.uid) {
          const isActiveConv = conv.id === st.activeConvId && document.hasFocus();
          if (!isActiveConv) {
            const peer = getPeerInfo(conv);
            showBrowserNotification(peer.name, conv.lastMessage || 'Sent you a message', null);
          }
        }
        knownLastAt[conv.id] = newSec;
      });
    } else {
      st.allConvs.forEach(conv => { knownLastAt[conv.id] = conv.lastAt?.seconds || 0; });
      initialLoad = false;
    }

    renderConvList(getFilteredConvs($('search-input')?.value || ''));
    subscribeAllPeerStatuses();
  });
}

function subscribeAllPeerStatuses() {
  const uid = st.currentUser?.uid;
  if (!uid) return;
  const currentPeerIds = new Set(
    st.allConvs.map(c => c.members?.find(m => m !== uid)).filter(Boolean)
  );
  Object.keys(st.peerStatusUnsubs).forEach(peerId => {
    if (!currentPeerIds.has(peerId)) { st.peerStatusUnsubs[peerId](); delete st.peerStatusUnsubs[peerId]; }
  });
  currentPeerIds.forEach(peerId => {
    if (st.peerStatusUnsubs[peerId]) return;
    st.peerStatusUnsubs[peerId] = onSnapshot(doc(db, 'users', peerId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      let online = data.status === 'online';
      if (online && data.lastActive) {
        const ageSec = Math.floor(Date.now() / 1000) - (data.lastActive.seconds ?? 0);
        if (ageSec > 120) online = false;
      }
      const conv = st.allConvs.find(c => c.members?.includes(peerId));
      if (!conv) return;
      const dot = document.querySelector(`.contact-item[data-id="${conv.id}"] .avatar-status`);
      if (dot) dot.className = `avatar-status ${online ? 'status-online' : 'status-offline'}`;
    });
  });
}

function getFilteredConvs(searchQ) {
  let list = [...st.allConvs];
  const uid = st.currentUser.uid;
  if (st.convFilter === 'unread') list = list.filter(c => (c.unread?.[uid] || 0) > 0);
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(c => getPeerInfo(c).name.toLowerCase().includes(q));
  }
  return list;
}

function getPeerInfo(conv) {
  const uid    = st.currentUser.uid;
  const peerId = conv.members.find(m => m !== uid);
  return conv.memberInfo?.[peerId] || { name: 'Unknown', color: '#6C63FF' };
}

function renderConvList(convs) {
  const list = $('contact-list');
  if (!list) return;
  if (!convs.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:24px;font-size:13px;">No conversations yet.<br>Add a friend to start chatting!</p>';
    return;
  }
  list.innerHTML = '';
  const uid = st.currentUser.uid;
  convs.forEach(conv => {
    const peer    = getPeerInfo(conv);
    const unread  = conv.unread?.[uid] || 0;
    const lastMsg = conv.lastMessage || 'Start a conversation';
    const lastTime= conv.lastAt ? fmtTime(conv.lastAt) : '';
    const isActive= conv.id === st.activeConvId;
    const item = document.createElement('div');
    item.className = `contact-item${isActive ? ' active' : ''}`;
    item.dataset.id = conv.id;
    item.innerHTML = `
      <div class="avatar" style="background:${peer.color}">
        ${peer.name.charAt(0)}
        <div class="avatar-status status-offline"></div>
      </div>
      <div class="contact-info">
        <div class="contact-name">${sanitize(peer.name)}</div>
        <div class="contact-preview">${sanitize(lastMsg)}</div>
      </div>
      <div class="contact-meta">
        <span class="contact-time">${lastTime}</span>
        ${unread ? `<span class="badge">${unread}</span>` : ''}
      </div>`;
    item.onclick = () => openConversation(conv.id);
    list.appendChild(item);
  });
}

export function filterContacts(q) { renderConvList(getFilteredConvs(q)); }

export function filterTab(type, btn) {
  st.convFilter = type;
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderConvList(getFilteredConvs($('search-input')?.value || ''));
}

// ── OPEN CONVERSATION ─────────────────────────────────────────
export async function openConversation(convId) {
  st.activeConvId = convId;
  const conv = st.allConvs.find(c => c.id === convId);
  if (!conv) return;

  const uid    = st.currentUser.uid;
  const peerId = conv.members.find(m => m !== uid);
  const peer   = getPeerInfo(conv);
  st.activePeer = { uid: peerId, ...peer };

  if ((conv.unread?.[uid] || 0) > 0)
    await updateDoc(doc(db, 'conversations', convId), { [`unread.${uid}`]: 0 });

  $('empty-state').classList.add('hidden');
  $('conversation').classList.remove('hidden');
  $('chat-avatar').textContent = peer.name.charAt(0);
  $('chat-avatar').style.background = peer.color;
  $('chat-peer-name').textContent = peer.name;
  $('chat-peer-status').textContent = '...';
  $('chat-peer-status').style.color = 'var(--text-muted)';

  $('pp-avatar').textContent = peer.name.charAt(0);
  $('pp-avatar').style.background = peer.color;
  $('pp-name').textContent   = peer.name;
  $('pp-status').textContent = '...';
  $('pp-about').textContent  = peer.about || "Hey there! I'm using ChatWave.";
  $('pp-media').innerHTML    = ['📷','🖼️','📄','🎵','📹','📊'].map(e => `<div class="media-thumb">${e}</div>`).join('');

  document.querySelectorAll('.contact-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === convId));

  updatePeerBannedBanner(false);
  updatePeerBlockedMeBanner(false);
  getDoc(doc(db, 'users', peerId)).then(snap => {
    if (snap.exists()) updatePeerBannedBanner(!!snap.data().banned);
  });

  subscribePeerStatus(peerId);
  subscribeMessages(convId);
  $('sidebar')?.classList.add('hidden-mobile');
}

// ── MESSAGES ──────────────────────────────────────────────────
function subscribeMessages(convId) {
  if (st.unsubMsgs) { st.unsubMsgs(); st.unsubMsgs = null; }
  $('messages-area').innerHTML = '';
  const q = query_(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  st.unsubMsgs = onSnapshot(q, snap => {
    renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderMessages(msgs) {
  const area = $('messages-area');
  if (!area) return;
  const uid = st.currentUser.uid;
  area.innerHTML = '';
  let lastDate = '', lastFrom = '';

  msgs.forEach(m => {
    const dateLabel = m.sentAt ? fmtDate(m.sentAt) : 'Today';
    if (dateLabel !== lastDate) {
      const div = document.createElement('div');
      div.className = 'msg-date-divider'; div.textContent = dateLabel;
      area.appendChild(div);
      lastDate = dateLabel; lastFrom = '';
    }

    const isMe       = m.from === uid;
    const isCont     = m.from === lastFrom;
    const isRecalled = !!m.recalled;
    const time       = m.sentAt ? fmtTime(m.sentAt) : '';
    const mtype      = m.type || 'text';

    const row = document.createElement('div');
    row.className = `msg-row${isMe ? ' me' : ''}${isCont ? ' continuation' : ''}`;
    row.dataset.msgId = m.id;

    const avatarHtml = (!isMe && !isCont)
      ? `<div class="avatar avatar-xs" style="background:${st.activePeer?.color || '#6C63FF'}">${(st.activePeer?.name || '?').charAt(0)}</div>`
      : '<div class="msg-avatar-slot"></div>';

    let bodyHtml;
    if (isRecalled) {
      bodyHtml = `<span class="recalled-text">🔄 Message recalled</span>`;
    } else if (mtype === 'gif') {
      bodyHtml = `<img class="msg-gif" src="${m.gifUrl}" alt="GIF" loading="lazy"/>`;
    } else if (mtype === 'voice') {
      const dur = m.duration ? ` (${m.duration}s)` : '';
      bodyHtml = `
        <div class="msg-voice">
          <svg class="voice-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
          </svg>
          <audio class="msg-audio" controls preload="metadata" src="${m.audioData}"></audio>
          <span class="voice-dur">${dur}</span>
        </div>`;
    } else {
      let replyHtml = '';
      if (m.replyTo) {
        const rName = sanitize(m.replyTo.fromName || 'User');
        const rText = sanitize((m.replyTo.text || '').slice(0, 80) + ((m.replyTo.text || '').length > 80 ? '…' : ''));
        replyHtml = `<div class="reply-quote"><span class="reply-quote-name">${rName}</span><span class="reply-quote-text">${rText}</span></div>`;
      }
      bodyHtml = replyHtml + sanitize(m.text);
    }

    const safeText = isRecalled ? '' : (m.text || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const peerName = isMe ? 'You' : (st.activePeer?.name || 'User').replace(/'/g, "\\'");
    const menuHtml = isRecalled ? '' : `
      <div class="msg-actions">
        <button class="msg-menu-btn" title="Options"
          onclick="showMsgMenu(event,'${m.id}',${isMe},decodeURIComponent(atob('${btoa(encodeURIComponent(safeText.slice(0,200)))}')),'${peerName}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
          </svg>
        </button>
      </div>`;

    row.innerHTML = `
      ${avatarHtml}
      <div class="bubble${isRecalled ? ' recalled' : ''}${mtype === 'gif' ? ' gif-bubble' : ''}">
        ${bodyHtml}
        <div class="bubble-footer">
          <span class="msg-time">${time}</span>
          ${isMe ? '<span class="read-receipt">✓✓</span>' : ''}
        </div>
      </div>
      ${menuHtml}`;
    area.appendChild(row);
    lastFrom = m.from;
  });
  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// ── SEND MESSAGE ──────────────────────────────────────────────
export async function sendMessage() {
  if (!st.activeConvId || !st.currentUser) return;
  const box  = $('message-box');
  const text = box.innerText.trim();
  if (!text) return;

  const allowed = await checkAndRecordViolation(text);
  if (!allowed) { box.innerText = ''; box.focus(); return; }

  box.innerText = ''; box.focus();

  try {
    const convRef = doc(db, 'conversations', st.activeConvId);
    const msgData = { from: st.currentUser.uid, text, sentAt: serverTimestamp() };
    if (_replyTo) {
      msgData.replyTo = { msgId: _replyTo.msgId, text: _replyTo.text, fromName: _replyTo.fromName };
    }
    clearReplyTo();
    await addDoc(collection(db, 'conversations', st.activeConvId, 'messages'), msgData);

    const peerId = st.activePeer?.uid;
    const update = { lastMessage: text, lastAt: serverTimestamp(), lastFrom: st.currentUser.uid };
    if (peerId) update[`unread.${peerId}`] = (st.allConvs.find(c => c.id === st.activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(convRef, update);
    clearTypingIndicator();
  } catch (err) { showToast('Failed to send: ' + err.message, 'danger'); }
}

export function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ── VOICE MESSAGES ────────────────────────────────────────────
let _mediaRecorder = null, _audioChunks = [], _recTimer = null, _recSeconds = 0, _recMimeType = 'audio/webm';

export async function startVoiceRecording() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') return;
  if (!st.activeConvId) { showToast('Open a conversation first.', 'warning'); return; }
  if (st.blockedByPeer) { showToast('Bạn đã bị khóa mồm và không thể gửi tin nhắn.', 'danger'); return; }
  if (st.activePeer && st.blockedUsers[st.activePeer.uid]) { showToast('You have blocked this user.', 'warning'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
               : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')  ? 'audio/ogg;codecs=opus' : 'audio/webm';
    _recMimeType = mime; _audioChunks = [];
    _mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };
    _mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      _hideRecordingBar();
      await _sendVoiceBlob(new Blob(_audioChunks, { type: _recMimeType }));
    };
    _mediaRecorder.start(100);
    _showRecordingBar();
  } catch { showToast('Microphone access denied.', 'danger'); }
}

export function stopAndSendVoice() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') _mediaRecorder.stop();
}

export function cancelVoiceRecording() {
  if (_mediaRecorder) {
    _mediaRecorder.onstop = () => {};
    if (_mediaRecorder.state === 'recording') _mediaRecorder.stop();
    _mediaRecorder.stream?.getTracks().forEach(t => t.stop());
    _mediaRecorder = null;
  }
  _audioChunks = [];
  _hideRecordingBar();
}

function _showRecordingBar() {
  _recSeconds = 0; $('rec-timer').textContent = '0:00';
  $('voice-recording-bar')?.classList.remove('hidden');
  $('voice-btn')?.classList.add('hidden');
  $('send-btn').style.display = 'none';
  _recTimer = setInterval(() => {
    _recSeconds++;
    const m = Math.floor(_recSeconds / 60), s = String(_recSeconds % 60).padStart(2, '0');
    $('rec-timer').textContent = `${m}:${s}`;
    if (_recSeconds >= 120) stopAndSendVoice();
  }, 1000);
}

function _hideRecordingBar() {
  clearInterval(_recTimer);
  $('voice-recording-bar')?.classList.add('hidden');
  $('voice-btn')?.classList.remove('hidden');
  $('send-btn').style.display = '';
}

async function _sendVoiceBlob(blob) {
  if (!st.activeConvId) { showToast('No active conversation.', 'warning'); return; }
  if (blob.size > 950 * 1024) { showToast('Recording too large (max ~2 min). Please try again.', 'warning'); return; }
  try {
    showToast('Sending voice message…', 'info');
    const audioData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await addDoc(collection(db, 'conversations', st.activeConvId, 'messages'), {
      from: st.currentUser.uid, type: 'voice', audioData,
      duration: _recSeconds, text: '🎙 Voice message', sentAt: serverTimestamp(),
    });
    const peerId = st.activePeer?.uid;
    const upd = { lastMessage: '🎙 Voice message', lastAt: serverTimestamp(), lastFrom: st.currentUser.uid };
    if (peerId) upd[`unread.${peerId}`] = (st.allConvs.find(c => c.id === st.activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(doc(db, 'conversations', st.activeConvId), upd);
  } catch (err) { showToast('Failed to send voice: ' + err.message, 'danger'); }
}

// ── GIF PICKER ────────────────────────────────────────────────
let gifSearchTimer = null;

export function toggleGifPicker() {
  const panel = $('gif-picker');
  if (!panel) return;
  if (!panel.classList.contains('hidden')) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  $('emoji-picker')?.classList.add('hidden');
  loadGifs('');
}

export function closeGifPicker() { $('gif-picker')?.classList.add('hidden'); }

async function fetchWithCORSFallback(url) {
  try { return await fetch(url, { mode: 'cors', credentials: 'omit' }); }
  catch (_) {
    console.warn('[GIF] Direct fetch blocked, retrying via CORS proxy…');
    return fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, { credentials: 'omit' });
  }
}

async function loadGifs(searchQuery) {
  const grid = $('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="gif-loading">Loading…</div>';
  const key = (giphyApiKey || '').trim();
  if (!key || key === 'YOUR_GIPHY_API_KEY_HERE') {
    grid.innerHTML = '<div class="gif-loading">Add your Giphy API key to <b>firebase-config.js</b></div>'; return;
  }
  const q = searchQuery.trim();
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=20&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=20&rating=g`;
  try {
    const res = await fetchWithCORSFallback(url);
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      grid.innerHTML = `<div class="gif-loading">Giphy error ${res.status}<br><small>${errText.slice(0,120)}</small></div>`; return;
    }
    const json = await res.json();
    if (!json.data?.length) { grid.innerHTML = '<div class="gif-loading">No GIFs found.</div>'; return; }
    grid.innerHTML = '';
    json.data.forEach(gif => {
      const preview = gif.images?.fixed_height_small?.url || gif.images?.downsized?.url || '';
      const full    = gif.images?.original?.url || preview;
      const img = document.createElement('img');
      img.className = 'gif-thumb'; img.src = preview; img.alt = gif.title || 'GIF'; img.loading = 'lazy';
      img.onclick = () => sendGif(full, preview);
      grid.appendChild(img);
    });
  } catch (err) {
    grid.innerHTML = `<div class="gif-loading">Failed to load GIFs:<br><small>${err.message}</small></div>`;
  }
}

export function onGifSearchInput(q) {
  clearTimeout(gifSearchTimer);
  gifSearchTimer = setTimeout(() => loadGifs(q), 400);
}

export async function sendGif(gifUrl, previewUrl) {
  if (!st.activeConvId) return;
  if (st.blockedByPeer) { showToast('Bạn đã bị khóa mồm và không thể gửi tin nhắn.', 'danger'); return; }
  if (st.activePeer && st.blockedUsers[st.activePeer.uid]) { showToast('You have blocked this user.', 'warning'); return; }
  closeGifPicker();
  try {
    await addDoc(collection(db, 'conversations', st.activeConvId, 'messages'), {
      from: st.currentUser.uid, type: 'gif', gifUrl, previewUrl, text: '[GIF]', sentAt: serverTimestamp(),
    });
    const peerId = st.activePeer?.uid;
    const upd = { lastMessage: '[GIF]', lastAt: serverTimestamp(), lastFrom: st.currentUser.uid };
    if (peerId) upd[`unread.${peerId}`] = (st.allConvs.find(c => c.id === st.activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(doc(db, 'conversations', st.activeConvId), upd);
  } catch (err) { showToast('Failed to send GIF: ' + err.message, 'danger'); }
}

// ── PEER STATUS ───────────────────────────────────────────────
function fmtLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline';
  const ts   = lastSeen.toMillis ? lastSeen.toMillis() : (lastSeen.seconds * 1000);
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 2)  return 'Offline just now';
  if (mins < 60) return `Offline since ${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Offline since ${hours} hour${hours > 1 ? 's' : ''} ago`;
  return 'Offline';
}

function subscribePeerStatus(peerUid) {
  if (st.unsubPeerStatus) { st.unsubPeerStatus(); st.unsubPeerStatus = null; }
  st.unsubPeerStatus = onSnapshot(doc(db, 'users', peerUid), snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    let online = data.status === 'online';
    if (online && data.lastActive) {
      const ageSec = Math.floor(Date.now() / 1000) - (data.lastActive.seconds ?? 0);
      if (ageSec > 120) online = false;
    }
    updatePeerBannedBanner(!!data.banned);
    updatePeerBlockedMeBanner(!!(data.blocked?.[st.currentUser?.uid]));
    const statusEl = $('chat-peer-status');
    if (statusEl) {
      statusEl.textContent = online ? 'Online' : fmtLastSeen(data.lastSeen ?? data.lastActive);
      statusEl.style.color = online ? 'var(--success)' : 'var(--text-muted)';
    }
    const dot = document.querySelector('.chat-peer-dot');
    if (dot) dot.className = `avatar-status ${online ? 'status-online' : 'status-offline'} chat-peer-dot`;
    const convDoc = st.allConvs.find(c => c.members?.includes(peerUid));
    if (convDoc) {
      const item = document.querySelector(`.contact-item[data-id="${convDoc.id}"] .avatar-status`);
      if (item) item.className = `avatar-status ${online ? 'status-online' : 'status-offline'}`;
    }
  });
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default')
    setTimeout(() => Notification.requestPermission(), 2000);
}

function showBrowserNotification(title, body, iconUrl) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body, icon: iconUrl || '/favicon.ico', badge: '/favicon.ico', tag: title, renotify: true,
  });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 6000);
}

// ── TYPING ────────────────────────────────────────────────────
export function onTyping() {
  if (!st.activeConvId || !st.currentUser) return;
  updateDoc(doc(db, 'conversations', st.activeConvId), { [`typing.${st.currentUser.uid}`]: true }).catch(() => {});
  clearTimeout(st.typingTimer);
  st.typingTimer = setTimeout(clearTypingIndicator, 3000);
}

function clearTypingIndicator() {
  if (!st.activeConvId || !st.currentUser) return;
  updateDoc(doc(db, 'conversations', st.activeConvId), { [`typing.${st.currentUser.uid}`]: false }).catch(() => {});
}

// ── MISC ──────────────────────────────────────────────────────
export function clearChat() {
  $('messages-area').innerHTML = '';
  $('dropdown-menu')?.classList.add('hidden');
  showToast('Chat cleared locally.', 'info');
}
export function toggleChatSearch() {
  const bar = $('chat-search-bar');
  bar?.classList.toggle('hidden');
  if (!bar?.classList.contains('hidden')) bar?.querySelector('input')?.focus();
}
export function searchMessages(q) {
  $('messages-area')?.querySelectorAll('.bubble').forEach(b => {
    b.style.opacity = (!q || b.innerText.toLowerCase().includes(q.toLowerCase())) ? '1' : '.25';
  });
}
export function toggleDropdown() { $('dropdown-menu')?.classList.toggle('hidden'); }

// ── EMOJI PICKER ──────────────────────────────────────────────
function buildEmojiPicker() {
  const picker = $('emoji-picker');
  if (!picker) return;
  const tabBar = document.createElement('div'); tabBar.className = 'emoji-tabs';
  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button');
    tab.className = `emoji-tab-btn${idx === 0 ? ' active' : ''}`;
    tab.textContent = cat.icon; tab.title = cat.label;
    tab.onclick = () => {
      tabBar.querySelectorAll('.emoji-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active'); renderEmojiGrid(cat.emojis);
    };
    tabBar.appendChild(tab);
  });
  picker.appendChild(tabBar);
  const grid = document.createElement('div'); grid.className = 'emoji-grid'; grid.id = 'emoji-grid';
  picker.appendChild(grid);
  renderEmojiGrid(EMOJI_CATEGORIES[0].emojis);
}

function renderEmojiGrid(emojis) {
  const grid = $('emoji-grid'); if (!grid) return;
  grid.innerHTML = '';
  emojis.forEach(emoji => {
    const btn = document.createElement('button'); btn.className = 'emoji-btn'; btn.textContent = emoji;
    btn.onclick = () => {
      $('message-box')?.focus();
      document.execCommand('insertText', false, emoji);
      $('emoji-picker')?.classList.add('hidden');
    };
    grid.appendChild(btn);
  });
}

export function toggleEmojiPicker() {
  $('emoji-picker')?.classList.toggle('hidden');
  $('gif-picker')?.classList.add('hidden');
}

// ── NEW CHAT MODAL ────────────────────────────────────────────
export async function openNewChat() {
  const modal = $('new-chat-modal'); if (!modal) return;
  modal.classList.remove('hidden');
  const list = $('modal-user-list');
  list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:13px">Loading...</p>';
  const peerIds = st.allConvs.map(c => c.members.find(m => m !== st.currentUser.uid));
  if (!peerIds.length) {
    list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:13px">No contacts yet. Add friends first!</p>'; return;
  }
  const peers = await Promise.all(peerIds.map(async uid => {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? { uid, ...s.data() } : null;
  }));
  renderModalUsers(peers.filter(Boolean));
}
export function closeNewChat() { $('new-chat-modal')?.classList.add('hidden'); }
export function filterModal(q) {
  $('modal-user-list')?.querySelectorAll('.modal-user-item').forEach(el => {
    el.style.display = el.dataset.name?.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function renderModalUsers(users) {
  const ul = $('modal-user-list'); if (!ul) return;
  ul.innerHTML = '';
  users.forEach(u => {
    const conv = st.allConvs.find(c => c.members.includes(u.uid));
    const item = document.createElement('div');
    item.className = 'modal-user-item'; item.dataset.name = u.name;
    item.innerHTML = `
      <div class="avatar avatar-sm" style="background:${u.color}">${u.name.charAt(0)}</div>
      <div><div class="user-name">${sanitize(u.name)}</div><div class="user-handle">@${sanitize(u.handle || '')}</div></div>`;
    item.onclick = () => { closeNewChat(); if (conv) openConversation(conv.id); };
    ul.appendChild(item);
  });
}

// ── PROFILE PANEL ─────────────────────────────────────────────
export function closeProfilePanel() { $('profile-panel')?.classList.add('hidden'); }

// ── SETTINGS ──────────────────────────────────────────────────
export function openSettings() {
  const modal = $('settings-modal'); if (!modal) return;
  modal.classList.remove('hidden');
  const t = $('dark-toggle'); if (t) t.checked = document.body.classList.contains('dark');
  applyChatTheme();
}
export function closeSettings() { $('settings-modal')?.classList.add('hidden'); }
export function toggleDark(checkbox) {
  document.body.classList.toggle('dark', checkbox.checked);
  localStorage.setItem('darkMode', checkbox.checked ? '1' : '0');
}

// ── MOBILE ───────────────────────────────────────────────────
export function closeMobileChat() {
  $('conversation')?.classList.add('hidden');
  $('empty-state')?.classList.remove('hidden');
  $('sidebar')?.classList.remove('hidden-mobile');
  if (st.unsubMsgs) { st.unsubMsgs(); st.unsubMsgs = null; }
  st.activeConvId = null; st.activePeer = null;
}

// ── LOGOUT ────────────────────────────────────────────────────
export async function logout() {
  if (st.currentUser)
    await updateDoc(doc(db, 'users', st.currentUser.uid), { status: 'offline', lastSeen: serverTimestamp() });
  await signOut(auth);
  window.location.href = 'index.html';
}

// ── ADD FRIEND ────────────────────────────────────────────────
let afSearchTimer = null;

function subscribeIncomingRequests() {
  if (st.unsubReqs) st.unsubReqs();
  const q = query_(
    collection(db, 'friendRequests'),
    where('to', '==', st.currentUser.uid),
    where('status', '==', 'pending')
  );
  st.unsubReqs = onSnapshot(q, snap => {
    st.incomingRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateAFBadge();
    if ($('add-friend-modal') && !$('add-friend-modal').classList.contains('hidden'))
      renderIncomingRequestsUI();
  }, err => { console.warn('friendRequests index needed:', err.message); });
}

function updateAFBadge() {
  const count = st.incomingRequests.length;
  const badge = $('af-badge'), bar = $('af-requests-bar'), cnt = $('af-req-count');
  if (badge) { badge.textContent = count; badge.classList.toggle('hidden', !count); }
  if (bar)   bar.classList.toggle('hidden', !count);
  if (cnt)   cnt.textContent = count;
}

export async function openAddFriend() {
  const modal = $('add-friend-modal'); if (!modal) return;
  modal.classList.remove('hidden');
  clearFriendSearch();
  switchAFTab('suggest', $('aftab-suggest'));
  await renderSuggested();
  renderIncomingRequestsUI();
  updateAFBadge();
  setTimeout(() => $('af-search')?.focus(), 80);
}
export function closeAddFriend() { $('add-friend-modal')?.classList.add('hidden'); }

export function switchAFTab(tab, btn) {
  document.querySelectorAll('.af-tab').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  document.querySelectorAll('.af-panel').forEach(p => p.classList.add('hidden'));
  $('afpanel-' + tab)?.classList.remove('hidden');
}
export function viewRequests() { switchAFTab('requests', $('aftab-requests')); }

export function searchFriends(q) {
  $('af-clear')?.classList.toggle('hidden', !q);
  clearTimeout(afSearchTimer);
  afSearchTimer = setTimeout(async () => {
    if (!q.trim()) { switchAFTab('suggest', $('aftab-suggest')); return; }
    switchAFTab('results', $('aftab-results'));
    await runFriendSearch(q.trim());
  }, 300);
}

async function runFriendSearch(searchQ) {
  const list = $('af-results-list');
  if (list) list.innerHTML = '<div class="af-empty">Searching...</div>';
  try {
    const q = searchQ.toLowerCase();
    const snap = await getDocs(query_(collection(db, 'users'),
      where('nameLower', '>=', q), where('nameLower', '<=', q + '\uf8ff'), limit(15)));
    const results = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== st.currentUser.uid);
    const label = $('af-results-label');
    if (label) label.textContent = results.length
      ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${searchQ}"`
      : `No users found for "${searchQ}"`;
    renderAFUserList('af-results-list', results);
  } catch (err) { if (list) list.innerHTML = '<div class="af-empty">Search failed. Try again.</div>'; }
}

export function clearFriendSearch() {
  const inp = $('af-search'); if (inp) inp.value = '';
  $('af-clear')?.classList.add('hidden');
  switchAFTab('suggest', $('aftab-suggest'));
  inp?.focus();
}

async function renderSuggested() {
  const list = $('af-suggested-list'); if (!list) return;
  list.innerHTML = '<div class="af-empty">Loading...</div>';
  try {
    const snap = await getDocs(query_(collection(db, 'users'), limit(20)));
    const friendIds = st.allConvs.map(c => c.members.find(m => m !== st.currentUser.uid));
    const suggestions = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== st.currentUser.uid && !friendIds.includes(u.uid)).slice(0, 8);
    if (!suggestions.length) { list.innerHTML = '<div class="af-empty">No suggestions available.</div>'; return; }
    renderAFUserList('af-suggested-list', suggestions);
  } catch { $('af-suggested-list').innerHTML = '<div class="af-empty">Could not load suggestions.</div>'; }
}

async function renderAFUserList(containerId, users) {
  const container = $(containerId); if (!container) return;
  if (!users.length) { container.innerHTML = '<div class="af-empty">No users found.</div>'; return; }
  let pendingTo = new Set();
  try {
    const snap = await getDocs(query_(collection(db, 'friendRequests'),
      where('from', '==', st.currentUser.uid), where('status', '==', 'pending')));
    snap.docs.forEach(d => pendingTo.add(d.data().to));
  } catch (_) {}
  const friendIds = new Set(st.allConvs.map(c => c.members.find(m => m !== st.currentUser.uid)));
  container.innerHTML = '';
  users.forEach(u => {
    const isFriend = friendIds.has(u.uid), isPending = pendingTo.has(u.uid);
    const statusCls = u.status === 'online' ? 'status-online' : u.status === 'away' ? 'status-away' : 'status-offline';
    const statusLbl = u.status === 'online' ? 'Online' : u.status === 'away' ? 'Away' : 'Offline';
    const row = document.createElement('div'); row.className = 'af-user-row'; row.id = `af-row-${u.uid}`;
    let actionHtml;
    if (isFriend)     actionHtml = `<button class="af-btn af-btn--added" onclick="messageExisting('${u.uid}')">Message</button>`;
    else if (isPending) actionHtml = `<button class="af-btn af-btn--pending" disabled>Requested (sent)</button>`;
    else actionHtml = `<button class="af-btn af-btn--add" onclick="sendFriendRequest('${u.uid}','${sanitize(u.name)}','${u.color}')">Add Friend</button>`;
    row.innerHTML = `
      <div class="avatar avatar-sm" style="background:${u.color}">${u.name.charAt(0)}<div class="avatar-status ${statusCls}"></div></div>
      <div class="af-user-info">
        <div class="af-user-name">${sanitize(u.name)}</div>
        <div class="af-user-meta">@${sanitize(u.handle || '')} &nbsp;·&nbsp; <span class="${statusCls}-text">${statusLbl}</span></div>
      </div>
      <div class="af-action" id="af-action-${u.uid}">${actionHtml}</div>`;
    container.appendChild(row);
  });
}

export async function sendFriendRequest(toUid, toName, toColor) {
  const action = $(`af-action-${toUid}`);
  if (action) action.innerHTML = `<button class="af-btn af-btn--pending" disabled>Requested (sent)</button>`;
  try {
    await addDoc(collection(db, 'friendRequests'), {
      from: st.currentUser.uid, to: toUid,
      fromInfo: { name: st.currentProfile.name, color: st.currentProfile.color, handle: st.currentProfile.handle || '' },
      toInfo: { name: toName, color: toColor },
      status: 'pending', createdAt: serverTimestamp(),
    });
    showToast(`Friend request sent to ${toName}!`, 'info');
  } catch (err) {
    showToast('Could not send request: ' + err.message, 'danger');
    if (action) action.innerHTML = `<button class="af-btn af-btn--add" onclick="sendFriendRequest('${toUid}','${toName}','${toColor}')">Add Friend</button>`;
  }
}

export function messageExisting(peerUid) {
  const conv = st.allConvs.find(c => c.members.includes(peerUid));
  if (conv) { closeAddFriend(); openConversation(conv.id); }
}

function renderIncomingRequestsUI() {
  const list = $('af-req-list'); if (!list) return;
  if (!st.incomingRequests.length) { list.innerHTML = '<div class="af-empty">No incoming requests.</div>'; return; }
  list.innerHTML = '';
  st.incomingRequests.forEach(req => {
    const fi = req.fromInfo || {}, col = fi.color || '#6C63FF';
    const row = document.createElement('div'); row.className = 'af-user-row'; row.id = `af-req-row-${req.id}`;
    row.innerHTML = `
      <div class="avatar avatar-sm" style="background:${col}">${(fi.name || '?').charAt(0)}<div class="avatar-status status-online"></div></div>
      <div class="af-user-info">
        <div class="af-user-name">${sanitize(fi.name || 'Unknown')}</div>
        <div class="af-user-meta">@${sanitize(fi.handle || '')} &nbsp;·&nbsp; wants to be friends</div>
      </div>
      <div class="af-req-actions">
        <button class="af-btn af-btn--accept" onclick="acceptRequest('${req.id}','${req.from}')">Accept</button>
        <button class="af-btn af-btn--decline" onclick="declineRequest('${req.id}')">Decline</button>
      </div>`;
    list.appendChild(row);
  });
}

export async function acceptRequest(reqId, fromUid) {
  try {
    await updateDoc(doc(db, 'friendRequests', reqId), { status: 'accepted' });
    const convId  = [st.currentUser.uid, fromUid].sort().join('_');
    const convRef = doc(db, 'conversations', convId);
    let convExists = false;
    try { const ex = await getDoc(convRef); convExists = ex.exists(); } catch (_) {}
    if (!convExists) {
      const peerSnap = await getDoc(doc(db, 'users', fromUid));
      const peer = peerSnap.exists() ? peerSnap.data() : {};
      await setDoc(convRef, {
        members: [st.currentUser.uid, fromUid],
        memberInfo: {
          [st.currentUser.uid]: { name: st.currentProfile.name, color: st.currentProfile.color, about: st.currentProfile.about || '' },
          [fromUid]: { name: peer.name || 'User', color: peer.color || '#6C63FF', about: peer.about || '' },
        },
        lastMessage: '', lastAt: serverTimestamp(),
        unread: { [st.currentUser.uid]: 0, [fromUid]: 0 },
        typing: {}, createdAt: serverTimestamp(),
      });
    }
    st.incomingRequests = st.incomingRequests.filter(r => r.id !== reqId);
    renderIncomingRequestsUI(); updateAFBadge();
    showToast('You are now friends!', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'danger'); }
}

export async function declineRequest(reqId) {
  await updateDoc(doc(db, 'friendRequests', reqId), { status: 'declined' });
  st.incomingRequests = st.incomingRequests.filter(r => r.id !== reqId);
  renderIncomingRequestsUI(); updateAFBadge();
  showToast('Request declined.');
}

// ── MY PROFILE ────────────────────────────────────────────────
export function openMyProfile() {
  const modal = $('my-profile-modal'); if (!modal || !st.currentProfile) return;
  const lgAv = $('my-profile-avatar-lg');
  if (lgAv) { lgAv.textContent = (st.currentProfile.name || '?').charAt(0).toUpperCase(); lgAv.style.background = st.currentProfile.color || '#6C63FF'; }
  $('my-profile-name').textContent  = st.currentProfile.name || '';
  $('my-profile-email').textContent = st.currentUser?.email || '';
  modal.classList.remove('hidden');
}
export function closeMyProfile() { $('my-profile-modal')?.classList.add('hidden'); }

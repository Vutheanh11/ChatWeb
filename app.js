/* ============================================================
   ChatWave �?" app.js  (Firebase Edition)
   All mock data removed. Real Auth + Firestore.
   Firebase SDK v10 loaded via CDN (ES Modules).
   ============================================================ */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile,
  GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getStorage, ref as storageRef,
  uploadBytes, getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { firebaseConfig, giphyApiKey } from './firebase-config.js';

// �"?�"? Firebase init �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
// Explicitly pass the bucket so the SDK never falls back to the wrong URL
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

// �"?�"? Detect page �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const IS_AUTH = !!document.getElementById('form-login');
const IS_CHAT = !!document.getElementById('contact-list');

// �"?�"? Avatar colors (deterministic) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const PALETTE = [
  '#6C63FF','#FF6584','#22c55e','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#f97316',
];
function uidColor(uid) {
  let s = 0;
  for (let i = 0; i < uid.length; i++) s += uid.charCodeAt(i);
  return PALETTE[s % PALETTE.length];
}

// �"?�"? Shared UI helpers �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => (t.className = 'toast'), 3500);
}
function $(id) { return document.getElementById(id); }
function sanitize(s) {
  const m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;' };
  return String(s).replace(/[&<>"']/g, c => m[c]);
}
function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US',
    { hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric' });
}
function applyTheme() {
  const dark = localStorage.getItem('darkMode') === '1';
  document.body.classList.toggle('dark', dark);
  const t = $('dark-toggle');
  if (t) t.checked = dark;
}

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// ================  AUTH PAGE  ================================
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if (IS_AUTH) {
  applyTheme();

  // Redirect to chat if already signed in
  onAuthStateChanged(auth, user => {
    if (user) window.location.href = 'chat.html';
  });

  // Password strength
  document.getElementById('reg-password')
    ?.addEventListener('input', e => checkStrength(e.target.value));
}

function switchTab(tab) {
  $('tab-login').classList.toggle('active', tab === 'login');
  $('tab-register').classList.toggle('active', tab === 'register');
  $('form-login').classList.toggle('hidden', tab !== 'login');
  $('form-register').classList.toggle('hidden', tab !== 'register');
}

async function login() {
  const email = $('login-email').value.trim();
  const pass  = $('login-password').value;
  if (!email || !pass) { showToast('Please fill in all fields.', 'danger'); return; }

  const btn = $('btn-login');
  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will redirect
  } catch (err) {
    btn.textContent = 'Sign In'; btn.disabled = false;
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

async function register() {
  const name  = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const pass  = $('reg-password').value;
  if (!name || !email || !pass) { showToast('Please fill in all fields.', 'danger'); return; }
  if (pass.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return; }

  const btn = $('btn-register');
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(user, { displayName: name });
    await createUserProfile(user, name);
    // onAuthStateChanged handles redirect
  } catch (err) {
    btn.textContent = 'Create Account'; btn.disabled = false;
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  try {
    const { user } = await signInWithPopup(auth, provider);
    // Create profile if first time
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await createUserProfile(user, user.displayName || 'User');
    }
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast(friendlyAuthError(err.code), 'danger');
    }
  }
}

async function forgotPassword(e) {
  e && e.preventDefault();
  const email = $('login-email').value.trim();
  if (!email) {
    showToast('Enter your email above first.', 'warning');
    $('login-email').focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Reset email sent! Check your inbox.', 'success');
  } catch (err) {
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

async function createUserProfile(user, name) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '') +
    Math.floor(Math.random() * 9000 + 1000);
  await setDoc(doc(db, 'users', user.uid), {
    name,
    nameLower: name.toLowerCase(),
    handle,
    email: user.email || '',
    color: uidColor(user.uid),
    about: 'Hey there! I\'m using ChatWave.',
    status: 'online',
    createdAt: serverTimestamp(),
  });
}

function checkStrength(pass) {
  const fill  = $('strength-fill');
  const label = $('strength-label');
  if (!fill) return;
  let score = 0;
  if (pass.length >= 8)            score++;
  if (/[A-Z]/.test(pass))          score++;
  if (/[0-9]/.test(pass))          score++;
  if (/[^A-Za-z0-9]/.test(pass))  score++;
  const lvl = [
    { w:'0%',   bg:'transparent', tx:'' },
    { w:'25%',  bg:'#ef4444',     tx:'Weak' },
    { w:'50%',  bg:'#f59e0b',     tx:'Fair' },
    { w:'75%',  bg:'#3b82f6',     tx:'Good' },
    { w:'100%', bg:'#22c55e',     tx:'Strong' },
  ][Math.min(score, 4)];
  fill.style.width      = lvl.w;
  fill.style.background = lvl.bg;
  label.textContent     = lvl.tx;
  label.style.color     = lvl.bg;
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/invalid-email':        'Invalid email address.',
    'auth/weak-password':        'Password is too weak.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/invalid-credential':   'Invalid email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

function togglePassword(id, btn) {
  const input = $(id);
  if (!input) return;
  const show = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.style.color = show ? 'var(--primary)' : '';
}

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// ================  CHAT PAGE  ================================
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

// �"?�"? State �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
let currentUser    = null;   // Firebase Auth user
let currentProfile = null;   // Firestore user doc
let activeConvId   = null;   // Active conversation Firestore ID
let activePeer     = null;   // Other user's profile data
let allConvs       = [];     // All conversations for current user
let convFilter     = 'all';  // sidebar filter
let typingTimer    = null;

// Unsubscribe handles
let unsubConvs      = null;
let unsubMsgs       = null;
let unsubReqs       = null;
let unsubPeerStatus = null;  // watches peer user doc for online status

// Emoji set
const EMOJIS = [
  '\uD83D\uDE00','\uD83D\uDE02','\uD83D\uDE0D','\uD83E\uDD70','\uD83D\uDE0E',
  '\uD83E\uDD14','\uD83D\uDE2D','\uD83D\uDE05','\uD83D\uDD25','\uD83D\uDC4D',
  '\u2764\uFE0F','\uD83C\uDF89','\u2728','\uD83D\uDE80','\uD83C\uDFA8',
  '\uD83D\uDCA1','\uD83D\uDE4C','\uD83D\uDE0A','\uD83E\uDD23','\uD83D\uDE0F',
  '\uD83D\uDE34','\uD83E\uDD73','\uD83D\uDCAA','\uD83D\uDC4B','\uD83C\uDF1F',
  '\uD83D\uDCAF','\uD83D\uDE4F','\uD83D\uDE22','\uD83E\uDD29','\uD83D\uDE06',
];

// �"?�"? CHAT INIT �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
if (IS_CHAT) {
  applyTheme();

  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;

    // Load or create user profile
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      await createUserProfile(user, user.displayName || user.email.split('@')[0]);
      currentProfile = (await getDoc(doc(db, 'users', user.uid))).data();
    } else {
      currentProfile = snap.data();
    }

    // Mark online
    await updateDoc(doc(db, 'users', user.uid), { status: 'online' });

    // Render my info in sidebar
    $('my-name').textContent = currentProfile.name;
    refreshMyAvatar();

    // Set up emoji picker
    buildEmojiPicker();

    // Subscribe to conversations
    subscribeConversations();

    // Subscribe to incoming friend requests (badge)
    subscribeIncomingRequests();

    // Request browser notification permission
    initNotifications();

    // Close dropdown on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.chat-actions'))
        $('dropdown-menu')?.classList.add('hidden');
      if (e.target.id === 'new-chat-modal')    closeNewChat();
      if (e.target.id === 'settings-modal')    closeSettings();
      if (e.target.id === 'add-friend-modal')  closeAddFriend();
      if (e.target.id === 'my-profile-modal')  closeMyProfile();
    });

    // Profile panel on avatar double-click
    $('chat-avatar')?.addEventListener('dblclick',
      () => $('profile-panel')?.classList.remove('hidden'));
  });

  // Mark offline on unload
  window.addEventListener('beforeunload', () => {
    if (currentUser)
      updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' });
    if (unsubConvs)      unsubConvs();
    if (unsubMsgs)       unsubMsgs();
    if (unsubReqs)       unsubReqs();
    if (unsubPeerStatus) unsubPeerStatus();
  });
}

// �"?�"? CONVERSATIONS LIST �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function subscribeConversations() {
  const q = query(
    collection(db, 'conversations'),
    where('members', 'array-contains', currentUser.uid)
  );
  unsubConvs = onSnapshot(q, snap => {
    allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by lastAt desc client-side (avoids composite index requirement)
    allConvs.sort((a, b) => {
      const ta = a.lastAt?.seconds || 0;
      const tb = b.lastAt?.seconds || 0;
      return tb - ta;
    });
    renderConvList(getFilteredConvs(''));
  });
}

function getFilteredConvs(query) {
  let list = [...allConvs];
  const uid = currentUser.uid;
  if (convFilter === 'unread')
    list = list.filter(c => (c.unread?.[uid] || 0) > 0);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(c => {
      const peer = getPeerInfo(c);
      return peer.name.toLowerCase().includes(q);
    });
  }
  return list;
}

function getPeerInfo(conv) {
  const uid = currentUser.uid;
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
  const uid = currentUser.uid;
  convs.forEach(conv => {
    const peer    = getPeerInfo(conv);
    const unread  = conv.unread?.[uid] || 0;
    const lastMsg = conv.lastMessage || 'Start a conversation';
    const lastTime = conv.lastAt ? fmtTime(conv.lastAt) : '';
    const isActive = conv.id === activeConvId;

    const item = document.createElement('div');
    item.className = `contact-item${isActive ? ' active' : ''}`;
    item.dataset.id = conv.id;
    item.innerHTML = `
      <div class="avatar" style="background:${peer.color}">
        ${peer.name.charAt(0)}
        <div class="avatar-status status-online"></div>
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

function filterContacts(q) {
  renderConvList(getFilteredConvs(q));
}

function filterTab(type, btn) {
  convFilter = type;
  document.querySelectorAll('.snav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderConvList(getFilteredConvs($('search-input')?.value || ''));
}

// �"?�"? OPEN CONVERSATION �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function openConversation(convId) {
  activeConvId = convId;
  const conv   = allConvs.find(c => c.id === convId);
  if (!conv) return;

  const uid    = currentUser.uid;
  const peerId = conv.members.find(m => m !== uid);
  const peer   = getPeerInfo(conv);
  activePeer   = { uid: peerId, ...peer };

  // Mark unread = 0
  if ((conv.unread?.[uid] || 0) > 0) {
    await updateDoc(doc(db, 'conversations', convId), {
      [`unread.${uid}`]: 0,
    });
  }

  // UI
  $('empty-state').classList.add('hidden');
  $('conversation').classList.remove('hidden');

  $('chat-avatar').textContent    = peer.name.charAt(0);
  $('chat-avatar').style.background = peer.color;
  $('chat-peer-name').textContent = peer.name;
  $('chat-peer-status').textContent = '...';
  $('chat-peer-status').style.color = 'var(--text-muted)';

  // Profile panel
  $('pp-avatar').textContent    = peer.name.charAt(0);
  $('pp-avatar').style.background = peer.color;
  $('pp-name').textContent   = peer.name;
  $('pp-status').textContent = '...';
  $('pp-about').textContent  = peer.about || 'Hey there! I\'m using ChatWave.';
  $('pp-media').innerHTML = ['\uD83D\uDCF7','\uD83D\uDDBC\uFE0F','\uD83D\uDCC4','\uD83C\uDFB5','\uD83D\uDCF9','\uD83D\uDCCA'].map(e => `<div class="media-thumb">${e}</div>`).join('');

  // Update active state in list
  document.querySelectorAll('.contact-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === convId));

  // Subscribe to peer's real-time online status
  subscribePeerStatus(peerId);

  // Subscribe to messages
  subscribeMessages(convId);

  // Mobile
  $('sidebar')?.classList.add('hidden-mobile');
}

// �"?�"? MESSAGES �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function subscribeMessages(convId) {
  if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  $('messages-area').innerHTML = '';
  let knownCount = 0;  // track to detect truly new messages vs. initial load

  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  unsubMsgs = onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Show notification for new messages from peer
    if (msgs.length > knownCount) {
      const newMsgs = msgs.slice(knownCount);
      newMsgs.forEach(m => {
        if (m.from !== currentUser.uid) {
          const notifBody = m.type === 'image' ? 'Sent an image' :
                            m.type === 'gif'   ? 'Sent a GIF'   : m.text;
          showBrowserNotification(
            activePeer?.name || 'New Message',
            notifBody,
            null
          );
        }
      });
    }
    knownCount = msgs.length;
    renderMessages(msgs);
  });
}

function renderMessages(msgs) {
  const area = $('messages-area');
  if (!area) return;
  const uid = currentUser.uid;

  area.innerHTML = '';
  let lastDate = '';
  let lastFrom = '';

  msgs.forEach(m => {
    const dateLabel = m.sentAt ? fmtDate(m.sentAt) : 'Today';
    if (dateLabel !== lastDate) {
      const div = document.createElement('div');
      div.className   = 'msg-date-divider';
      div.textContent = dateLabel;
      area.appendChild(div);
      lastDate = dateLabel;
      lastFrom = '';
    }

    const isMe   = m.from === uid;
    const isCont = m.from === lastFrom;
    const time   = m.sentAt ? fmtTime(m.sentAt) : '';
    const mtype  = m.type || 'text';

    const row = document.createElement('div');
    row.className = `msg-row${isMe ? ' me' : ''}${isCont ? ' continuation' : ''}`;

    const avatarHtml = (!isMe && !isCont)
      ? `<div class="avatar avatar-xs" style="background:${activePeer?.color || '#6C63FF'}">${(activePeer?.name || '?').charAt(0)}</div>`
      : '<div class="msg-avatar-slot"></div>';

    let bodyHtml;
    if (mtype === 'image') {
      bodyHtml = `<img class="msg-image" src="${m.imageUrl}" alt="Image" loading="lazy" onclick="openLightbox('${m.imageUrl}')"/>`;
    } else if (mtype === 'gif') {
      bodyHtml = `<img class="msg-gif" src="${m.gifUrl}" alt="GIF" loading="lazy"/>`;
    } else {
      bodyHtml = sanitize(m.text);
    }

    row.innerHTML = `
      ${avatarHtml}
      <div class="bubble">
        ${bodyHtml}
        <div class="bubble-footer">
          <span class="msg-time">${time}</span>
          ${isMe ? '<span class="read-receipt">&#10003;&#10003;</span>' : ''}
        </div>
      </div>`;
    area.appendChild(row);
    lastFrom = m.from;
  });

  requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
}

// �"?�"? SEND MESSAGE �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function sendMessage() {
  if (!activeConvId || !currentUser) return;
  const box  = $('message-box');
  const text = box.innerText.trim();
  if (!text) return;
  box.innerText = '';
  box.focus();

  try {
    const convRef = doc(db, 'conversations', activeConvId);
    // Add message
    await addDoc(collection(db, 'conversations', activeConvId, 'messages'), {
      from:   currentUser.uid,
      text,
      sentAt: serverTimestamp(),
    });

    // Update conversation meta
    const peerId = activePeer?.uid;
    const update = {
      lastMessage: text,
      lastAt:      serverTimestamp(),
      lastFrom:    currentUser.uid,
    };
    if (peerId) update[`unread.${peerId}`] = (allConvs.find(c => c.id === activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(convRef, update);

    // Stop typing indicator
    clearTypingIndicator();
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'danger');
  }
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── IMAGE UPLOAD ───────────────────────────────────────────
function triggerImageUpload() {
  $('image-file-input')?.click();
}

async function handleImageFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Only image files allowed.', 'warning'); return; }
  if (file.size > 10 * 1024 * 1024)   { showToast('Image must be under 10 MB.', 'warning'); return; }
  if (!activeConvId) { showToast('Open a conversation first.', 'warning'); return; }
  input.value = '';

  const btn = $('image-upload-btn');
  if (btn) btn.style.opacity = '0.4';
  showToast('Uploading image...', 'info');

  try {
    const ext      = file.name.split('.').pop().toLowerCase();
    const filename = `${Date.now()}_${currentUser.uid}.${ext}`;
    const sRef     = storageRef(storage, `chatImages/${activeConvId}/${filename}`);
    console.log('[Storage] uploading to', sRef.fullPath);
    const snap     = await uploadBytes(sRef, file);
    const url      = await getDownloadURL(snap.ref);

    await addDoc(collection(db, 'conversations', activeConvId, 'messages'), {
      from:     currentUser.uid,
      type:     'image',
      imageUrl: url,
      text:     '[Image]',
      sentAt:   serverTimestamp(),
    });

    const peerId = activePeer?.uid;
    const upd = { lastMessage: '[Image]', lastAt: serverTimestamp(), lastFrom: currentUser.uid };
    if (peerId) upd[`unread.${peerId}`] = (allConvs.find(c => c.id === activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(doc(db, 'conversations', activeConvId), upd);
  } catch (err) {
    console.error('[Image upload]', err);
    showToast('Upload failed: ' + err.message, 'danger');
  } finally {
    if (btn) btn.style.opacity = '1';
  }
}

// Image lightbox
function openLightbox(url) {
  let box = $('lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lightbox';
    box.className = 'lightbox';
    box.innerHTML = `<div class="lightbox-inner">
      <button class="lightbox-close" onclick="closeLightbox()">&#x2715;</button>
      <img id="lightbox-img" src="" alt="Full size"/>
    </div>`;
    box.addEventListener('click', e => { if (e.target === box) closeLightbox(); });
    document.body.appendChild(box);
  }
  $('lightbox-img').src = url;
  box.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  $('lightbox')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── GIF PICKER ──────────────────────────────────────────────
let gifSearchTimer = null;

function toggleGifPicker() {
  const panel = $('gif-picker');
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  $('emoji-picker')?.classList.add('hidden');
  loadGifs('');
}

function closeGifPicker() {
  $('gif-picker')?.classList.add('hidden');
}

// Fetch wrapper that auto-falls back to a CORS proxy if direct call is blocked
async function fetchWithCORSFallback(url) {
  const opts = { mode: 'cors', credentials: 'omit' };
  try {
    const res = await fetch(url, opts);
    // Some proxies return 200 wrapping a non-OK body — let caller check
    return res;
  } catch (_networkErr) {
    // Direct call blocked (CORS / firewall). Try via open CORS proxy.
    console.warn('[GIF] Direct fetch blocked, retrying via CORS proxy…');
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    return fetch(proxy, { credentials: 'omit' });
  }
}

async function loadGifs(searchQuery) {
  const grid = $('gif-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="gif-loading">Loading…</div>';

  const key = (giphyApiKey || '').trim();
  if (!key || key === 'YOUR_GIPHY_API_KEY_HERE') {
    grid.innerHTML = '<div class="gif-loading">Add your Giphy API key to <b>firebase-config.js</b></div>';
    return;
  }

  const q = searchQuery.trim();
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=20&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=20&rating=g`;

  try {
    const res  = await fetchWithCORSFallback(url);
    if (!res.ok) {
      const errText = await res.text().catch(() => String(res.status));
      grid.innerHTML = `<div class="gif-loading">Giphy error ${res.status}<br><small>${errText.slice(0,120)}</small></div>`;
      console.error('[GIF]', res.status, errText);
      return;
    }
    const json = await res.json();
    if (!json.data?.length) { grid.innerHTML = '<div class="gif-loading">No GIFs found.</div>'; return; }

    grid.innerHTML = '';
    json.data.forEach(gif => {
      const preview = gif.images?.fixed_height_small?.url || gif.images?.downsized?.url || '';
      const full    = gif.images?.original?.url || preview;
      const img     = document.createElement('img');
      img.className = 'gif-thumb';
      img.src       = preview;
      img.alt       = gif.title || 'GIF';
      img.loading   = 'lazy';
      img.onclick   = () => sendGif(full, preview);
      grid.appendChild(img);
    });
  } catch (err) {
    console.error('[GIF fetch error]', err);
    grid.innerHTML = `<div class="gif-loading">Failed to load GIFs:<br><small>${err.message}</small></div>`;
  }
}

function onGifSearchInput(query) {
  clearTimeout(gifSearchTimer);
  gifSearchTimer = setTimeout(() => loadGifs(query), 400);
}

async function sendGif(gifUrl, previewUrl) {
  if (!activeConvId) return;
  closeGifPicker();

  try {
    await addDoc(collection(db, 'conversations', activeConvId, 'messages'), {
      from:       currentUser.uid,
      type:       'gif',
      gifUrl:     gifUrl,
      previewUrl: previewUrl,
      text:       '[GIF]',
      sentAt:     serverTimestamp(),
    });
    const peerId = activePeer?.uid;
    const upd = { lastMessage: '[GIF]', lastAt: serverTimestamp(), lastFrom: currentUser.uid };
    if (peerId) upd[`unread.${peerId}`] = (allConvs.find(c => c.id === activeConvId)?.unread?.[peerId] || 0) + 1;
    await updateDoc(doc(db, 'conversations', activeConvId), upd);
  } catch (err) {
    showToast('Failed to send GIF: ' + err.message, 'danger');
  }
}

// ── PEER REAL-TIME STATUS ────────────────────────────────────
function subscribePeerStatus(peerUid) {
  if (unsubPeerStatus) { unsubPeerStatus(); unsubPeerStatus = null; }
  unsubPeerStatus = onSnapshot(doc(db, 'users', peerUid), snap => {
    if (!snap.exists()) return;
    const data   = snap.data();
    const online = data.status === 'online';

    // Update chat header
    const statusEl = $('chat-peer-status');
    if (statusEl) {
      statusEl.textContent  = online ? 'Online' : 'Offline';
      statusEl.style.color  = online ? 'var(--success)' : 'var(--text-muted)';
    }

    // Update header avatar dot
    const dot = document.querySelector('.chat-peer-dot');
    if (dot) {
      dot.className = `avatar-status ${online ? 'status-online' : 'status-offline'} chat-peer-dot`;
    }

    // Update sidebar list item dot for this peer
    const convDoc = allConvs.find(c => c.members?.includes(peerUid));
    if (convDoc) {
      const item = document.querySelector(`.contact-item[data-id="${convDoc.id}"] .avatar-status`);
      if (item) item.className = `avatar-status ${online ? 'status-online' : 'status-offline'}`;
    }
  });
}

// ── BROWSER NOTIFICATIONS ────────────────────────────────────
async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function showBrowserNotification(title, body, iconUrl) {
  if (document.hasFocus()) return;                      // only when tab is hidden
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: iconUrl || '/favicon.ico',
    badge: '/favicon.ico',
  });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 6000);
}

// �"?�"? TYPING INDICATOR �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function onTyping() {
  if (!activeConvId || !currentUser) return;
  // Set typing = true in Firestore
  updateDoc(doc(db, 'conversations', activeConvId), {
    [`typing.${currentUser.uid}`]: true,
  }).catch(() => {});
  // Clear after 3s
  clearTimeout(typingTimer);
  typingTimer = setTimeout(clearTypingIndicator, 3000);
}

function clearTypingIndicator() {
  if (!activeConvId || !currentUser) return;
  updateDoc(doc(db, 'conversations', activeConvId), {
    [`typing.${currentUser.uid}`]: false,
  }).catch(() => {});
}

// �"?�"? CLEAR CHAT (local UI only) �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function clearChat() {
  $('messages-area').innerHTML = '';
  $('dropdown-menu')?.classList.add('hidden');
  showToast('Chat cleared locally.', 'info');
}

// �"?�"? CHAT SEARCH  �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function toggleChatSearch() {
  const bar = $('chat-search-bar');
  bar?.classList.toggle('hidden');
  if (!bar?.classList.contains('hidden')) bar?.querySelector('input').focus();
}
function searchMessages(q) {
  $('messages-area')?.querySelectorAll('.bubble').forEach(b => {
    b.style.opacity = (!q || b.innerText.toLowerCase().includes(q.toLowerCase()))
      ? '1' : '.25';
  });
}

function toggleDropdown() { $('dropdown-menu')?.classList.toggle('hidden'); }

// �"?�"? EMOJI PICKER �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function buildEmojiPicker() {
  const grid = $('emoji-grid');
  if (!grid) return;
  EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.onclick = () => {
      const box = $('message-box');
      box?.focus();
      document.execCommand('insertText', false, emoji);
      $('emoji-picker')?.classList.add('hidden');
    };
    grid.appendChild(btn);
  });
}
function toggleEmojiPicker() { $('emoji-picker')?.classList.toggle('hidden'); }

// �"?�"? NEW CHAT MODAL �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// "New Chat" opens the friend list (users who share a conv)
async function openNewChat() {
  const modal = $('new-chat-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const list = $('modal-user-list');
  list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:13px">Loading...</p>';

  // Gather peer UIDs from existing conversations
  const peerIds = allConvs.map(c => c.members.find(m => m !== currentUser.uid));
  if (!peerIds.length) {
    list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:13px">No contacts yet. Add friends first!</p>';
    return;
  }
  // Fetch peer profiles
  const peers = await Promise.all(peerIds.map(async uid => {
    const s = await getDoc(doc(db, 'users', uid));
    return s.exists() ? { uid, ...s.data() } : null;
  }));
  renderModalUsers(peers.filter(Boolean));
}

function closeNewChat() { $('new-chat-modal')?.classList.add('hidden'); }

function filterModal(q) {
  const peerIds = allConvs.map(c => c.members.find(m => m !== currentUser.uid));
  // We already rendered users; just filter DOM
  $('modal-user-list')?.querySelectorAll('.modal-user-item').forEach(el => {
    el.style.display = el.dataset.name?.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function renderModalUsers(users) {
  const ul = $('modal-user-list');
  if (!ul) return;
  ul.innerHTML = '';
  users.forEach(u => {
    const conv = allConvs.find(c => c.members.includes(u.uid));
    const item = document.createElement('div');
    item.className = 'modal-user-item';
    item.dataset.name = u.name;
    item.innerHTML = `
      <div class="avatar avatar-sm" style="background:${u.color}">${u.name.charAt(0)}</div>
      <div>
        <div class="user-name">${sanitize(u.name)}</div>
        <div class="user-handle">@${sanitize(u.handle || '')}</div>
      </div>`;
    item.onclick = () => {
      closeNewChat();
      if (conv) openConversation(conv.id);
    };
    ul.appendChild(item);
  });
}

// �"?�"? PROFILE PANEL �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function closeProfilePanel() { $('profile-panel')?.classList.add('hidden'); }

// �"?�"? SETTINGS �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function openSettings() {
  const modal = $('settings-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const t = $('dark-toggle');
  if (t) t.checked = document.body.classList.contains('dark');
}
function closeSettings() { $('settings-modal')?.classList.add('hidden'); }
function toggleDark(checkbox) {
  document.body.classList.toggle('dark', checkbox.checked);
  localStorage.setItem('darkMode', checkbox.checked ? '1' : '0');
}

// �"?�"? MOBILE �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function closeMobileChat() {
  $('conversation')?.classList.add('hidden');
  $('empty-state')?.classList.remove('hidden');
  $('sidebar')?.classList.remove('hidden-mobile');
  if (unsubMsgs) { unsubMsgs(); unsubMsgs = null; }
  activeConvId = null; activePeer = null;
}

// �"?�"? LOGOUT �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function logout() {
  if (currentUser)
    await updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' });
  await signOut(auth);
  window.location.href = 'index.html';
}

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// ================  ADD FRIEND  ===============================
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

let afSearchTimer   = null;
let incomingRequests = [];  // cached incoming request docs

// Real-time listener for incoming requests badge
function subscribeIncomingRequests() {
  if (unsubReqs) unsubReqs();
  const q = query(
    collection(db, 'friendRequests'),
    where('to', '==', currentUser.uid),
    where('status', '==', 'pending')
  );
  unsubReqs = onSnapshot(q, snap => {
    incomingRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateAFBadge();
  }, err => {
    // If index not yet created, silently skip
    console.warn('friendRequests index needed:', err.message);
  });
}

function updateAFBadge() {
  const count  = incomingRequests.length;
  const badge  = $('af-badge');
  const bar    = $('af-requests-bar');
  const cnt    = $('af-req-count');
  if (badge) { badge.textContent = count; badge.classList.toggle('hidden', !count); }
  if (bar)   bar.classList.toggle('hidden', !count);
  if (cnt)   cnt.textContent = count;
}

async function openAddFriend() {
  const modal = $('add-friend-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  clearFriendSearch();
  switchAFTab('suggest', $('aftab-suggest'));
  await renderSuggested();
  renderIncomingRequestsUI();
  updateAFBadge();
  setTimeout(() => $('af-search')?.focus(), 80);
}

function closeAddFriend() { $('add-friend-modal')?.classList.add('hidden'); }

function switchAFTab(tab, btn) {
  document.querySelectorAll('.af-tab').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  document.querySelectorAll('.af-panel').forEach(p => p.classList.add('hidden'));
  $('afpanel-' + tab)?.classList.remove('hidden');
}

function viewRequests() { switchAFTab('requests', $('aftab-requests')); }

// �"?�"? Search friends by name �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function searchFriends(query) {
  const clearBtn = $('af-clear');
  clearBtn?.classList.toggle('hidden', !query);
  clearTimeout(afSearchTimer);
  afSearchTimer = setTimeout(async () => {
    if (!query.trim()) {
      switchAFTab('suggest', $('aftab-suggest'));
      return;
    }
    switchAFTab('results', $('aftab-results'));
    await runFriendSearch(query.trim());
  }, 300);
}

async function runFriendSearch(query) {
  const label = $('af-results-label');
  const list  = $('af-results-list');
  if (list) list.innerHTML = '<div class="af-empty">Searching...</div>';

  try {
    const q = query.toLowerCase();
    // Prefix search on nameLower
    const snap = await getDocs(
      query_(
        collection(db, 'users'),
        where('nameLower', '>=', q),
        where('nameLower', '<=', q + '\uf8ff'),
        limit(15)
      )
    );
    const results = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== currentUser.uid);

    if (label) label.textContent = results.length
      ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
      : `No users found for "${query}"`;

    renderAFUserList('af-results-list', results);
  } catch (err) {
    if (list) list.innerHTML = '<div class="af-empty">Search failed. Try again.</div>';
    console.error(err);
  }
}

// We shadow the 'query' import with a local param �?" use alias
const query_ = query;

function clearFriendSearch() {
  const inp = $('af-search');
  if (inp) inp.value = '';
  $('af-clear')?.classList.add('hidden');
  switchAFTab('suggest', $('aftab-suggest'));
  inp?.focus();
}

// �"?�"? Suggested users �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function renderSuggested() {
  const list = $('af-suggested-list');
  if (!list) return;
  list.innerHTML = '<div class="af-empty">Loading...</div>';

  try {
    const snap = await getDocs(
      query_(collection(db, 'users'), limit(20))
    );
    // Exclude self and already-friends (users who share a conv)
    const friendIds = allConvs.map(c => c.members.find(m => m !== currentUser.uid));
    const suggestions = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== currentUser.uid && !friendIds.includes(u.uid))
      .slice(0, 8);

    if (!suggestions.length) {
      list.innerHTML = '<div class="af-empty">No suggestions available.</div>';
      return;
    }
    renderAFUserList('af-suggested-list', suggestions);
  } catch (err) {
    list.innerHTML = '<div class="af-empty">Could not load suggestions.</div>';
  }
}

// �"?�"? Render a list of users in Add Friend modal �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function renderAFUserList(containerId, users) {
  const container = $(containerId);
  if (!container) return;
  if (!users.length) {
    container.innerHTML = '<div class="af-empty">No users found.</div>';
    return;
  }

  // Get outgoing pending requests from this user
  let pendingTo = new Set();
  try {
    const snap = await getDocs(
      query_(
        collection(db, 'friendRequests'),
        where('from', '==', currentUser.uid),
        where('status', '==', 'pending')
      )
    );
    snap.docs.forEach(d => pendingTo.add(d.data().to));
  } catch (_) {}

  const friendIds = new Set(
    allConvs.map(c => c.members.find(m => m !== currentUser.uid))
  );

  container.innerHTML = '';
  users.forEach(u => {
    const isFriend  = friendIds.has(u.uid);
    const isPending = pendingTo.has(u.uid);
    const statusCls = u.status === 'online' ? 'status-online'
                    : u.status === 'away'   ? 'status-away' : 'status-offline';
    const statusLbl = u.status === 'online' ? 'Online'
                    : u.status === 'away'   ? 'Away' : 'Offline';

    const row = document.createElement('div');
    row.className = 'af-user-row';
    row.id = `af-row-${u.uid}`;

    let actionHtml;
    if (isFriend) {
      actionHtml = `<button class="af-btn af-btn--added" onclick="messageExisting('${u.uid}')">Message</button>`;
    } else if (isPending) {
      actionHtml = `<button class="af-btn af-btn--pending" disabled>Requested (sent)</button>`;
    } else {
      actionHtml = `<button class="af-btn af-btn--add" onclick="sendFriendRequest('${u.uid}','${sanitize(u.name)}','${u.color}')">Add Friend</button>`;
    }

    row.innerHTML = `
      <div class="avatar avatar-sm" style="background:${u.color}">
        ${u.name.charAt(0)}
        <div class="avatar-status ${statusCls}"></div>
      </div>
      <div class="af-user-info">
        <div class="af-user-name">${sanitize(u.name)}</div>
        <div class="af-user-meta">@${sanitize(u.handle || '')} &nbsp;&middot;&nbsp;
          <span class="${statusCls}-text">${statusLbl}</span></div>
      </div>
      <div class="af-action" id="af-action-${u.uid}">${actionHtml}</div>`;
    container.appendChild(row);
  });
}

// �"?�"? Send friend request �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
async function sendFriendRequest(toUid, toName, toColor) {
  // Update button immediately
  const action = $(`af-action-${toUid}`);
  if (action) action.innerHTML =
    `<button class="af-btn af-btn--pending" disabled>Requested (sent)</button>`;

  try {
    await addDoc(collection(db, 'friendRequests'), {
      from: currentUser.uid,
      to:   toUid,
      fromInfo: {
        name:  currentProfile.name,
        color: currentProfile.color,
        handle: currentProfile.handle || '',
      },
      toInfo: { name: toName, color: toColor },
      status:    'pending',
      createdAt: serverTimestamp(),
    });
    showToast(`Friend request sent to ${toName}!`, 'info');
  } catch (err) {
    showToast('Could not send request: ' + err.message, 'danger');
    if (action) action.innerHTML =
      `<button class="af-btn af-btn--add" onclick="sendFriendRequest('${toUid}','${toName}','${toColor}')">Add Friend</button>`;
  }
}

// Message an existing friend (find their conversation)
function messageExisting(peerUid) {
  const conv = allConvs.find(c => c.members.includes(peerUid));
  if (conv) { closeAddFriend(); openConversation(conv.id); }
}

// �"?�"? Incoming requests UI �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
function renderIncomingRequestsUI() {
  const list = $('af-req-list');
  if (!list) return;
  if (!incomingRequests.length) {
    list.innerHTML = '<div class="af-empty">No incoming requests.</div>';
    return;
  }
  list.innerHTML = '';
  incomingRequests.forEach(req => {
    const fi = req.fromInfo || {};
    const col = fi.color || '#6C63FF';
    const row = document.createElement('div');
    row.className = 'af-user-row';
    row.id = `af-req-row-${req.id}`;
    row.innerHTML = `
      <div class="avatar avatar-sm" style="background:${col}">
        ${(fi.name || '?').charAt(0)}
        <div class="avatar-status status-online"></div>
      </div>
      <div class="af-user-info">
        <div class="af-user-name">${sanitize(fi.name || 'Unknown')}</div>
        <div class="af-user-meta">@${sanitize(fi.handle || '')} &nbsp;&middot;&nbsp; wants to be friends</div>
      </div>
      <div class="af-req-actions">
        <button class="af-btn af-btn--accept" onclick="acceptRequest('${req.id}','${req.from}')">Accept</button>
        <button class="af-btn af-btn--decline" onclick="declineRequest('${req.id}')">Decline</button>
      </div>`;
    list.appendChild(row);
  });
}

async function acceptRequest(reqId, fromUid) {
  try {
    // Update request status
    await updateDoc(doc(db, 'friendRequests', reqId), { status: 'accepted' });

    // Create conversation between the two users
    const convId = [currentUser.uid, fromUid].sort().join('_');
    const convRef = doc(db, 'conversations', convId);
    const existing = await getDoc(convRef);
    if (!existing.exists()) {
      // Fetch the other user's profile
      const peerSnap = await getDoc(doc(db, 'users', fromUid));
      const peer = peerSnap.exists() ? peerSnap.data() : {};
      await setDoc(convRef, {
        members: [currentUser.uid, fromUid],
        memberInfo: {
          [currentUser.uid]: {
            name:  currentProfile.name,
            color: currentProfile.color,
            about: currentProfile.about || '',
          },
          [fromUid]: {
            name:  peer.name || 'User',
            color: peer.color || '#6C63FF',
            about: peer.about || '',
          },
        },
        lastMessage: '',
        lastAt:      serverTimestamp(),
        unread:      { [currentUser.uid]: 0, [fromUid]: 0 },
        typing:      {},
        createdAt:   serverTimestamp(),
      });
    }

    // Remove from local cache + re-render
    incomingRequests = incomingRequests.filter(r => r.id !== reqId);
    renderIncomingRequestsUI();
    updateAFBadge();
    showToast('You are now friends!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'danger');
  }
}

async function declineRequest(reqId) {
  await updateDoc(doc(db, 'friendRequests', reqId), { status: 'declined' });
  incomingRequests = incomingRequests.filter(r => r.id !== reqId);
  renderIncomingRequestsUI();
  updateAFBadge();
  showToast('Request declined.');
}

// ── MY PROFILE & AVATAR ────────────────────────────────────────────────────
function refreshMyAvatar() {
  const av = $('my-avatar');
  if (!av) return;
  if (currentProfile?.photoURL) {
    av.textContent = '';
    av.style.background = 'transparent';
    if (!av.querySelector('img')) {
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      av.appendChild(img);
    }
    av.querySelector('img').src = currentProfile.photoURL;
  } else {
    av.innerHTML = (currentProfile?.name || '?').charAt(0).toUpperCase();
    av.style.background = currentProfile?.color || '#6C63FF';
  }
}

function openMyProfile() {
  const modal = $('my-profile-modal');
  if (!modal || !currentProfile) return;

  // Large avatar
  const lgAv = $('my-profile-avatar-lg');
  if (currentProfile.photoURL) {
    lgAv.innerHTML = `<img src="${currentProfile.photoURL}" alt="avatar"/>`;
    lgAv.style.background = 'transparent';
  } else {
    lgAv.textContent = (currentProfile.name || '?').charAt(0).toUpperCase();
    lgAv.style.background = currentProfile.color || '#6C63FF';
  }

  $('my-profile-name').textContent  = currentProfile.name || '';
  $('my-profile-email').textContent = currentUser?.email || '';
  modal.classList.remove('hidden');
}

function closeMyProfile() {
  $('my-profile-modal')?.classList.add('hidden');
}

function triggerAvatarUpload() {
  $('avatar-file-input')?.click();
}

async function handleAvatarFileSelected(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'warning'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'warning'); return; }

  showToast('Uploading avatar…', 'info');
  try {
    const ext  = file.name.split('.').pop();
    const ref  = storageRef(storage, `avatars/${currentUser.uid}/avatar.${ext}`);
    await uploadBytes(ref, file);
    const url  = await getDownloadURL(ref);

    // Persist
    await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: url });
    await updateProfile(currentUser, { photoURL: url });
    currentProfile.photoURL = url;

    // Refresh UI
    refreshMyAvatar();
    openMyProfile();          // refresh modal avatar
    showToast('Avatar updated!', 'success');
  } catch (err) {
    console.error('[Avatar upload]', err);
    showToast('Avatar upload failed: ' + err.message, 'danger');
  } finally {
    input.value = '';
  }
}

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// Expose to window (for inline HTML onclick handlers)
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
Object.assign(window, {
  // Auth
  switchTab, login, register, googleSignIn, forgotPassword, togglePassword,
  // Chat
  filterContacts, filterTab, openConversation, sendMessage,
  handleMsgKey, onTyping, clearChat,
  toggleChatSearch, searchMessages, toggleDropdown,
  toggleEmojiPicker, openNewChat, closeNewChat, filterModal,
  closeProfilePanel, openSettings, closeSettings, toggleDark,
  closeMobileChat, logout, showToast,
  // Images
  triggerImageUpload, handleImageFileSelected, openLightbox, closeLightbox,
  // GIF
  toggleGifPicker, closeGifPicker, onGifSearchInput, sendGif,
  // Add Friend
  openAddFriend, closeAddFriend, switchAFTab, viewRequests,
  searchFriends, clearFriendSearch,
  sendFriendRequest, messageExisting,
  acceptRequest, declineRequest,
  // My Profile / Avatar
  openMyProfile, closeMyProfile, triggerAvatarUpload, handleAvatarFileSelected,
});

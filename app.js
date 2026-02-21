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
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  onSnapshot, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, giphyApiKey } from './firebase-config.js';

// �"?�"? Firebase init �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

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
function authToggleDark() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  const btn = $('auth-theme-toggle');
  if (btn) btn.classList.toggle('is-dark', isDark);
}

if (IS_AUTH) {
  applyTheme();
  // Sync toggle button state
  const isDark = localStorage.getItem('darkMode') === '1';
  setTimeout(() => {
    const btn = $('auth-theme-toggle');
    if (btn) btn.classList.toggle('is-dark', isDark);
  }, 0);

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
let peerStatusUnsubs = {};   // { [uid]: unsubFn } — per-peer status listeners
let convFilter     = 'all';  // sidebar filter
let typingTimer    = null;

// Unsubscribe handles
let unsubConvs      = null;
let unsubMsgs       = null;
let unsubReqs       = null;
let unsubPeerStatus = null;  // watches peer user doc for online status

// Emoji categories
const EMOJI_CATEGORIES = [
  { icon: '😊', label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { icon: '👋', label: 'Gestures', emojis: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','🤲','🤝','🙏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','💪','🦾','🫵','🫶','🫂','💅','🦶','🦵','👂','🦻','👀','👁','👄','🦷','👃','🧠','🫀','🫁'] },
  { icon: '❤️', label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','💔','💋','😻','💏','💑','🫂'] },
  { icon: '🐶', label: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🦝','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐝','🦋','🐛','🐌','🐞','🐟','🐠','🐡','🦈','🐬','🐳','🦭','🐊','🐢','🦎','🐍','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐘','🦛','🦒','🦘','🦬','🐎','🦓','🐕','🐈'] },
  { icon: '🍕', label: 'Food', emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍒','🥭','🍍','🥥','🥝','🍅','🌽','🥕','🍆','🥑','🫒','🥦','🍔','🍕','🌮','🌯','🥙','🌭','🍟','🍗','🍖','🥩','🥚','🍳','🥞','🧇','🍞','🧀','🥗','🍲','🍛','🍣','🍱','🍤','🍜','🍝','🍙','🎂','🍰','🧁','🍭','🍬','🍫','🍩','🍪','☕','🍵','🧋','🥤','🍺','🍻','🥂','🍷','🥃','🍾'] },
  { icon: '⚽', label: 'Activity', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🎯','🎣','🤿','🎿','🛷','🥌','🎮','🕹','🎲','♟','🎭','🎨','🎬','🎤','🎧','🎵','🎶','🎷','🎺','🎸','🎻','🥁','🎹','🏆','🥇','🥈','🥉','🏅','🎖','🎗','🎫','🎪','🏋️','🤸','🏊','🚴','🧘','🏄','🧗','⛷','🏂'] },
  { icon: '✈️', label: 'Travel', emojis: ['🚗','🚕','🚙','🚌','🏎','🚓','🚑','🚒','🚜','🏍','🛵','🚲','🛴','✈️','🛫','🛬','🚀','🛸','🚁','🛳','⛵','🚤','🏔','⛰','🌋','🗺','🏕','🏖','🏜','🏝','🏛','🏰','🗼','🗽','🌅','🌄','🌃','🌆','🌇','🌉','🌍','🌎','🌏','🪐','🌐','🗿'] },
  { icon: '💡', label: 'Objects', emojis: ['💌','📦','💡','🔦','🕯','💰','💳','💎','🪙','📱','💻','⌨','🖥','📷','📸','📹','🎥','📺','📻','🧭','⏰','⌚','🎁','🎊','🎈','🎉','🎀','📣','📢','🔔','💬','💭','🔑','🗝','🔐','🔒','🔓','🪄','💊','🩺','🔭','🔬','🧲','🔋','🧯','🛒','🧳','🔧','🔨','⚙️','🔗','🔫','🏹','🛡','🔪','⚔️','🧸','🪆','🪅'] },
  { icon: '🌙', label: 'Nature', emojis: ['☀️','🌤','⛅','🌥','☁️','🌧','⛈','🌩','🌨','❄️','🌪','🌫','🌬','🌀','🌈','☔','⚡','🔥','💧','🌊','🌺','🌸','🌼','🌻','🌹','💐','🪷','🌷','🌱','🌿','☘️','🍀','🍃','🍂','🍁','🍄','🌾','🪴','🌵','🎄','🌲','🌳','🌴','🌛','🌙','🌕','⭐','🌟','💫','✨','☄️','🌍','🌏','🪐','🌞'] },
  { icon: '💯', label: 'Symbols', emojis: ['❗','❓','‼️','⁉️','💯','✅','❎','🔰','⭕','🛑','⛔','🚫','❌','⚠️','🔞','♻️','💠','🔷','🔶','🔸','🔹','🔺','🔻','🆗','🆕','🆙','🆒','🆓','🆖','🆚','🅰️','🅱️','🅾️','🚩','🎌','🏴','🏳️','⚜️','🔱','📛','✳️','❇️','🆘','🆔','🉐','🈴','🈺','🈸','🀄','🎴','🃏'] },
];

// ── BANNED WORDS FILTER ────────────────────────────────────────
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
];

async function checkAndRecordViolation(text) {
  // Strip invisible / zero-width characters, then lowercase
  const normalized = text
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .toLowerCase();
  // Match even if letters are separated by punctuation/digits acting as leet-speak
  const stripped = normalized.replace(/[^a-z]/g, ''); // no spaces version
  const spaced   = normalized.replace(/[^a-z\s]/g, ' '); // spaces version
  const hit = BANNED_WORDS.some(bw => {
    const bwClean = bw.replace(/[^a-z]/g, '');
    return spaced.includes(bw) || stripped.includes(bwClean);
  });
  if (!hit) return true;

  const userRef = doc(db, 'users', currentUser.uid);
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
    showToast(`\u26a0\ufe0f Prohibited language detected. Warning ${violations}/10 \u2014 ${left} more violation${left === 1 ? '' : 's'} until permanent ban.`, sev);
  } catch (e) { console.warn('Violation tracking error:', e); }
  return false;
}

// ── REPLY / RECALL / MESSAGE MENU ─────────────────────────────
let _replyTo = null; // { msgId, text, fromName }

function setReplyTo(msgId, text, fromName) {
  _replyTo = { msgId, text, fromName };
  const bar = $('reply-preview-bar');
  if (bar) {
    $('reply-preview-name').textContent = fromName;
    $('reply-preview-text').textContent = text.length > 80 ? text.slice(0, 80) + '\u2026' : text;
    bar.classList.remove('hidden');
  }
  $('message-box')?.focus();
  hideMsgMenu();
}

function clearReplyTo() {
  _replyTo = null;
  $('reply-preview-bar')?.classList.add('hidden');
}




// �"?�"? CHAT INIT �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?


function showMsgMenu(event, msgId, isMe, msgText, msgFromName) {
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

function hideMsgMenu() {
  $('msg-context-menu')?.classList.add('hidden');
}

async function recallMessage(msgId) {
  hideMsgMenu();
  if (!activeConvId) return;
  try {
    await updateDoc(doc(db, 'conversations', activeConvId, 'messages', msgId), {
      recalled: true,
      text: 'Message recalled',
      audioData: null,
      gifUrl: null,
    });
  } catch (err) {
    showToast('Failed to recall: ' + err.message, 'danger');
  }
}

async function deleteMsg(msgId) {
  hideMsgMenu();
  if (!activeConvId) return;
  try {
    await deleteDoc(doc(db, 'conversations', activeConvId, 'messages', msgId));
    showToast('Message deleted.', 'success');
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'danger');
  }
}

// ── SELECT MODE ───────────────────────────────────────────────
let _selectMode   = false;
let _selectedMsgs = new Set();

function enterSelectMode(firstMsgId) {
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
      cb.type = 'checkbox';
      cb.className = 'msg-checkbox';
      cb.onchange = () => toggleMsgSelect(id, cb.checked);
      row.prepend(cb);
    }
    cb.checked = _selectedMsgs.has(id);
    row.classList.add('select-mode');
    if (_selectedMsgs.has(id)) row.classList.add('selected');
  });
}

function exitSelectMode() {
  _selectMode = false;
  _selectedMsgs = new Set();
  $('select-actions-bar')?.classList.add('hidden');
  const area = $('messages-area');
  if (area) area.querySelectorAll('.msg-row').forEach(row => {
    row.classList.remove('select-mode', 'selected');
    row.querySelector('.msg-checkbox')?.remove();
  });
}

function toggleMsgSelect(msgId, checked) {
  if (checked) _selectedMsgs.add(msgId);
  else         _selectedMsgs.delete(msgId);
  const row = $('messages-area')?.querySelector(`[data-msg-id="${msgId}"]`);
  row?.classList.toggle('selected', checked);
  rerenderSelectBar();
  if (_selectedMsgs.size === 0) exitSelectMode();
}

function rerenderSelectBar() {
  const bar = $('select-actions-bar');
  if (!bar) return;
  const n = _selectedMsgs.size;
  if (n === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  $('select-count').textContent = `${n} selected`;
}

async function deleteSelectedMsgs() {
  if (!activeConvId || _selectedMsgs.size === 0) return;
  try {
    await Promise.all([..._selectedMsgs].map(id =>
      deleteDoc(doc(db, 'conversations', activeConvId, 'messages', id))
    ));
    showToast(`Deleted ${_selectedMsgs.size} message${_selectedMsgs.size > 1 ? 's' : ''}.`, 'success');
  } catch (err) {
    showToast('Failed to delete: ' + err.message, 'danger');
  }
  exitSelectMode();
}

// ── BLOCK USER ────────────────────────────────────────────────
let blockedUsers = {}; // { [uid]: true }

async function loadBlockedUsers() {
  if (!currentUser) return;
  const snap = await getDoc(doc(db, 'users', currentUser.uid));
  blockedUsers = snap.data()?.blocked || {};
}

async function blockUser(peerId) {
  if (!peerId || !currentUser) return;
  const isBlocked = !!blockedUsers[peerId];
  try {
    if (isBlocked) delete blockedUsers[peerId];
    else           blockedUsers[peerId] = true;
    await updateDoc(doc(db, 'users', currentUser.uid), { blocked: blockedUsers });
    renderConvList(getFilteredConvs($('search-input')?.value || ''));
    updateBlockBtn(peerId);
    updateBlockedBanner();
    showToast(isBlocked ? 'User unblocked.' : 'User blocked.', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'danger');
  }
}

function updateBlockBtn(peerId) {
  const btn = $('pp-block-btn');
  if (!btn || !peerId) return;
  const isBlocked = !!blockedUsers[peerId];
  btn.textContent = isBlocked ? '\uD83D\uDD13 Unblock User' : '\uD83D\uDEAB Block User';
  btn.className   = isBlocked ? 'pp-action-btn' : 'pp-action-btn danger';
}

function updateBlockedBanner() {
  const banner  = $('blocked-banner');
  const toolbar = $('input-toolbar');
  if (!activePeer) return;
  const isBlocked = !!blockedUsers[activePeer.uid];
  banner?.classList.toggle('hidden',  !isBlocked);
  toolbar?.classList.toggle('hidden',  isBlocked);
}

function updatePeerBannedBanner(isBanned) {
  $('peer-banned-banner')?.classList.toggle('hidden', !isBanned);
}


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

    // Ban check
    if (currentProfile?.banned) {
      showToast('Your account has been permanently banned for violating community guidelines.', 'danger');
      setTimeout(() => signOut(auth), 2500);
      return;
    }

    // Mark online
    await updateDoc(doc(db, 'users', user.uid), { status: 'online' });

    // Render my info in sidebar
    $('my-name').textContent = currentProfile.name;
    const av = $('my-avatar');
    if (av) { av.textContent = currentProfile.name.charAt(0).toUpperCase(); av.style.background = currentProfile.color; }

    // Set up emoji picker
    buildEmojiPicker();

    // Subscribe to conversations
    subscribeConversations();

    // Subscribe to incoming friend requests (badge)
    subscribeIncomingRequests();

    // Request browser notification permission
    initNotifications();

    // Close dropdown / menus on outside click
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
  // Track the latest known lastAt per conversation so we can detect
  // genuinely new incoming messages across ALL conversations.
  const knownLastAt = {};
  let initialLoad = true;

  const q = query(
    collection(db, 'conversations'),
    where('members', 'array-contains', currentUser.uid)
  );
  unsubConvs = onSnapshot(q, snap => {
    allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    allConvs.sort((a, b) => {
      const ta = a.lastAt?.seconds || 0;
      const tb = b.lastAt?.seconds || 0;
      return tb - ta;
    });

    // Detect new messages from peers across ALL conversations
    if (!initialLoad) {
      allConvs.forEach(conv => {
        const newSec = conv.lastAt?.seconds || 0;
        const oldSec = knownLastAt[conv.id] || 0;
        // New message arrived?
        if (newSec > oldSec && conv.lastFrom && conv.lastFrom !== currentUser.uid) {
          // Only notify if: tab not focused, OR this isn't the currently active conversation
          const isActiveConv = conv.id === activeConvId && document.hasFocus();
          if (!isActiveConv) {
            const peer = getPeerInfo(conv);
            const body = conv.lastMessage || 'Sent you a message';
            showBrowserNotification(peer.name, body, null);
          }
        }
        knownLastAt[conv.id] = newSec;
      });
    } else {
      // Seed initial timestamps so we don't fire stale notifications on load
      allConvs.forEach(conv => {
        knownLastAt[conv.id] = conv.lastAt?.seconds || 0;
      });
      initialLoad = false;
    }

    renderConvList(getFilteredConvs($('search-input')?.value || ''));
    subscribeAllPeerStatuses();
  });
}

function subscribeAllPeerStatuses() {
  const uid = currentUser?.uid;
  if (!uid) return;

  // Build set of current peer UIDs
  const currentPeerIds = new Set(
    allConvs.map(c => c.members?.find(m => m !== uid)).filter(Boolean)
  );

  // Unsubscribe peers no longer in conversations
  Object.keys(peerStatusUnsubs).forEach(peerId => {
    if (!currentPeerIds.has(peerId)) {
      peerStatusUnsubs[peerId]();
      delete peerStatusUnsubs[peerId];
    }
  });

  // Subscribe new peers
  currentPeerIds.forEach(peerId => {
    if (peerStatusUnsubs[peerId]) return; // already watching
    peerStatusUnsubs[peerId] = onSnapshot(doc(db, 'users', peerId), snap => {
      if (!snap.exists()) return;
      const online = snap.data().status === 'online';
      const conv = allConvs.find(c => c.members?.includes(peerId));
      if (!conv) return;
      const dot = document.querySelector(`.contact-item[data-id="${conv.id}"] .avatar-status`);
      if (dot) dot.className = `avatar-status ${online ? 'status-online' : 'status-offline'}`;
    });
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

  // Reset banned banner, then immediately check peer's banned state
  updatePeerBannedBanner(false);
  getDoc(doc(db, 'users', peerId)).then(snap => {
    if (snap.exists()) updatePeerBannedBanner(!!snap.data().banned);
  });

  // Subscribe to peer's real-time online status (also handles live ban updates)
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

  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('sentAt', 'asc')
  );
  unsubMsgs = onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

    const isMe       = m.from === uid;
    const isCont     = m.from === lastFrom;
    const isRecalled = !!m.recalled;
    const time       = m.sentAt ? fmtTime(m.sentAt) : '';
    const mtype      = m.type || 'text';

    const row = document.createElement('div');
    row.className = `msg-row${isMe ? ' me' : ''}${isCont ? ' continuation' : ''}`;

    const avatarHtml = (!isMe && !isCont)
      ? `<div class="avatar avatar-xs" style="background:${activePeer?.color || '#6C63FF'}">${(activePeer?.name || '?').charAt(0)}</div>`
      : '<div class="msg-avatar-slot"></div>';

    // Build bubble body
    let bodyHtml;
    if (isRecalled) {
      bodyHtml = `<span class="recalled-text">\uD83D\uDD04 Message recalled</span>`;
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
      // Reply quote block
      let replyHtml = '';
      if (m.replyTo) {
        const rName = sanitize(m.replyTo.fromName || 'User');
        const rText = sanitize((m.replyTo.text || '').slice(0, 80) + ((m.replyTo.text || '').length > 80 ? '\u2026' : ''));
        replyHtml = `<div class="reply-quote"><span class="reply-quote-name">${rName}</span><span class="reply-quote-text">${rText}</span></div>`;
      }
      bodyHtml = replyHtml + sanitize(m.text);
    }

    // 3-dot menu button (not shown for recalled messages)
    const safeText  = isRecalled ? '' : (m.text || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const peerName  = isMe ? 'You' : (activePeer?.name || 'User').replace(/'/g, "\\'\\'");
    const menuHtml  = isRecalled ? '' : `
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
      <div class="bubble${isRecalled ? ' recalled' : ''}">
        ${bodyHtml}
        <div class="bubble-footer">
          <span class="msg-time">${time}</span>
          ${isMe ? '<span class="read-receipt">&#10003;&#10003;</span>' : ''}
        </div>
      </div>
      ${menuHtml}`;
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

  // Profanity / banned words check
  const allowed = await checkAndRecordViolation(text);
  if (!allowed) { box.innerText = ''; box.focus(); return; }

  box.innerText = '';
  box.focus();

  try {
    const convRef = doc(db, 'conversations', activeConvId);
    const msgData = {
      from:   currentUser.uid,
      text,
      sentAt: serverTimestamp(),
    };
    if (_replyTo) {
      msgData.replyTo = { msgId: _replyTo.msgId, text: _replyTo.text, fromName: _replyTo.fromName };
    }
    clearReplyTo();

    await addDoc(collection(db, 'conversations', activeConvId, 'messages'), msgData);

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

// ── VOICE MESSAGES ──────────────────────────────────────────
let _mediaRecorder    = null;
let _audioChunks      = [];
let _recTimer         = null;
let _recSeconds       = 0;
let _recMimeType      = 'audio/webm';

async function startVoiceRecording() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') return;
  if (!activeConvId) { showToast('Open a conversation first.', 'warning'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm';
    _recMimeType = mime;
    _audioChunks = [];
    _mediaRecorder = new MediaRecorder(stream, { mimeType: mime });

    _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _audioChunks.push(e.data); };

    _mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(_audioChunks, { type: _recMimeType });
      _hideRecordingBar();
      await _sendVoiceBlob(blob);
    };

    _mediaRecorder.start(100);
    _showRecordingBar();
  } catch (err) {
    showToast('Microphone access denied.', 'danger');
  }
}

function stopAndSendVoice() {
  if (_mediaRecorder && _mediaRecorder.state === 'recording') {
    _mediaRecorder.stop();
  }
}

function cancelVoiceRecording() {
  if (_mediaRecorder) {
    _mediaRecorder.onstop = () => {}; // suppress finishRecording
    if (_mediaRecorder.state === 'recording') _mediaRecorder.stop();
    _mediaRecorder.stream?.getTracks().forEach(t => t.stop());
    _mediaRecorder = null;
  }
  _audioChunks = [];
  _hideRecordingBar();
}

function _showRecordingBar() {
  _recSeconds = 0;
  $('rec-timer').textContent = '0:00';
  $('voice-recording-bar')?.classList.remove('hidden');
  $('voice-btn')?.classList.add('hidden');
  $('send-btn').style.display = 'none';
  _recTimer = setInterval(() => {
    _recSeconds++;
    const m = Math.floor(_recSeconds / 60);
    const s = String(_recSeconds % 60).padStart(2, '0');
    $('rec-timer').textContent = `${m}:${s}`;
    if (_recSeconds >= 120) stopAndSendVoice(); // 2-min hard cap
  }, 1000);
}

function _hideRecordingBar() {
  clearInterval(_recTimer);
  $('voice-recording-bar')?.classList.add('hidden');
  $('voice-btn')?.classList.remove('hidden');
  $('send-btn').style.display = '';
}

async function _sendVoiceBlob(blob) {
  if (!activeConvId) { showToast('No active conversation.', 'warning'); return; }
  if (blob.size > 950 * 1024) {
    showToast('Recording too large (max ~2 min). Please try again.', 'warning');
    return;
  }

  try {
    showToast('Sending voice message…', 'info');
    const audioData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    await addDoc(collection(db, 'conversations', activeConvId, 'messages'), {
      from:     currentUser.uid,
      type:     'voice',
      audioData,
      duration: _recSeconds,
      text:     '\uD83C\uDF99 Voice message',
      sentAt:   serverTimestamp(),
    });

    const peerId = activePeer?.uid;
    const upd = {
      lastMessage: '\uD83C\uDF99 Voice message',
      lastAt:      serverTimestamp(),
      lastFrom:    currentUser.uid,
    };
    if (peerId) {
      const convMeta = allConvs.find(c => c.id === activeConvId);
      upd[`unread.${peerId}`] = (convMeta?.unread?.[peerId] || 0) + 1;
    }
    await updateDoc(doc(db, 'conversations', activeConvId), upd);
  } catch (err) {
    showToast('Failed to send voice: ' + err.message, 'danger');
  }
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

    // Show banned notice to the recipient
    updatePeerBannedBanner(!!data.banned);

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
    // Delay slightly so it doesn't fire before user interaction (browsers block it)
    setTimeout(() => Notification.requestPermission(), 2000);
  }
}

function showBrowserNotification(title, body, iconUrl) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: iconUrl || '/favicon.ico',
    badge: '/favicon.ico',
    tag:  title,           // collapse duplicate notifs from same sender
    renotify: true,
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
  const picker = $('emoji-picker');
  if (!picker) return;

  // Category tabs
  const tabBar = document.createElement('div');
  tabBar.className = 'emoji-tabs';
  EMOJI_CATEGORIES.forEach((cat, idx) => {
    const tab = document.createElement('button');
    tab.className = `emoji-tab-btn${idx === 0 ? ' active' : ''}`;
    tab.textContent = cat.icon;
    tab.title = cat.label;
    tab.onclick = () => {
      tabBar.querySelectorAll('.emoji-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderEmojiGrid(cat.emojis);
    };
    tabBar.appendChild(tab);
  });
  picker.appendChild(tabBar);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'emoji-grid';
  grid.id = 'emoji-grid';
  picker.appendChild(grid);

  renderEmojiGrid(EMOJI_CATEGORIES[0].emojis);
}

function renderEmojiGrid(emojis) {
  const grid = $('emoji-grid');
  if (!grid) return;
  grid.innerHTML = '';
  emojis.forEach(emoji => {
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
function toggleEmojiPicker() {
  const p = $('emoji-picker');
  if (!p) return;
  p.classList.toggle('hidden');
  $('gif-picker')?.classList.add('hidden');
}

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

function openMyProfile() {
  const modal = $('my-profile-modal');
  if (!modal || !currentProfile) return;
  const lgAv = $('my-profile-avatar-lg');
  if (lgAv) {
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

// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
// Expose to window (for inline HTML onclick handlers)
// �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?
Object.assign(window, {
  // Auth
  switchTab, login, register, googleSignIn, forgotPassword, togglePassword,
  authToggleDark,
  // Chat
  filterContacts, filterTab, openConversation, sendMessage,
  handleMsgKey, onTyping, clearChat,
  toggleChatSearch, searchMessages, toggleDropdown,
  toggleEmojiPicker, openNewChat, closeNewChat, filterModal,
  closeProfilePanel, openSettings, closeSettings, toggleDark,
  closeMobileChat, logout, showToast,
  // Message actions
  setReplyTo, clearReplyTo, showMsgMenu, hideMsgMenu, recallMessage,
  deleteMsg, enterSelectMode, exitSelectMode, toggleMsgSelect,
  rerenderSelectBar, deleteSelectedMsgs,
  blockUser, loadBlockedUsers, updateBlockBtn, updateBlockedBanner,
  // Voice
  startVoiceRecording, stopAndSendVoice, cancelVoiceRecording,
  // GIF
  toggleGifPicker, closeGifPicker, onGifSearchInput, sendGif,
  // Add Friend
  openAddFriend, closeAddFriend, switchAFTab, viewRequests,
  searchFriends, clearFriendSearch,
  sendFriendRequest, messageExisting,
  acceptRequest, declineRequest,
  // My Profile
  openMyProfile, closeMyProfile,
});

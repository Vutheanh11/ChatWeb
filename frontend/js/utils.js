/* ============================================================
   utils.js — Pure UI helpers & application constants
   No Firebase dependencies. Safe to import anywhere.
   ============================================================ */

// ── DOM shorthand ─────────────────────────────────────────────
export function $(id) { return document.getElementById(id); }

// ── Toast ─────────────────────────────────────────────────────
export function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => (t.className = 'toast'), 3500);
}

// ── Sanitise HTML ─────────────────────────────────────────────
export function sanitize(s) {
  const m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;' };
  return String(s).replace(/[&<>"']/g, c => m[c]);
}

// ── Time / date ───────────────────────────────────────────────
export function fmtTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US',
    { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US',
    { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Avatar colour ─────────────────────────────────────────────
export const PALETTE = [
  '#6C63FF','#FF6584','#22c55e','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#0ea5e9','#14b8a6','#f97316',
];

export function uidColor(uid) {
  let s = 0;
  for (let i = 0; i < uid.length; i++) s += uid.charCodeAt(i);
  return PALETTE[s % PALETTE.length];
}

// ── Theme helpers ─────────────────────────────────────────────
export function applyTheme() {
  const dark = localStorage.getItem('darkMode') === '1';
  document.body.classList.toggle('dark', dark);
  const t = document.getElementById('dark-toggle');
  if (t) t.checked = dark;
}

export function applyChatTheme() {
  const theme = localStorage.getItem('chatTheme') || 'default';
  document.body.classList.toggle('chat-theme-pixel', theme === 'pixel');
  document.body.classList.toggle('chat-theme-sang',  theme === 'sang');
  document.body.classList.toggle('chat-theme-beach', theme === 'beach');
  document.body.classList.toggle('chat-theme-love',  theme === 'love');
  document.querySelectorAll('.theme-opt').forEach(el => el.classList.remove('active'));
  const btn = document.getElementById('theme-opt-' + theme);
  if (btn) btn.classList.add('active');
}

export function setChatTheme(theme) {
  localStorage.setItem('chatTheme', theme);
  applyChatTheme();
}

// ── Emoji categories ──────────────────────────────────────────
export const EMOJI_CATEGORIES = [
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

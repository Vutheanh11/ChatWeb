/* ============================================================
   auth.js — Login / Register / Google Sign-In page logic
   Runs only on index.html (IS_AUTH page)
   ============================================================ */

import {
  auth, db,
  onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  sendPasswordResetEmail, sendEmailVerification,
  doc, setDoc, getDoc, serverTimestamp,
} from './firebase-init.js';
import { $, showToast, uidColor, applyTheme } from './utils.js';

// ── Re-exported so chat.js can call it when profile is missing ──
export async function createUserProfile(user, name) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]/g, '') +
    Math.floor(Math.random() * 9000 + 1000);
  await setDoc(doc(db, 'users', user.uid), {
    name,
    nameLower: name.toLowerCase(),
    handle,
    email: user.email || '',
    color: uidColor(user.uid),
    about: "Hey there! I'm using ChatWave.",
    status: 'online',
    createdAt: serverTimestamp(),
  });
}

// ── Auth page bootstrap ──────────────────────────────────────
export function initAuthPage() {
  applyTheme();

  // Sync toggle button state
  const isDark = localStorage.getItem('darkMode') === '1';
  setTimeout(() => {
    const btn = $('auth-theme-toggle');
    if (btn) btn.classList.toggle('is-dark', isDark);
  }, 0);

  // Handle returning from Google redirect flow
  (async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const user = result.user;
        const ref  = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) await createUserProfile(user, user.displayName || 'User');
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        showToast(friendlyAuthError(err.code), 'danger');
    }
  })();

  // Redirect to chat if already signed in AND verified
  onAuthStateChanged(auth, user => {
    if (user && user.emailVerified)  { window.location.href = 'chat.html'; return; }
    if (user && !user.emailVerified) { showVerifyScreen(user.email); }
  });

  // Password strength meter
  document.getElementById('reg-password')
    ?.addEventListener('input', e => checkStrength(e.target.value));
}

// ── Tab switch ───────────────────────────────────────────────
export function switchTab(tab) {
  $('tab-login').classList.toggle('active', tab === 'login');
  $('tab-register').classList.toggle('active', tab === 'register');
  $('form-login').classList.toggle('hidden', tab !== 'login');
  $('form-register').classList.toggle('hidden', tab !== 'register');
}

// ── Email / password login ────────────────────────────────────
export async function login() {
  const email = $('login-email').value.trim();
  const pass  = $('login-password').value;
  if (!email || !pass) { showToast('Please fill in all fields.', 'danger'); return; }

  const btn = $('btn-login');
  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    if (!user.emailVerified) {
      showVerifyScreen(user.email);
      btn.textContent = 'Sign In'; btn.disabled = false;
      return;
    }
  } catch (err) {
    btn.textContent = 'Sign In'; btn.disabled = false;
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

// ── Register ──────────────────────────────────────────────────
export async function register() {
  const name  = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const pass  = $('reg-password').value;
  if (!name || !email || !pass) { showToast('Please fill in all fields.', 'danger'); return; }
  if (pass.length < 6) { showToast('Password must be at least 6 characters.', 'warning'); return; }

  const btn = $('btn-register');
  btn.textContent = 'Creating…'; btn.disabled = true;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(user, { displayName: name });
    await createUserProfile(user, name);
    await sendEmailVerification(user);
    btn.textContent = 'Create Account'; btn.disabled = false;
    showVerifyScreen(email);
  } catch (err) {
    btn.textContent = 'Create Account'; btn.disabled = false;
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

// ── Verify email screen ───────────────────────────────────────
export function showVerifyScreen(email) {
  $('auth-tabs')?.classList.add('hidden');
  $('form-login')?.classList.add('hidden');
  $('form-register')?.classList.add('hidden');
  $('form-verify')?.classList.remove('hidden');
  const el = $('verify-email-display');
  if (el) el.textContent = email || '';
}

export async function checkVerified() {
  const user = auth.currentUser;
  if (!user) { backToLogin(); return; }
  const btn = $('btn-check-verified');
  if (btn) { btn.textContent = 'Checking…'; btn.disabled = true; }
  try {
    await user.reload();
    if (auth.currentUser?.emailVerified) {
      window.location.href = 'chat.html';
    } else {
      showToast('Email not verified yet. Please check your inbox.', 'warning');
      if (btn) { btn.textContent = 'I\u2019ve verified \u2014 Continue'; btn.disabled = false; }
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'danger');
    if (btn) { btn.textContent = 'I\u2019ve verified \u2014 Continue'; btn.disabled = false; }
  }
}

export async function resendVerification() {
  const user = auth.currentUser;
  if (!user) { showToast('Session expired. Please sign in again.', 'danger'); backToLogin(); return; }
  const btn = $('btn-resend-verify');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
  try {
    await sendEmailVerification(user);
    showToast('Verification email resent! Check your inbox.', 'success');
  } catch (err) {
    showToast('Could not resend: ' + err.message, 'danger');
  }
  if (btn) { btn.textContent = 'Resend verification email'; btn.disabled = false; }
}

export async function backToLogin(e) {
  e?.preventDefault();
  try { if (auth.currentUser) await signOut(auth); } catch (_) {}
  $('form-verify')?.classList.add('hidden');
  $('auth-tabs')?.classList.remove('hidden');
  $('form-login')?.classList.remove('hidden');
}

// ── Google sign-in ────────────────────────────────────────────
export async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const btn = $('btn-google');
  if (btn) { btn.textContent = 'Redirecting to Google…'; btn.disabled = true; }
  try {
    const { user } = await signInWithPopup(auth, provider);
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) await createUserProfile(user, user.displayName || 'User');
  } catch (err) {
    if (['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request']
        .includes(err.code)) {
      try { await signInWithRedirect(auth, provider); }
      catch (e) { showToast(friendlyAuthError(e.code), 'danger'); }
    } else {
      if (btn) {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg> Continue with Google`;
        btn.disabled = false;
      }
      showToast(friendlyAuthError(err.code), 'danger');
    }
  }
}

// ── Forgot password ───────────────────────────────────────────
export async function forgotPassword(e) {
  e?.preventDefault();
  const email = $('login-email').value.trim();
  if (!email) { showToast('Enter your email above first.', 'warning'); $('login-email').focus(); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Reset email sent! Check your inbox.', 'success');
  } catch (err) {
    showToast(friendlyAuthError(err.code), 'danger');
  }
}

// ── Dark mode toggle (auth page) ──────────────────────────────
export function authToggleDark() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  const btn = $('auth-theme-toggle');
  if (btn) btn.classList.toggle('is-dark', isDark);
}

// ── Password helpers ──────────────────────────────────────────
export function togglePassword(id, btn) {
  const input = $(id);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.style.color = show ? 'var(--primary)' : '';
}

function checkStrength(pass) {
  const fill  = $('strength-fill');
  const label = $('strength-label');
  if (!fill) return;
  let score = 0;
  if (pass.length >= 8)           score++;
  if (/[A-Z]/.test(pass))         score++;
  if (/[0-9]/.test(pass))         score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
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

// ── Friendly error messages ───────────────────────────────────
function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':        'No account found with that email.',
    'auth/wrong-password':        'Incorrect password.',
    'auth/email-already-in-use':  'That email is already registered.',
    'auth/invalid-email':         'Invalid email address.',
    'auth/weak-password':         'Password is too weak.',
    'auth/too-many-requests':     'Too many attempts. Try again later.',
    'auth/invalid-credential':    'Invalid email or password.',
    'auth/unauthorized-domain':   'This domain is not authorised. Open via localhost or your hosted URL.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled. Enable it in Firebase Console → Authentication.',
    'auth/network-request-failed':'Network error. Check your connection and try again.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

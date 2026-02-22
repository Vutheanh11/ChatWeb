/* ============================================================
   functions/index.js — ChatWave Firebase Cloud Functions
   Backend logic: push notifications, user lifecycle, cleanup.
   ============================================================ */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ── 1. Create user profile on sign-up ─────────────────────────
// Fires whenever a new Firebase Auth user is created.
exports.onUserCreated = functions.auth.user().onCreate(async user => {
  const name  = user.displayName || user.email.split('@')[0];
  const PALETTE = ['#6C63FF','#3ABFF8','#36D399','#FBBD23','#F472B6','#F87272','#A78BFA'];
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

  await db.collection('users').doc(user.uid).set({
    uid:        user.uid,
    name,
    nameLower:  name.toLowerCase(),
    email:      user.email,
    handle:     name.toLowerCase().replace(/\s+/g, '') + Math.floor(Math.random() * 9000 + 1000),
    color,
    about:      "Hey there! I'm using ChatWave.",
    status:     'offline',
    violations: 0,
    banned:     false,
    blocked:    {},
    createdAt:  admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  functions.logger.info(`Profile created for ${user.email} (${user.uid})`);
});

// ── 2. Delete user data when account is removed ───────────────
exports.onUserDeleted = functions.auth.user().onDelete(async user => {
  const uid = user.uid;
  const batch = db.batch();

  // Delete user profile
  batch.delete(db.collection('users').doc(uid));

  // Delete pending friend requests involving this user
  const [sent, received] = await Promise.all([
    db.collection('friendRequests').where('from', '==', uid).get(),
    db.collection('friendRequests').where('to',   '==', uid).get(),
  ]);
  [...sent.docs, ...received.docs].forEach(d => batch.delete(d.ref));

  await batch.commit();
  functions.logger.info(`Data deleted for user ${uid}`);
});

// ── 3. Send push notification on new message ──────────────────
// Fires when a message document is created inside any conversation.
exports.onNewMessage = functions.firestore
  .document('conversations/{convId}/messages/{msgId}')
  .onCreate(async (snap, ctx) => {
    const msg    = snap.data();
    const convId = ctx.params.convId;
    const from   = msg.from;
    if (!from) return null;

    // Get conversation to find recipient
    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return null;
    const conv   = convSnap.data();
    const toUid  = (conv.members || []).find(m => m !== from);
    if (!toUid) return null;

    // Get recipient's FCM token
    const toSnap = await db.collection('users').doc(toUid).get();
    if (!toSnap.exists) return null;
    const toUser = toSnap.data();
    const token  = toUser.fcmToken;
    if (!token) return null;  // No device token registered

    // Get sender profile for the notification title
    const fromSnap = await db.collection('users').doc(from).get();
    const fromName = fromSnap.exists ? fromSnap.data().name : 'ChatWave';
    const body     = msg.type === 'voice' ? '🎙 Voice message'
                   : msg.type === 'gif'   ? '🎞 GIF'
                   : (msg.text || 'New message').slice(0, 100);

    const message = {
      token,
      notification: { title: fromName, body },
      data:         { convId, fromUid: from },
      android:      { priority: 'high' },
      apns:         { payload: { aps: { sound: 'default', badge: 1 } } },
      webpush: {
        notification: { icon: '/favicon.ico', badge: '/favicon.ico', tag: convId, renotify: true },
        fcm_options:  { link: '/chat.html' },
      },
    };

    try {
      await admin.messaging().send(message);
      functions.logger.info(`Push sent to ${toUid} from ${fromName}`);
    } catch (err) {
      functions.logger.warn(`Push failed for ${toUid}:`, err.message);
    }
    return null;
  });

// ── 4. Scheduled call cleanup (every 10 minutes) ──────────────
// Removes stale "calling" documents older than 2 minutes.
exports.scheduledCallCleanup = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async _ctx => {
    const staleMs  = 2 * 60 * 1000;      // 2 minutes in milliseconds
    const cutoff   = new Date(Date.now() - staleMs);
    const snap = await db.collection('calls')
      .where('status', '==', 'calling')
      .where('createdAt', '<', cutoff)
      .get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (!snap.empty) {
      await batch.commit();
      functions.logger.info(`Cleaned up ${snap.size} stale call document(s)`);
    }
    return null;
  });

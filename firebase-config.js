// ============================================================
//  ChatWave — Firebase Configuration
//
//  SETUP STEPS (one-time):
//  1. Go to https://console.firebase.google.com
//  2. Click "Add project" → follow the wizard
//  3. In the project, click ⚙ → Project settings → "Your apps"
//     → Add Web App (</>)  → copy the config into this file
//  4. Go to Build → Authentication → Get started
//     → Enable "Email/Password"
//     → Enable "Google"
//  5. Go to Build → Firestore Database → Create database
//     → Start in "test mode" for now (lock down later with
//       the rules in firestore.rules)
//  6. Go to Build → Firestore → Indexes tab
//     → Add composite index: Collection "conversations",
//       Fields: members (Array) + lastAt (Descending)
//     → Add composite index: Collection "friendRequests",
//       Fields: to (Ascending) + status (Ascending)
//  7. Run the app via a local server (NOT file://)
//     e.g.:  npx serve .   or   firebase serve
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAWA_4-Us4vSadUz6ka8JOSC5Zcr2n18bE",
  authDomain: "web-message-e1dc4.firebaseapp.com",
  projectId: "web-message-e1dc4",
  storageBucket: "web-message-e1dc4.firebasestorage.app",
  messagingSenderId: "1082665667898",
  appId: "1:1082665667898:web:5f70b25e3f287cf9fa9403",
  measurementId: "G-7320EYRBHL"
};

// Get a FREE Giphy API key at https://developers.giphy.com/
// Create an app → copy "API Key" → paste below
export const giphyApiKey = 'ETMbGNm3lpHTFr5QR8tA1hbyLnxWtA51';

// ── EmailJS (send OTP emails free from the browser) ──────────────────────────
// Setup (one-time, free at https://www.emailjs.com/):
//   1. Sign up → Dashboard → Email Services → Add Service (Gmail/Outlook/etc.)
//   2. Email Templates → Create Template, use these variables:
//        Subject : Your ChatWave verification code: {{otp_code}}
//        Body    : Hi {{to_name}},\nYour OTP is: {{otp_code}}\nExpires in 10 minutes.
//   3. Account → General → Public Key
//   Then paste the three values below.
export const emailJSConfig = {
  publicKey:  'YOUR_EMAILJS_PUBLIC_KEY',   // e.g. 'abc123XYZ'
  serviceId:  'YOUR_EMAILJS_SERVICE_ID',   // e.g. 'service_gmail'
  templateId: 'YOUR_EMAILJS_TEMPLATE_ID',  // e.g. 'template_otp'
};

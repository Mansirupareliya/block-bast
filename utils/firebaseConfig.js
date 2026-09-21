// Firebase project config for the cross-device leaderboard.
//
// No Authentication is set up or used — no login/signup screen for players,
// ever. Each device is identified only by a random id it generates itself
// (utils/playerIdentity.js).
//
// One-time setup:
//   1. https://console.firebase.google.com → Add project (free "Spark" plan is enough).
//   2. Build → Firestore Database → Create database → start in production mode.
//   3. Project settings (gear icon) → General → "Your apps" → Add app → Web (</>).
//      Register the app, then copy the `firebaseConfig` object it shows you into
//      the object below, replacing every 'YOUR_...' placeholder.
//   4. Firestore Database → Rules tab → replace the contents with utils/firestore.rules
//      → Publish. This validates the data players can write, without needing auth.
//
// Until real values are filled in here, the leaderboard screen shows a
// friendly "not configured yet" message instead of crashing — see
// isFirebaseConfigured() in utils/firebase.js.
export const firebaseConfig = {
  apiKey: 'AIzaSyCnvS0uL041gmKQdeMiPrtWmBovS3rGAQ8',
  authDomain: 'bloackblast.firebaseapp.com',
  projectId: 'bloackblast',
  storageBucket: 'bloackblast.firebasestorage.app',
  messagingSenderId: '764121303786',
  appId: '1:764121303786:web:cb2c6f9aa9e7c124ee6593',
};

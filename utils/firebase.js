import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

// True once utils/firebaseConfig.js has been filled in with a real project.
// Every leaderboard call checks this first so a not-yet-configured project
// degrades to "leaderboard unavailable" instead of throwing at startup.
export const isFirebaseConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

const app = isFirebaseConfigured
  ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig))
  : null;

// No Authentication of any kind — players are identified only by a random
// device id generated locally (see utils/playerIdentity.js). Firestore is
// used directly with open rules scoped by field shape (utils/firestore.rules).
export const db = isFirebaseConfigured ? getFirestore(app) : null;

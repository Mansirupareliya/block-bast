import {
  doc, setDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getDeviceId } from './playerIdentity';

const TOP_N = 50;

// Upserts this device's own row in a given game's leaderboard collection,
// keyed by a random local device id — no authentication involved. Firestore
// rules (utils/firestore.rules) only validate the shape of the data being
// written, not who's writing it. `maxLevel` is omitted for games (like
// Block Blast) that don't have discrete stages, only a running score.
export async function submitProgress(collectionName, { name, maxLevel, bestScore }) {
  if (!isFirebaseConfigured) throw new Error('Leaderboard is not configured yet.');
  const deviceId = await getDeviceId();
  const data = {
    name,
    bestScore: Math.trunc(bestScore ?? 0),
    updatedAt: serverTimestamp(),
  };
  if (maxLevel != null) data.maxLevel = Math.trunc(maxLevel);
  await setDoc(doc(db, collectionName, deviceId), data, { merge: true });
  return deviceId;
}

// Live-subscribes to the top players in a given game's leaderboard
// collection, ranked by `sortFields` in priority order (e.g.
// ['maxLevel', 'bestScore'] — highest stage first, ties broken by score).
//
// Only the first field is used in the actual Firestore query — sorting by
// more than one field there would need a composite index created by hand
// in the Firebase console (Firestore rejects the query outright without
// one). Sidestepped by ordering the query on just that first field (which
// Firestore always indexes automatically) and applying the rest of the tie
// -breaks client-side on the already-small `limit(TOP_N)` result set.
export function subscribeLeaderboard(collectionName, sortFields, onData, onError) {
  if (!isFirebaseConfigured) {
    onError?.(new Error('Leaderboard is not configured yet.'));
    return () => {};
  }
  const q = query(
    collection(db, collectionName),
    orderBy(sortFields[0], 'desc'),
    limit(TOP_N),
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => {
      for (const field of sortFields) {
        const diff = (b[field] ?? 0) - (a[field] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    onData(rows);
  }, (error) => {
    console.log('Leaderboard subscription error:', error.code, error.message);
    onError?.(error);
  });
}

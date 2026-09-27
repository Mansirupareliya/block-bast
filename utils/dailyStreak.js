import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { getDeviceId, getPlayerName } from './playerIdentity';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';

// ── Daily play streak ──────────────────────────────────────────────────────
// Playing any game on a calendar day counts that day. Consecutive days build
// a streak; missing a day resets it to 1 on the next play. Every counted day
// pays out coins (by streak day) and the streak length decides the badge.
// Coins are never taken away when a streak breaks.

// Coins paid for the Nth day of a streak. Days past the last row keep the
// last row's payout.
export const COIN_TIERS = [
  { fromDay: 1,  toDay: 10, coins: 8 },
  { fromDay: 11, toDay: 20, coins: 18 },
  { fromDay: 21, toDay: 30, coins: 28 },
];

export const BADGES = [
  { id: 'bronze',        name: 'Bronze',        minDays: 0,   color: '#D98A4E', image: require('../assets/badges/bronze.png') },
  { id: 'silver',        name: 'Silver',        minDays: 11,  color: '#B9C6D8', image: require('../assets/badges/silver.png') },
  { id: 'gold',          name: 'Gold',          minDays: 21,  color: '#FFC531', image: require('../assets/badges/gold.png') },
  { id: 'platinum',      name: 'Platinum',      minDays: 31,  color: '#3FE0F0', image: require('../assets/badges/platinum.png') },
  { id: 'diamond',       name: 'Diamond',       minDays: 41,  color: '#8FA8FF', image: require('../assets/badges/diamond.png') },
  { id: 'master',        name: 'Master',        minDays: 51,  color: '#C77DFF', image: require('../assets/badges/master.png') },
  { id: 'supreme',       name: 'Supreme',       minDays: 61,  color: '#FF5A4E', image: require('../assets/badges/supreme.png') },
  { id: 'extra_supreme', name: 'Extra Supreme', minDays: 71,  color: '#FF7AD9', image: require('../assets/badges/extra_supreme.png') },
];

export function coinsForDay(day) {
  const tier = COIN_TIERS.find((t) => day >= t.fromDay && day <= t.toDay);
  return (tier ?? COIN_TIERS[COIN_TIERS.length - 1]).coins;
}

// Highest badge reached for a streak length. Bronze starts at 0 days, so
// every player has at least Bronze.
export function badgeForStreak(days) {
  let current = null;
  for (const b of BADGES) if (days >= b.minDays) current = b;
  return current;
}

// "7–13 days" for every badge except the last, which is open-ended.
export function badgeRangeLabel(index) {
  const b = BADGES[index];
  const next = BADGES[index + 1];
  return next ? `${b.minDays}–${next.minDays - 1} days` : `${b.minDays}+ days`;
}

// Local calendar day, so the day rolls over at the player's own midnight.
function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function daysBetween(fromKey, toKey) {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

const EMPTY = { streak: 0, bestStreak: 0, coins: 0, totalDays: 0, lastPlayDate: null };

let state = EMPTY;
let loaded = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function loadStreak() {
  if (!loaded) {
    loaded = loadJSON(STORAGE_KEYS.DAILY_STREAK, EMPTY).then((saved) => {
      state = { ...EMPTY, ...saved };
      emit();
      return state;
    });
  }
  return loaded;
}

export function subscribeStreak(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

// The streak as it stands today: a streak whose last play was before
// yesterday is already broken, even though it's only reset on the next play.
export function liveStreak(s = state) {
  if (!s.lastPlayDate) return 0;
  return daysBetween(s.lastPlayDate, dayKey()) <= 1 ? s.streak : 0;
}

// Mirrors this device's streak into Firestore, keyed by the same random
// device id the leaderboards use; the same docs back the coin leaderboard.
// Fire-and-forget — local storage is the source of truth, so an offline or
// unconfigured backend changes nothing.
async function syncToCloud(s) {
  if (!isFirebaseConfigured || !s.lastPlayDate) return;
  try {
    const [deviceId, name] = await Promise.all([getDeviceId(), getPlayerName()]);
    await setDoc(doc(db, 'playerStreaks', deviceId), {
      name,
      streak: s.streak,
      bestStreak: s.bestStreak,
      coins: s.coins,
      totalDays: s.totalDays,
      lastPlayDate: s.lastPlayDate,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.log('Streak sync error:', error.code, error.message);
  }
}

// Re-pushes this device's row, e.g. so a name changed in Settings shows up
// on the coin leaderboard before the next day's play.
export async function syncStreak() {
  await loadStreak();
  return syncToCloud(state);
}

// Call whenever a game is opened. Counts today once and returns the coins
// just earned (0 if today was already counted).
export async function recordPlay() {
  await loadStreak();
  const today = dayKey();
  if (state.lastPlayDate === today) return 0;

  const continues = state.lastPlayDate && daysBetween(state.lastPlayDate, today) === 1;
  const streak = continues ? state.streak + 1 : 1;
  const reward = coinsForDay(streak);
  state = {
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    coins: state.coins + reward,
    totalDays: state.totalDays + 1,
    lastPlayDate: today,
    lastReward: reward,
  };
  saveJSON(STORAGE_KEYS.DAILY_STREAK, state);
  emit();
  syncToCloud(state);
  return reward;
}

// The Home header shows a "+N" pop once per payout; this hands it over and
// clears it so it isn't shown again.
export function takeLastReward() {
  const r = state.lastReward || 0;
  if (r) {
    state = { ...state, lastReward: 0 };
    saveJSON(STORAGE_KEYS.DAILY_STREAK, state);
  }
  return r;
}

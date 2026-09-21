let AsyncStorage = null;

try {
  // Same defensive dynamic-require pattern as storage.js — a missing
  // native module shouldn't crash the app on startup, the name just won't
  // persist across restarts.
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  console.warn('AsyncStorage could not be loaded. Player name will not be saved.', error);
}

const NAME_KEY = '@player:displayName';
const DEVICE_ID_KEY = '@player:deviceId';
export const MAX_NAME_LENGTH = 20;

// Random id, no login/signup of any kind — just this device's row key on
// the leaderboard. Generated once and reused forever after (persisted in
// AsyncStorage), so the same device keeps the same row across app restarts.
function randomDeviceId() {
  const random = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `dev_${Date.now().toString(36)}${random}`.slice(0, 32);
}

let cachedDeviceId = null;

export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;

  if (AsyncStorage) {
    try {
      const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (saved) {
        cachedDeviceId = saved;
        return saved;
      }
    } catch (error) {
      console.log('Error loading device id:', error);
    }
  }

  const generated = randomDeviceId();
  cachedDeviceId = generated;
  if (AsyncStorage) {
    AsyncStorage.setItem(DEVICE_ID_KEY, generated).catch((error) => {
      console.log('Error saving generated device id:', error);
    });
  }
  return generated;
}

const ADJECTIVES = ['Swift', 'Clever', 'Lucky', 'Brave', 'Sunny', 'Mighty', 'Jolly', 'Cosmic', 'Silent', 'Golden', 'Turbo', 'Ninja'];
const ANIMALS = ['Fox', 'Otter', 'Falcon', 'Panda', 'Tiger', 'Dolphin', 'Wolf', 'Hawk', 'Koala', 'Lynx', 'Raccoon', 'Cobra'];

// Every device gets a readable random default the first time it's asked
// for a name, e.g. "SwiftFox482" — no login, no blank-name leaderboard rows.
function randomDefaultName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${animal}${num}`;
}

export function sanitizeName(raw) {
  return String(raw ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

// In-memory cache so repeated calls within a session don't keep re-reading
// storage or re-generating a default.
let cachedName = null;

export async function getPlayerName() {
  if (cachedName) return cachedName;

  if (AsyncStorage) {
    try {
      const saved = await AsyncStorage.getItem(NAME_KEY);
      if (saved) {
        cachedName = saved;
        return saved;
      }
    } catch (error) {
      console.log('Error loading player name:', error);
    }
  }

  const generated = randomDefaultName();
  cachedName = generated;
  if (AsyncStorage) {
    AsyncStorage.setItem(NAME_KEY, generated).catch((error) => {
      console.log('Error saving generated player name:', error);
    });
  }
  return generated;
}

// The only thing Settings is allowed to change — every other field on a
// leaderboard row (stage reached, score) is written by the game itself.
export async function setPlayerName(raw) {
  const clean = sanitizeName(raw);
  if (!clean) return cachedName ?? getPlayerName();

  cachedName = clean;
  if (AsyncStorage) {
    try {
      await AsyncStorage.setItem(NAME_KEY, clean);
    } catch (error) {
      console.log('Error saving player name:', error);
    }
  }
  return clean;
}

let AsyncStorage = null;

try {
  // Same defensive dynamic-require pattern as audioManager.js: don't let a
  // missing native module (e.g. a dev client built before this dependency
  // was added) crash the app on startup — progress just won't be saved.
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (error) {
  console.warn('AsyncStorage could not be loaded. Progress will not be saved.', error);
}

// Keys for everything persisted across app restarts. Centralized here so
// every screen reads/writes the exact same string.
export const STORAGE_KEYS = {
  BLOCKBLAST_BEST_SCORE: '@blockblast:bestScore',
  DOGSBLOCKS_MAX_UNLOCKED: '@dogsblocks:maxUnlocked',
  MATCHMAKER_MAX_UNLOCKED: '@matchmaker:maxUnlockedLevel',
  MATCHMAKER_BEST_SCORE: '@matchmaker:bestScore',
  BOXPUSHER_MAX_UNLOCKED: '@boxpusher:maxUnlockedLevel',
};

// Loads a persisted integer, falling back to `fallback` if nothing was ever
// saved, storage is unavailable, or the stored value is corrupt.
export const loadNumber = async (key, fallback = 0) => {
  if (!AsyncStorage) return fallback;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch (error) {
    console.log('Error loading stored value:', key, error);
    return fallback;
  }
};

// Fire-and-forget save — callers don't need to await this; a failed save
// (storage unavailable, quota, etc.) just means progress isn't persisted,
// it shouldn't block gameplay.
export const saveNumber = (key, value) => {
  if (!AsyncStorage) return;
  AsyncStorage.setItem(key, String(value)).catch((error) => {
    console.log('Error saving value:', key, error);
  });
};

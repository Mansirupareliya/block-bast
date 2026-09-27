import { Vibration, Platform } from 'react-native';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';

// Short vibrations for taps, piece pickups/drops, flips, wins and fails.
// Uses React Native's built-in Vibration (the VIBRATE permission is already
// in the Android manifest), so no extra native module is needed. The on/off
// choice lives in Settings and is persisted.
//
// iOS ignores custom durations and always gives one fixed ~400ms buzz, which
// is far too heavy for every tap, so there only the bigger moments (win,
// fail) vibrate.

let enabled = true;
const listeners = new Set();

loadJSON(STORAGE_KEYS.VIBRATION_ENABLED, true).then((saved) => {
  enabled = saved;
  listeners.forEach((fn) => fn(enabled));
});

function buzz(pattern, { ios = false } = {}) {
  if (!enabled) return;
  if (Platform.OS === 'ios' && !ios) return;
  try {
    Vibration.vibrate(pattern);
  } catch (error) {
    console.log('Vibration error:', error);
  }
}

// UI buttons, picking up a piece, a step in Box Pusher.
export const hapticTap = () => buzz(15);
// A piece dropped onto the board, a card flipped, a crate pushed.
export const hapticPlace = () => buzz(30);
// A pair matched / line cleared.
export const hapticSuccess = () => buzz([0, 30, 60, 40], { ios: true });
// A wrong move / game over / mismatch.
export const hapticFail = () => buzz([0, 70, 50, 70], { ios: true });

export function isVibrationEnabled() {
  return enabled;
}

export function setVibrationEnabled(on) {
  enabled = on;
  saveJSON(STORAGE_KEYS.VIBRATION_ENABLED, on);
  listeners.forEach((fn) => fn(on));
  if (on) hapticPlace(); // a little buzz so the player feels it's back on
}

export function subscribeVibration(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

import { AppState } from 'react-native';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';

let AudioModule = null;

try {
  // Same defensive dynamic require as audioManager.js — no native module
  // just means no music, not a crash.
  AudioModule = require('expo-audio');
} catch (error) {
  console.warn('Audio module could not be loaded. Background music disabled.', error);
}

// Looping background track that plays across the whole app (hub and every
// game). The on/off choice lives in Settings and is persisted; it's paused
// whenever the app leaves the foreground.
const VOLUME = 0.35;

let player = null;
let enabled = true;
let appActive = AppState.currentState === 'active';
const listeners = new Set();

function getPlayer() {
  if (player || !AudioModule) return player;
  try {
    player = AudioModule.createAudioPlayer(require('../assets/bgm_lofi.mp3'));
    player.loop = true;
    player.volume = VOLUME;
  } catch (error) {
    console.log('Error creating music player:', error);
  }
  return player;
}

function apply() {
  const p = getPlayer();
  if (!p) return;
  try {
    if (enabled && appActive) p.play(); else p.pause();
  } catch (error) {
    console.log('Error updating music playback:', error);
  }
}

let started = false;

// Call once at app start: restores the saved setting and starts playback.
export async function initMusic() {
  if (started) return;
  started = true;
  enabled = await loadJSON(STORAGE_KEYS.MUSIC_ENABLED, true);
  listeners.forEach((fn) => fn(enabled));
  AppState.addEventListener('change', (next) => {
    appActive = next === 'active';
    apply();
  });
  apply();
}

export function isMusicEnabled() {
  return enabled;
}

export function setMusicEnabled(on) {
  enabled = on;
  saveJSON(STORAGE_KEYS.MUSIC_ENABLED, on);
  listeners.forEach((fn) => fn(on));
  apply();
}

export function subscribeMusic(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

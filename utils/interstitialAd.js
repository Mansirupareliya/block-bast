// Keeps one interstitial preloaded at all times. Loading starts only after
// the Mobile Ads SDK has initialized (see App.js), and a failed load is
// retried with backoff instead of leaving the ad dead for the whole session.
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { INTERSTITIAL_AD_UNIT_ID } from './ads';

let interstitial = null;
let isLoaded = false;
let isLoading = false;
let retryDelay = 5000;
let retryTimer = null;
let gameOverCount = 0;
let onClosedOnce = null; // callback for the ad currently on screen

function finishShow() {
  const cb = onClosedOnce;
  onClosedOnce = null;
  cb?.();
}

function load() {
  if (!interstitial || isLoaded || isLoading) return;
  isLoading = true;
  interstitial.load();
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    load();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000);
}

// Call once after mobileAds().initialize() resolves.
export function preloadInterstitial() {
  if (interstitial) return;
  interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    isLoaded = true;
    isLoading = false;
    retryDelay = 5000;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    isLoaded = false;
    load();
    finishShow();
  });
  interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
    isLoaded = false;
    isLoading = false;
    console.warn('[interstitialAd] failed to load:', error);
    scheduleRetry();
  });

  load();
}

// Shows the interstitial if one is ready; otherwise kicks off a load so
// the next call has one. Returns true if an ad was shown.
// `onDone` (optional) runs once the ad is closed — or right away if no ad
// was ready or it failed to show — so callers can never get stuck waiting.
export function showInterstitial(onDone) {
  if (interstitial && isLoaded) {
    isLoaded = false;
    levelsSinceAd = 0; // any ad shown restarts the every-3-levels count
    onClosedOnce = onDone || null;
    interstitial.show().catch((e) => {
      console.warn('[interstitialAd] failed to show:', e);
      load();
      finishShow();
    });
    return true;
  }
  load();
  onDone?.();
  return false;
}

// Level games (Matchmaker, Box Pusher, Light Path): after every 3 levels
// completed — counted across all games this session — the next level the
// player starts opens behind a full-screen ad.
const LEVELS_PER_AD = 3;
let levelsSinceAd = 0;

export function noteLevelComplete() {
  levelsSinceAd += 1;
}

// Wraps starting a level: runs `start` straight away, or after the ad
// closes when 3 levels have been completed since the last ad.
export function runAfterLevelAd(start) {
  if (levelsSinceAd >= LEVELS_PER_AD) showInterstitial(start);
  else start();
}

// Block Puzzle game-over: roughly every other run, so the very first run of
// a session is never interrupted.
export function maybeShowInterstitial() {
  gameOverCount += 1;
  if (gameOverCount % 2 === 0) showInterstitial();
}

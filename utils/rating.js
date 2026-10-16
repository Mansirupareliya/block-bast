import { Linking, Platform } from 'react-native';
import { STORAGE_KEYS, loadJSON, saveJSON } from './storage';

// Asks for a Play Store rating once per game, after the player has beaten
// RATING_AFTER_LEVELS levels in it. Uses Google's in-app review dialog
// (expo-store-review); if that fails, opens the app's Play Store page instead.
// Same defensive dynamic-require as storage.js so an older dev client without
// the native module doesn't crash.
let StoreReview = null;
try {
  StoreReview = require('expo-store-review');
} catch (error) {
  console.warn('expo-store-review could not be loaded. Rating prompts are disabled.', error);
}

export const RATING_AFTER_LEVELS = 7;
const PACKAGE = 'com.mansirupareliyasteam.BlockBlast';
// Let the level-complete popup land before the dialog covers it.
const PROMPT_DELAY_MS = 1500;

// { boxpusher: true, ... } — games that have already shown the prompt.
let asked = {};
loadJSON(STORAGE_KEYS.RATING_ASKED, {}).then((saved) => { asked = saved || {}; });

// `levelsBeaten` is how many levels of `gameId` the player has completed.
export function maybeAskForRating(gameId, levelsBeaten) {
  if (levelsBeaten < RATING_AFTER_LEVELS || asked[gameId]) return;
  asked = { ...asked, [gameId]: true };
  saveJSON(STORAGE_KEYS.RATING_ASKED, asked);
  setTimeout(requestRating, PROMPT_DELAY_MS);
}

async function requestRating() {
  try {
    if (StoreReview && await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return;
    }
  } catch (error) {
    console.log('In-app review failed, opening store page:', error);
  }
  openStorePage();
}

function openStorePage() {
  if (Platform.OS !== 'android') return;
  Linking.openURL(`market://details?id=${PACKAGE}`)
    .catch(() => Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`))
    .catch((error) => console.log('Could not open Play Store:', error));
}

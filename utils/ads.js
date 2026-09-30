// AdMob wiring. Real ad unit IDs come from .env (EXPO_PUBLIC_ADMOB_*), and
// whether they're used at all is decided by EXPO_PUBLIC_USE_TEST_ADS, which
// eas.json sets per build profile: development/preview builds get Google's
// public TEST ids, the production (Play Store) build gets the real ones.
// Dev-server builds (__DEV__) always use test ads so tapping around while
// developing can never trigger an AdMob policy strike on the real account.
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// process.env.EXPO_PUBLIC_* must be written out literally — Expo replaces
// each one with its value at bundle time and doesn't support dynamic access.
const USE_TEST_ADS = __DEV__ || process.env.EXPO_PUBLIC_USE_TEST_ADS !== 'false';

const BANNER_REAL = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
});

const INTERSTITIAL_REAL = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
});

// A missing ID (e.g. iOS not set up yet) falls back to test ads rather than
// requesting an empty ad unit.
const pick = (real, test) => (USE_TEST_ADS || !real ? test : real);

export const BANNER_AD_UNIT_ID = pick(BANNER_REAL, TestIds.BANNER);
export const INTERSTITIAL_AD_UNIT_ID = pick(INTERSTITIAL_REAL, TestIds.INTERSTITIAL);

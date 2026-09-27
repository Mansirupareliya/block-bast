// AdMob wiring. Ad unit IDs below are Google's public TEST ids, so ads work
// in any build (dev, debug APK, or release APK) without risking policy
// strikes on a real account. Once you create your own ad units in the AdMob
// console, paste them in below — the moment the placeholder "XXXX..." text
// is gone, that placement automatically switches from test to real ads.
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// Flip to false once BANNER_REAL / INTERSTITIAL_REAL below are each a
// correct, distinct, real ad unit ID and your AdMob app has been approved
// (new apps can take 24-48h). While true every placement always uses
// Google's guaranteed-fill test ads, so you can verify placements work
// without depending on account approval or network luck.
const FORCE_TEST_ADS = true;

const BANNER_REAL = Platform.select({
  android: 'ca-app-pub-3809470409595542/8514515848', // your real Android banner ad unit ID
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',      // TODO: your iOS banner ad unit ID
});

const INTERSTITIAL_REAL = Platform.select({
  android: 'ca-app-pub-3809470409595542/8514515843', // your real Android interstitial ad unit ID
  ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',      // TODO: your iOS interstitial ad unit ID
});

const isPlaceholder = (id) => !id || id.includes('XXXXXXXXXXXXXXXX');

export const BANNER_AD_UNIT_ID = (FORCE_TEST_ADS || isPlaceholder(BANNER_REAL)) ? TestIds.BANNER : BANNER_REAL;
export const INTERSTITIAL_AD_UNIT_ID = (FORCE_TEST_ADS || isPlaceholder(INTERSTITIAL_REAL)) ? TestIds.INTERSTITIAL : INTERSTITIAL_REAL;

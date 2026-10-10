import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_UNIT_ID } from '../utils/ads';

// The banner is always the last thing at the bottom of a screen. On phones
// with on-screen nav buttons (back/home/recents) the app draws edge-to-edge
// underneath them, so pad by the bottom inset to lift the ad above the bar.
// Gesture-nav phones report ~0, so the ad stays flush with the bottom.
export default function AdBanner() {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: bottom }]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(error) => console.warn('[AdBanner] failed to load:', error)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
});

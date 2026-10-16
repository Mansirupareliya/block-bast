import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from './AppText';
import {
  NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView,
} from 'react-native-google-mobile-ads';
import { NATIVE_AD_UNIT_ID } from '../utils/ads';
import { NEON } from '../utils/theme';

// An AdMob native ad drawn as one more card in the Home game grid — same
// size, corners and art/info split as a game tile. Renders nothing until an
// ad loads (or if it fails), so the grid never shows an empty slot.
export default function NativeAdTile({ width, height }) {
  const [ad, setAd] = useState(null);

  useEffect(() => {
    let alive = true;
    let loaded = null;
    NativeAd.createForAdRequest(NATIVE_AD_UNIT_ID)
      .then((a) => {
        if (alive) { loaded = a; setAd(a); } else a.destroy();
      })
      .catch((e) => console.warn('[NativeAdTile] failed to load:', e));
    return () => { alive = false; loaded?.destroy(); };
  }, []);

  if (!ad) return null;

  return (
    <NativeAdView nativeAd={ad} style={[styles.tile, { width, height }]}>
      <View style={[styles.art, { height: height * 0.62 }]}>
        <NativeMediaView resizeMode="cover" style={styles.media} />
        <View style={styles.adBadge}><Text style={styles.adBadgeTxt}>Ad</Text></View>
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          {ad.icon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: ad.icon.url }} style={styles.icon} />
            </NativeAsset>
          )}
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={2}>{ad.headline}</Text>
          </NativeAsset>
        </View>
        {!!ad.callToAction && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta} numberOfLines={1}>{ad.callToAction}</Text>
          </NativeAsset>
        )}
      </View>
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: NEON.glassFill,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,194,26,0.35)',
  },
  art: { backgroundColor: NEON.bg2, overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  adBadge: {
    position: 'absolute', top: 7, left: 7,
    backgroundColor: '#FFC21A', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  adBadgeTxt: { color: '#1B1B1B', fontSize: 11, fontWeight: '900' },
  info: { flex: 1, padding: 9, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 22, height: 22, borderRadius: 5, marginRight: 6 },
  headline: { flex: 1, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  cta: {
    alignSelf: 'flex-start', overflow: 'hidden',
    backgroundColor: '#FFC21A', color: '#1B1B1B',
    fontSize: 11, fontWeight: '800',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
});

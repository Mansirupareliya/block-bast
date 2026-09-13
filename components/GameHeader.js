import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated,
} from 'react-native';
import { playTap } from '../utils/audioManager';
import { NEON } from '../utils/theme';

// Status bar height — computed once at module level
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

/**
 * Game header matching reference image:
 *   👑 2299         ♡
 *
 * Props:
 *   subtitle   — best score number
 *   onBack     — called when back/settings pressed
 *   liked      — boolean heart state
 *   onLike     — heart toggle
 *   headerAnim — optional Animated style
 */
export default function GameHeader({
  title, subtitle, accent = '#FFD700',
  onBack, liked = false, onLike,
  headerAnim,
}) {
  const likeScale = React.useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    playTap();
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.5, friction: 3, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1,   friction: 5, useNativeDriver: true }),
    ]).start();
    onLike?.();
  };

  const handleBack = () => {
    playTap();
    onBack?.();
  };

  // Extract just the number from subtitle like "BEST: 2299"
  const bestNum = subtitle?.replace('BEST: ', '') ?? '0';

  return (
    <Animated.View style={[styles.wrapper, headerAnim]}>
      {/* Status-bar safe area */}
      <View style={{ height: STATUS_H }} />

      <View style={styles.row}>

        {/* LEFT — Back button (‹ chevron bare) */}
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.5}
          style={styles.leftSlot}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chevron}>{'‹'}</Text>
        </TouchableOpacity>

        {/* CENTER — Crown + best score */}
        <View style={styles.center}>
          <Text style={styles.crownIcon}>👑</Text>
          <Text style={styles.bestScore}>{bestNum}</Text>
        </View>

        {/* RIGHT — Heart like button */}
        <View style={styles.rightSlot}>
          <TouchableOpacity
            onPress={handleLike}
            activeOpacity={0.5}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Animated.Text style={[
              styles.heartIcon,
              { color: liked ? NEON.magenta : 'rgba(255,255,255,0.4)' },
              liked && { textShadowColor: NEON.magenta, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
              { transform: [{ scale: likeScale }] },
            ]}>
              {liked ? '♥' : '♡'}
            </Animated.Text>
          </TouchableOpacity>
        </View>

      </View>
    </Animated.View>
  );
}

export { STATUS_H };

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    width: '100%',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },

  // Left slot — back chevron
  leftSlot: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '200',
    color: NEON.cyan,
    textShadowColor: NEON.cyan,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
    marginTop: -3,
  },

  // Center — crown + score
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  crownIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  bestScore: {
    fontSize: 20,
    fontWeight: '900',
    color: NEON.gold,
    letterSpacing: 0.5,
    textShadowColor: NEON.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // Right slot — heart like button
  rightSlot: {
    width: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heartIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
});



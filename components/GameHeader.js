import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated,
} from 'react-native';

// Status bar height — computed once at module level
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

/**
 * Game header matching reference image:
 *   👑 2299         ⚙️
 *
 * Props:
 *   subtitle   — best score number
 *   onBack     — called when back/settings pressed
 *   liked      — boolean heart state (unused in this layout)
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
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.5, friction: 3, useNativeDriver: true }),
      Animated.spring(likeScale, { toValue: 1,   friction: 5, useNativeDriver: true }),
    ]).start();
    onLike?.();
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
          onPress={onBack}
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
              { color: liked ? '#FF4466' : 'rgba(255,255,255,0.55)' },
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
    color: 'rgba(255,255,255,0.9)',
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
    color: '#FFD700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Right slot — heart
  rightSlot: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heartIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
});



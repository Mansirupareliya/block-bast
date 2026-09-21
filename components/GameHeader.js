import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap } from '../utils/audioManager';
import { THEME, cartoonShadow } from '../utils/blockBlastTheme';

// Status bar height — computed once at module level
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

// ── Glossy cartoon bubble button — same recipe as the Matchmaker game's
// CartoonButton (bold border, light-top/dark-bottom gradient face, a
// diagonal glossy highlight blob) so both games share one button language.
function CartoonButton({ size = 40, onPress, children, style }) {
  const borderW = Math.max(2.5, size * 0.07);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={style}>
      <LinearGradient
        colors={['#FFE27A', '#FFC93C', '#B9782E']}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: THEME.brown,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          ...cartoonShadow('#000', 4, 0.28),
        }}
      >
        <View style={{
          position: 'absolute', top: size * 0.1, left: size * 0.12,
          width: size * 0.38, height: size * 0.22, borderRadius: size * 0.18,
          backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-18deg' }],
        }} />
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/**
 * Game header — bright cartoon style:
 *   (‹ back)      👑 2299       (♡ like)
 *
 * Props:
 *   subtitle    — best score number
 *   onBack      — called when back/settings pressed
 *   liked       — boolean heart state
 *   onLike      — heart toggle
 *   onLeaderboard — optional; when given, the trophy/score pill becomes
 *                   tappable and opens the leaderboard
 *   headerAnim  — optional Animated style
 */
export default function GameHeader({
  title, subtitle, onBack, liked = false, onLike, onLeaderboard,
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

        {/* LEFT — Back button */}
        <CartoonButton size={40} onPress={handleBack}>
          <Text style={styles.chevron}>{'‹'}</Text>
        </CartoonButton>

        {/* CENTER — Trophy + best score pill (opens the leaderboard, if wired up) */}
        <View style={styles.center}>
          <TouchableOpacity
            style={styles.scorePill}
            activeOpacity={onLeaderboard ? 0.75 : 1}
            disabled={!onLeaderboard}
            onPress={() => { playTap(); onLeaderboard?.(); }}
          >
            <Text style={[styles.crownIcon, { fontSize: 18 }]}>🏆</Text>
            <Text style={styles.bestScore}>{bestNum}</Text>
          </TouchableOpacity>
        </View>

        {/* RIGHT — Heart like button */}
        <CartoonButton size={40} onPress={handleLike}>
          <Animated.Text style={[
            styles.heartIcon,
            { color: liked ? '#FFFFFF' : 'rgba(122,74,24,0.55)' },
            { transform: [{ scale: likeScale }] },
          ]}>
            {liked ? '♥' : '♡'}
          </Animated.Text>
        </CartoonButton>

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
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },

  chevron: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
    color: THEME.brown,
    marginTop: -2,
  },

  // Center — crown + score pill
  center: {
    flex: 1,
    alignItems: 'center',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.panel,
    borderWidth: 2,
    borderColor: THEME.panelBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...cartoonShadow('#000', 4, 0.15),
  },
  crownIcon: {
    marginRight: -2,
  },
  bestScore: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
    letterSpacing: 0.5,
  },

  heartIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
});

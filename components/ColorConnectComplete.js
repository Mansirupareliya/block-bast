import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './AppText';
import { LEVEL_FONT } from '../utils/fonts';
import { DOT_COLORS } from '../utils/colorConnect';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI = 26;

// Success screen once the whole grid is filled correctly: the card springs
// in, coloured confetti rains down, and the player picks Next / Replay /
// Levels.
export default function ColorConnectComplete({
  levelNum, moves, pairs, time, perfect, usedHint, isLast, onNext, onReplay, onLevels,
}) {
  const pop = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const confetti = useRef(Array.from({ length: CONFETTI }, (_, i) => ({
    x: Math.random() * SW,
    drift: (Math.random() - 0.5) * 80,
    delay: Math.random() * 0.35,
    size: 6 + Math.random() * 8,
    color: DOT_COLORS[i % DOT_COLORS.length],
    spin: Math.random() > 0.5 ? 1 : -1,
  }))).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    Animated.timing(fall, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }).start();
  }, [pop, fall]);

  const title = perfect ? 'PERFECT!' : 'LEVEL COMPLETE!';

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,30,36,0.72)' }]} />
      {confetti.map((c, i) => {
        const p = fall.interpolate({ inputRange: [c.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', left: c.x, top: -20, width: c.size, height: c.size * 0.6, borderRadius: 2,
            backgroundColor: c.color,
            opacity: p.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, SH * 0.9] }) },
              { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, c.drift] }) },
              { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${c.spin * 540}deg`] }) },
            ],
          }} />
        );
      })}

      <View style={s.center} pointerEvents="box-none">
        <Animated.View style={[s.card, {
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }]}>
          <View style={s.dotsRow}>
            {DOT_COLORS.slice(0, 6).map((c) => <View key={c} style={[s.dot, { backgroundColor: c }]} />)}
          </View>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>Level {levelNum} · every cell filled</Text>

          <View style={s.stats}>
            <Stat label="MOVES" value={moves} />
            <Stat label="PAIRS" value={pairs} />
            <Stat label="TIME" value={time} />
          </View>
          {usedHint && <Text style={s.note}>💡 Solved with a hint</Text>}
          {!usedHint && !perfect && <Text style={s.note}>Tip: connect each pair in one move for PERFECT</Text>}

          <Btn label={isLast ? 'ALL LEVELS DONE!' : 'NEXT LEVEL ▶'} colors={['#FFE36A', '#FFC21A']} base="#C78A00" onPress={onNext} />
          <View style={s.row}>
            <Btn small label="↻ REPLAY" colors={['#7CF2E8', '#2FC9C0']} base="#13817B" onPress={onReplay} />
            <Btn small label="LEVELS" colors={['#9FC2FF', '#5B8DEF']} base="#2E4E93" onPress={onLevels} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 70 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function Btn({ label, colors, base, onPress, small }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ marginTop: 12, flex: small ? 1 : undefined, alignSelf: small ? undefined : 'stretch' }}>
      {({ pressed }) => (
        <View style={{ backgroundColor: base, borderRadius: 18, paddingBottom: pressed ? 2 : 5, marginTop: pressed ? 3 : 0 }}>
          <LinearGradient colors={colors} style={s.btnFace}>
            <Text style={[s.btnTxt, small && { fontSize: 16 }]}>{label}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 28, padding: 22,
    backgroundColor: '#0F4C55', borderWidth: 3, borderColor: '#5FE3D6',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 14,
  },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  title: {
    fontSize: 34, ...LEVEL_FONT, color: '#FFFFFF', textAlign: 'center',
    textShadowColor: '#05323A', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 2,
  },
  sub: { fontSize: 14, fontWeight: '700', color: '#BFF5EF', marginTop: 4 },
  stats: {
    flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 16,
    paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)',
  },
  statLabel: { fontSize: 11, ...LEVEL_FONT, color: '#8FD9D1', letterSpacing: 0.8 },
  statValue: { fontSize: 22, ...LEVEL_FONT, color: '#FFFFFF' },
  note: { fontSize: 12, fontWeight: '700', color: '#BFF5EF', marginTop: 10, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  btnFace: { borderRadius: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnTxt: {
    fontSize: 20, ...LEVEL_FONT, color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1,
  },
});

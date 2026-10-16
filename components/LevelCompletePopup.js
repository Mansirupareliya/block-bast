import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, Dimensions, Easing } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LEVEL_FONT } from '../utils/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FitBox from './FitBox';

// Bright "hyper-casual" win popup: mint-to-sky gradient with falling
// confetti, a white card topped by a big gold star + green tick, the score
// and stars earned, and chunky NEXT / HOME buttons.

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = Math.min(SW * 0.82, 340);

const CONFETTI_COLORS = ['#FF5FA2', '#FFC93C', '#4FC3F7', '#7C4DFF', '#3DDC84', '#FF8A3D', '#5C6BFF'];

function starPoints(size, inner = 0.42, off = 0) {
  const c = size / 2, R = size / 2, r = R * inner;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${off + c + rad * Math.cos(a)},${off + c + rad * Math.sin(a) + size * 0.04}`);
  }
  return pts.join(' ');
}

// Glossy gold star (grey when not earned).
function GoldStar({ size, filled = true, id }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id={`gs${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={filled ? '#FFF27A' : '#E9EDF2'} />
          <Stop offset="0.55" stopColor={filled ? '#FFC928' : '#CBD2DB'} />
          <Stop offset="1" stopColor={filled ? '#F59E0B' : '#AEB7C2'} />
        </SvgGradient>
      </Defs>
      <Polygon
        points={starPoints(size * 0.92, 0.42, size * 0.04)}
        fill={`url(#gs${id})`}
        stroke={filled ? '#E08A00' : '#9AA4B0'}
        strokeWidth={size * 0.035}
        strokeLinejoin="round"
      />
      <Polygon
        points={starPoints(size * 0.5, 0.45, size * 0.25)}
        fill="rgba(255,255,255,0.35)"
      />
    </Svg>
  );
}

function CheckMark({ size }) {
  const d = `M${size * 0.18},${size * 0.52} L${size * 0.42},${size * 0.76} L${size * 0.84},${size * 0.26}`;
  return (
    <Svg width={size} height={size}>
      <Path d={d} stroke="#FFFFFF" strokeWidth={size * 0.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke="#2FAE4E" strokeWidth={size * 0.19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke="#7EE07F" strokeWidth={size * 0.06} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Coin({ size }) {
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size * 0.47} fill="#F5A623" />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.38} fill="#FFD447" stroke="#F9B820" strokeWidth={size * 0.05} />
      {/* little crown */}
      <Path
        d={`M${size * 0.3},${size * 0.62} L${size * 0.3},${size * 0.4} L${size * 0.4},${size * 0.5} L${size * 0.5},${size * 0.34} ` +
          `L${size * 0.6},${size * 0.5} L${size * 0.7},${size * 0.4} L${size * 0.7},${size * 0.62} Z`}
        fill="#F29A0E"
      />
    </Svg>
  );
}

function Sparkle({ size, style }) {
  const m = size / 2;
  return (
    <Svg width={size} height={size} style={style}>
      <Path d={`M${m},0 Q${m},${m} ${size},${m} Q${m},${m} ${m},${size} Q${m},${m} 0,${m} Q${m},${m} ${m},0 Z`} fill="#FFFFFF" />
    </Svg>
  );
}

// One confetti piece drifting down the screen, swaying and spinning.
function Confetti({ seed }) {
  const fall = useRef(new Animated.Value(0)).current;
  const rnd = (k) => {
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const left = rnd(1) * SW;
  const dur = 4200 + rnd(2) * 3800;
  const isDot = rnd(3) < 0.45;
  const w = isDot ? 9 : 7;
  const h = isDot ? 9 : 16;
  const color = CONFETTI_COLORS[Math.floor(rnd(4) * CONFETTI_COLORS.length)];
  const sway = 12 + rnd(5) * 22;

  useEffect(() => {
    fall.setValue(rnd(6)); // start spread out over the screen, not all at the top
    const first = Animated.timing(fall, {
      toValue: 1, duration: dur * (1 - rnd(6)), easing: Easing.linear, useNativeDriver: true,
    });
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(fall, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(fall, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
    ]));
    first.start(({ finished }) => { if (finished) loop.start(); });
    return () => { first.stop(); loop.stop(); };
  }, []);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-30, SH + 30] });
  const translateX = fall.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, sway, 0, -sway, 0] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rnd(7) < 0.5 ? '-' : ''}${360 + rnd(8) * 360}deg`] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, left, width: w, height: h, borderRadius: isDot ? w : 4,
      backgroundColor: color, opacity: 0.85,
      transform: [{ translateY }, { translateX }, { rotate }],
    }} />
  );
}

function ChunkyButton({ colors, edge, textColor, label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ width: '100%' }}>
      {({ pressed }) => (
        <View style={[s.btnBase, { backgroundColor: edge, transform: [{ translateY: pressed ? 3 : 0 }] }]}>
          <LinearGradient colors={colors} style={[s.btnFace, pressed && { marginBottom: 1 }]}>
            <View style={s.btnShine} />
            <Text style={[s.btnTxt, { color: textColor }]}>{label}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

export default function LevelCompletePopup({ stars, score, info, onNext, onHome, onReplay }) {
  const card = useRef(new Animated.Value(0)).current;
  const starPops = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const big = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(card, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(big, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.stagger(140, starPops.map((v) => Animated.spring(v, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }))),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const bigScale = big.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.8] });
  const popScale = (v) => v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const insets = useSafeAreaInsets();

  return (
    <View style={[StyleSheet.absoluteFill, s.root]}>
      <LinearGradient
        colors={['#8EEAD8', '#7FD3F0', '#7AA8FF']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {Array.from({ length: 30 }, (_, i) => <Confetti key={i} seed={i + 1} />)}

      <FitBox style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}>
      <Animated.View style={{ opacity: card, transform: [{ scale: cardScale }], alignItems: 'center' }}>
        <View style={s.card}>
          {/* Star crown sitting over the top edge of the card */}
          <View style={s.crown}>
            <Animated.View style={[s.sunGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
            <Sparkle size={14} style={{ position: 'absolute', left: 18, top: 6 }} />
            <Sparkle size={18} style={{ position: 'absolute', right: 14, top: 0 }} />
            <Sparkle size={10} style={{ position: 'absolute', right: 40, top: 70 }} />
            <Animated.View style={{ position: 'absolute', left: 6, top: 52, transform: [{ rotate: '-14deg' }, { scale: popScale(starPops[0]) }] }}>
              <GoldStar size={50} filled={stars >= 1} id="l" />
            </Animated.View>
            <Animated.View style={{ position: 'absolute', right: 6, top: 52, transform: [{ rotate: '14deg' }, { scale: popScale(starPops[2]) }] }}>
              <GoldStar size={50} filled={stars >= 3} id="r" />
            </Animated.View>
            <Animated.View style={{ transform: [{ scale: bigScale }] }}>
              <GoldStar size={104} filled id="big" />
              <View style={s.check}><CheckMark size={58} /></View>
            </Animated.View>
          </View>

          <Text style={[s.title, { color: '#3DBE3A' }]}>LEVEL</Text>
          <Text style={[s.title, { color: '#1F8A4C', marginTop: -6 }]}>COMPLETE</Text>

          <View style={s.statRow}>
            <View style={s.statHalf}>
              <Coin size={34} />
              <Text style={s.score}>+{score.toLocaleString()}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={[s.statHalf, { gap: 3 }]}>
              {[0, 1, 2].map((i) => (
                <Animated.View key={i} style={{ transform: [{ scale: popScale(starPops[i]) }] }}>
                  <GoldStar size={30} filled={i < stars} id={`row${i}`} />
                </Animated.View>
              ))}
            </View>
          </View>
          {!!info && <Text style={s.info}>{info}</Text>}

          <View style={{ width: '100%', gap: 12, marginTop: 14 }}>
            {onNext ? (
              <ChunkyButton colors={['#8BE35A', '#4CC23A', '#38A82C']} edge="#2B8A22" textColor="#FFFFFF" label="NEXT" onPress={onNext} />
            ) : (
              <ChunkyButton colors={['#8BE35A', '#4CC23A', '#38A82C']} edge="#2B8A22" textColor="#FFFFFF" label="REPLAY" onPress={onReplay} />
            )}
            <ChunkyButton colors={['#FAFAFA', '#E4E4E4', '#CFCFCF']} edge="#A9A9A9" textColor="#5A5A5A" label="HOME" onPress={onHome} />
          </View>
          {onNext && onReplay && (
            <Pressable onPress={onReplay} hitSlop={10} style={{ marginTop: 12 }}>
              <Text style={s.replay}>↻ Replay level</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
      </FitBox>
    </View>
  );
}

const s = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', elevation: 999, zIndex: 999 },
  card: {
    width: CARD_W, alignItems: 'center',
    paddingTop: 92, paddingBottom: 20, paddingHorizontal: 22,
    backgroundColor: '#FFFFFF', borderRadius: 30,
    shadowColor: '#1E4C8A', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 14,
  },
  crown: {
    position: 'absolute', top: -62, width: 220, height: 150,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  sunGlow: {
    position: 'absolute', top: -10, width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(255,236,140,0.75)',
  },
  check: { position: 'absolute', left: 23, top: 52 },
  title: { ...LEVEL_FONT, fontSize: 40, letterSpacing: 1.5, textAlign: 'center' },
  statRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 10,
    backgroundColor: '#FFF8EA', borderRadius: 16,
  },
  statHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statDivider: { width: 1.5, height: 30, backgroundColor: 'rgba(160,130,80,0.2)' },
  score: { ...LEVEL_FONT, fontSize: 24, color: '#3A3A3A' },
  info: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#9A9A9A' },
  btnBase: { borderRadius: 26, paddingBottom: 5 },
  btnFace: {
    height: 50, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  btnShine: {
    position: 'absolute', top: 4, left: 18, right: 18, height: 14, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  btnTxt: {
    ...LEVEL_FONT, fontSize: 24, letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.18)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1,
  },
  replay: { fontSize: 14, fontWeight: '800', color: '#5A9BD8' },
});

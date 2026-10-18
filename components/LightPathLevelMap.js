import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Pressable, ScrollView } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { LEVEL_FONT } from '../utils/fonts';

// Light Path level select: round wooden level coins stacked up a dark
// groove on a plank floor. Level 1 is at the bottom and later levels go up;
// the current level is a bigger glowing coin.

const { width: SW, height: SH } = Dimensions.get('window');

const COIN = Math.min(SW * 0.15, 62); // diameter of a regular coin's face
const BIG = COIN * 1.18; // the current level's coin
const ROW_H = COIN * 1.9;
const TRACK_W = COIN * 0.36;
const BOTTOM_AREA = 110; // space below the lowest coin on screen
const TOP_PAD = 150;
const BOTTOM_PAD = BOTTOM_AREA + 40;

const WOOD = ['#B98858', '#C08F5F', '#B28050', '#BC8B5A', '#C4946A'];
const WOOD_LINE = '#8D5F3C';
const BROWN = '#7A5230';
const SOCKET = '#5E3D22';

// Every 5th level is a "hard" one, drawn in purple.
const isHard = (n) => n % 5 === 0;

// ── Fixed backdrop: vertical planks with staggered joints ────────────────
// Also used behind the Light Path game board.
export function Planks() {
  const cols = 5;
  const w = SW / cols;
  const plankH = SH * 0.34;
  const rects = [];
  for (let c = 0; c < cols; c++) {
    const offset = ((c * 0.37) % 1) * plankH;
    for (let i = -1; i * plankH < SH; i++) {
      const y = i * plankH + offset;
      rects.push(
        <Rect key={`${c}-${i}`} x={c * w} y={y} width={w} height={plankH}
          fill={WOOD[(c * 3 + i + 5) % WOOD.length]} stroke={WOOD_LINE} strokeWidth={2} />
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SW} height={SH}>{rects}</Svg>
      <LinearGradient colors={['rgba(70,35,10,0.28)', 'rgba(70,35,10,0)', 'rgba(70,35,10,0.28)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function usePulse(duration) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}

// White number with a thick brown outline, for the current level.
function OutlinedNumber({ num, size }) {
  const fs = size * 0.46;
  const common = {
    x: size / 2, y: size / 2 + fs * 0.36, fontSize: fs, fontFamily: 'LilitaOne',
    textAnchor: 'middle', strokeLinejoin: 'round',
  };
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgText {...common} fill="#4A2C14" stroke="#4A2C14" strokeWidth={fs * 0.16}>{num}</SvgText>
      <SvgText {...common} fill="#FFFFFF">{num}</SvgText>
    </Svg>
  );
}

// ── One level coin ────────────────────────────────────────────────────────
function Coin({ num, state, stars, top, pulse, onPress }) {
  const current = state === 'current';
  const done = state === 'done';
  const locked = state === 'locked';
  const d = current ? BIG : COIN;
  const hard = isHard(num) && !current;
  // Locked levels are greyed out and can't be tapped.
  const face = locked ? '#A89A88' : current ? '#F6D99A' : hard ? '#A35CF0' : '#F1D6A0';
  const edge = locked ? '#7C6F60' : current ? '#C99A55' : hard ? '#6E2FB8' : '#C9A26A';
  const numColor = locked ? '#5E5347' : hard ? '#4B1F86' : BROWN;
  const socket = d + 12;
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  return (
    <View style={[st.coinRow, { top: top - socket / 2 }]} pointerEvents="box-none">
      <Pressable onPress={onPress} hitSlop={8} disabled={locked}>
        {({ pressed }) => (
          <View style={{ width: socket, height: socket, alignItems: 'center', justifyContent: 'center', opacity: locked ? 0.6 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }}>
            {current ? (
              <Animated.View style={[st.halo, {
                width: socket + 14, height: socket + 14, borderRadius: (socket + 14) / 2,
                opacity: haloOpacity, transform: [{ scale: haloScale }],
              }]} />
            ) : (
              <View style={[st.socket, { width: socket, height: socket, borderRadius: socket / 2 }]} />
            )}
            {/* coin edge (the 3D side) then the face on top */}
            <View style={{ position: 'absolute', top: (socket - d) / 2 + 5, width: d, height: d, borderRadius: d / 2, backgroundColor: edge }} />
            <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: face, marginTop: -3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <View style={[st.shine, { width: d * 0.8, height: d * 0.4, borderRadius: d * 0.4, top: d * 0.06 }]} />
              {current ? (
                <OutlinedNumber num={num} size={d} />
              ) : (
                <Text style={[st.num, { fontSize: d * 0.4, color: numColor }]}>{num}</Text>
              )}
            </View>
            {done && (
              <View style={st.stars} pointerEvents="none">
                {[0, 1, 2].map((i) => (
                  <Text key={i} style={[st.star, { color: i < stars ? '#FFD23F' : 'rgba(255,255,255,0.45)' }]}>★</Text>
                ))}
              </View>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default function LightPathLevelMap({ count, maxUnlocked, bestStars, onPressLevel, header }) {
  const scrollRef = useRef(null);
  const didScroll = useRef(false);
  const pulse = usePulse(900);

  const contentH = TOP_PAD + (count - 1) * ROW_H + BOTTOM_PAD + BIG;
  const centerFor = (n) => TOP_PAD + BIG / 2 + (count - n) * ROW_H;
  const current = Math.min(count, Math.max(1, maxUnlocked));
  const stateFor = (n) => (n > current ? 'locked' : n === current && !bestStars[n] ? 'current' : 'done');

  // Open with the current level sitting near the bottom of the screen.
  const scrollToCurrent = () => {
    if (didScroll.current) return;
    didScroll.current = true;
    const y = Math.max(0, Math.min(contentH - SH, centerFor(current) - (SH - BOTTOM_AREA - BIG * 0.75)));
    scrollRef.current?.scrollTo({ y, animated: false });
  };

  const coins = useMemo(() => {
    const out = [];
    for (let n = count; n >= 1; n--) {
      const state = stateFor(n);
      out.push(
        <Coin key={n} num={n} state={state} stars={bestStars[n] || 0} top={centerFor(n)}
          pulse={pulse} onPress={() => onPressLevel(n, state)} />
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, current, bestStars, pulse, onPressLevel]);

  return (
    <View style={{ flex: 1, backgroundColor: WOOD[0] }}>
      <Planks />
      <ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: contentH }}
        showsVerticalScrollIndicator={false}
        onLayout={scrollToCurrent}
      >
        {/* dark groove the coins sit in */}
        <View style={[st.track, { top: centerFor(count), height: centerFor(1) - centerFor(count) }]} />
        {coins}
      </ScrollView>

      <LinearGradient colors={['rgba(90,50,20,0)', 'rgba(90,50,20,0.35)']} style={st.bottomFade} pointerEvents="none" />
      {header}
    </View>
  );
}

const st = StyleSheet.create({
  track: {
    position: 'absolute', left: SW / 2 - TRACK_W / 2, width: TRACK_W,
    backgroundColor: 'rgba(78,46,22,0.6)', borderRadius: TRACK_W / 2,
  },
  coinRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  socket: {
    position: 'absolute', backgroundColor: SOCKET,
    borderWidth: 3, borderColor: 'rgba(245,215,170,0.55)',
  },
  halo: {
    position: 'absolute', backgroundColor: 'rgba(255,236,196,0.55)',
    borderWidth: 3, borderColor: 'rgba(255,245,220,0.9)',
  },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.22)' },
  num: { ...LEVEL_FONT, includeFontPadding: false },
  stars: { position: 'absolute', bottom: -6, flexDirection: 'row', gap: 2 },
  star: {
    fontSize: 12, fontWeight: '900',
    textShadowColor: 'rgba(60,30,10,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_AREA },
});

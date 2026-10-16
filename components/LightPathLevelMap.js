import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Pressable } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Line, Circle, Ellipse, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { LEVEL_FONT } from '../utils/fonts';

// Light Path level select: a neon tile road running off into a misty night
// scene. Level 1 is at the bottom, later levels further up the road; the
// current level carries a bouncing glowing ball. Tiles shrink, drift toward
// the middle and fade as they scroll up, so the road reads as going away
// into the distance.

const { width: SW, height: SH } = Dimensions.get('window');

const ROW_H = 118;
const TILE = Math.min(SW * 0.3, 118);
const TILE_H = TILE * 0.8;
const HORIZON = SH * 0.3;
const NEAR_Y = SH - 140; // where a tile is drawn full size
const TOP_PAD = SH * 0.45; // room to scroll the last level down into view
const BOTTOM_PAD = 160;

const CYAN = '#4FD4FF';
const GOLD = '#FFD23F';

const laneX = (n) => Math.round(Math.sin(n * 1.1) * SW * 0.2);

function useLoop(duration) {
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

// ── Fixed backdrop: sky, moon, mountains, pagoda, road edges, lotus lights ─
function Scenery() {
  const roadTopL = SW * 0.47, roadTopR = SW * 0.53;
  const pagodaX = SW * 0.16, baseY = HORIZON;
  const lotus = [
    [0.1, 0.48], [0.88, 0.44], [0.06, 0.66], [0.93, 0.62], [0.14, 0.84], [0.9, 0.86],
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#08133A', '#14357E', '#2A68B8']} style={{ height: HORIZON }} />
      <LinearGradient colors={['#1D55A8', '#103A85', '#0A1F55']} style={{ flex: 1 }} />
      <Svg width={SW} height={SH} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF6D8" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#FFF6D8" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="lotus" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={CYAN} stopOpacity="0.9" />
            <Stop offset="1" stopColor={CYAN} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* moon */}
        <Circle cx={SW * 0.68} cy={SH * 0.11} r={70} fill="url(#moonGlow)" />
        <Circle cx={SW * 0.68} cy={SH * 0.11} r={24} fill="#F4F0DC" />
        {/* far + near mountains */}
        <Polygon fill="#2B5FA6" opacity={0.75} points={
          `0,${baseY} 0,${baseY - 40} ${SW * 0.12},${baseY - 70} ${SW * 0.28},${baseY - 38} ${SW * 0.42},${baseY - 82} ` +
          `${SW * 0.58},${baseY - 45} ${SW * 0.75},${baseY - 90} ${SW * 0.9},${baseY - 50} ${SW},${baseY - 66} ${SW},${baseY}`
        } />
        <Polygon fill="#1D4788" points={
          `0,${baseY} 0,${baseY - 18} ${SW * 0.2},${baseY - 34} ${SW * 0.38},${baseY - 14} ${SW * 0.62},${baseY - 30} ` +
          `${SW * 0.82},${baseY - 12} ${SW},${baseY - 28} ${SW},${baseY}`
        } />
        {/* pagoda silhouette */}
        {[0, 1, 2].map((i) => {
          const w = 44 - i * 10, y = baseY - 22 - i * 20;
          return (
            <React.Fragment key={i}>
              <Rect x={pagodaX - (w - 14) / 2} y={y} width={w - 14} height={20} fill="#163A75" />
              <Polygon fill="#122F63" points={`${pagodaX - w / 2 - 6},${y + 2} ${pagodaX},${y - 10} ${pagodaX + w / 2 + 6},${y + 2}`} />
            </React.Fragment>
          );
        })}
        <Line x1={pagodaX} y1={baseY - 72} x2={pagodaX} y2={baseY - 86} stroke="#163A75" strokeWidth={3} />
        {/* road edges: soft glow + bright line */}
        {[[SW * 0.02, roadTopL], [SW * 0.98, roadTopR]].map(([x0, x1], i) => (
          <React.Fragment key={i}>
            <Line x1={x0} y1={SH} x2={x1} y2={HORIZON} stroke={CYAN} strokeOpacity={0.25} strokeWidth={12} />
            <Line x1={x0} y1={SH} x2={x1} y2={HORIZON} stroke="#BFF1FF" strokeWidth={2.5} />
          </React.Fragment>
        ))}
        <Polygon fill="rgba(10,30,80,0.35)" points={`${SW * 0.02},${SH} ${roadTopL},${HORIZON} ${roadTopR},${HORIZON} ${SW * 0.98},${SH}`} />
        {/* glowing lotus lights on the water */}
        {lotus.map(([x, y], i) => (
          <React.Fragment key={i}>
            <Ellipse cx={SW * x} cy={SH * y} rx={26} ry={12} fill="url(#lotus)" />
            <Ellipse cx={SW * x} cy={SH * y} rx={9} ry={5} fill="#D8F7FF" />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

// ── One level on the road ─────────────────────────────────────────────────
function RoadTile({ num, count, state, stars, top, scrollY, bounce, glow, onPress }) {
  const dx = laneX(num);
  const nextDx = laneX(num + 1);
  // Distance-based perspective, driven natively by the scroll position.
  const range = [top - NEAR_Y, top - HORIZON];
  const scale = scrollY.interpolate({ inputRange: range, outputRange: [1, 0.42], extrapolate: 'clamp' });
  const translateX = scrollY.interpolate({ inputRange: range, outputRange: [dx, dx * 0.15], extrapolate: 'clamp' });
  const opacity = scrollY.interpolate({
    inputRange: [top - NEAR_Y, top - HORIZON - 40, top - HORIZON + 10],
    outputRange: [1, 0.85, 0],
    extrapolate: 'clamp',
  });

  const locked = state === 'locked';
  const current = state === 'current';
  const face = locked ? 'rgba(60,110,180,0.35)' : current ? '#7FE6FF' : '#45C8F5';
  const border = locked ? 'rgba(140,190,240,0.4)' : '#D8F7FF';
  const ballY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const ringScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] });

  return (
    <Animated.View style={{
      position: 'absolute', top, left: SW / 2 - TILE / 2, width: TILE, height: ROW_H,
      alignItems: 'center', opacity, transform: [{ translateX }, { scale }],
    }}>
      {/* stepping-light dots leading up to the next level */}
      {num < count && [0.3, 0.55, 0.8].map((t, i) => (
        <View key={i} style={{
          position: 'absolute', top: ROW_H * 0.42 - ROW_H * t, left: TILE / 2 - 4 + (nextDx - dx) * t,
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: locked ? 'rgba(160,200,240,0.3)' : '#BFF1FF',
        }} />
      ))}

      <Text style={[s.num, locked && s.numLocked, current && { color: '#FFFFFF', textShadowColor: CYAN }]}>{num}</Text>

      <Pressable onPress={onPress} hitSlop={10}>
        {({ pressed }) => (
          <View style={{ alignItems: 'center', transform: [{ scale: pressed ? 0.93 : 1 }] }}>
            {current && (
              <Animated.View style={[s.ring, { transform: [{ perspective: 600 }, { rotateX: '52deg' }, { scale: ringScale }] }]} />
            )}
            <View style={[
              s.face,
              { backgroundColor: face, borderColor: border, transform: [{ perspective: 600 }, { rotateX: '52deg' }] },
              !locked && s.faceGlow,
            ]}>
              <View style={s.faceShine} />
              {locked ? (
                <Text style={s.lock}>🔒</Text>
              ) : (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <Text key={i} style={[s.star, { color: i < stars ? GOLD : 'rgba(255,255,255,0.35)' }]}>★</Text>
                  ))}
                </View>
              )}
            </View>
            {current && (
              <Animated.View pointerEvents="none" style={[s.ballWrap, { transform: [{ translateY: ballY }] }]}>
                <View style={s.ballGlow} />
                <View style={s.ball} />
              </Animated.View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LightPathLevelMap({ count, maxUnlocked, bestStars, onPressLevel, header }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const didScroll = useRef(false);
  const bounce = useLoop(520);
  const glow = useLoop(1000);

  const contentH = TOP_PAD + count * ROW_H + BOTTOM_PAD;
  const topFor = (n) => TOP_PAD + (count - n) * ROW_H;

  // Open with the current level sitting near the bottom of the screen.
  const scrollToCurrent = () => {
    if (didScroll.current) return;
    didScroll.current = true;
    const y = Math.max(0, Math.min(contentH - SH, topFor(maxUnlocked) - (SH - 260)));
    scrollRef.current?.scrollTo({ y, animated: false });
  };

  const tiles = [];
  for (let n = count; n >= 1; n--) {
    const state = n > maxUnlocked ? 'locked' : n === maxUnlocked && !bestStars[n] ? 'current' : 'done';
    tiles.push(
      <RoadTile
        key={n}
        num={n}
        count={count}
        state={state}
        stars={bestStars[n] || 0}
        top={topFor(n)}
        scrollY={scrollY}
        bounce={bounce}
        glow={glow}
        onPress={() => onPressLevel(n, state)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Scenery />
      <Animated.ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: contentH }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={scrollToCurrent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {tiles}
      </Animated.ScrollView>
      {header}
    </View>
  );
}

const s = StyleSheet.create({
  num: {
    ...LEVEL_FONT, fontSize: 26, color: '#E6FAFF', marginBottom: -6,
    textShadowColor: 'rgba(79,212,255,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  numLocked: { color: 'rgba(200,225,255,0.5)', textShadowRadius: 0 },
  face: {
    width: TILE, height: TILE_H, borderRadius: 14, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  faceGlow: {
    shadowColor: CYAN, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  faceShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ring: {
    position: 'absolute', top: -TILE_H * 0.12, width: TILE * 1.24, height: TILE_H * 1.24,
    borderRadius: 20, borderWidth: 3, borderColor: 'rgba(191,241,255,0.85)',
    backgroundColor: 'rgba(79,212,255,0.18)',
  },
  star: { fontSize: 20, fontWeight: '900' },
  lock: { fontSize: 22, opacity: 0.7 },
  ballWrap: {
    position: 'absolute', top: TILE_H * 0.5 - 30, alignItems: 'center', justifyContent: 'center',
    width: 60, height: 60,
  },
  ballGlow: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(191,241,255,0.35)' },
  ball: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    shadowColor: '#BFF1FF', shadowOpacity: 1, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
});

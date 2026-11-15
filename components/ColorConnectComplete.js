import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Ellipse, Rect } from 'react-native-svg';
import { Text } from './AppText';
import { LEVEL_FONT } from '../utils/fonts';
import { DOT_COLORS } from '../utils/colorConnect';

const { width: SW, height: SH } = Dimensions.get('window');
const CONFETTI = 26;
const CARD_W = Math.min(SW - 40, 350);
const HANGER_H = 64;
// Panel's inner width (frame padding 14×2, panel padding 18×2, borders) —
// the stars are sized from it so they always fit, even on narrow phones.
const INNER_W = CARD_W - 28 - 36 - 6;
const STAR_BIG = Math.floor(INNER_W * 0.37);
const STAR_SMALL = Math.floor(INNER_W * 0.3);

// Level-complete popup: a blue frame "hanging" from a handle drops in and
// swings to rest, a ribbon shows the level, three glossy stars pop in one by
// one (3 = perfect, 2 = solved without a hint, 1 = hint used), then
// Next / Replay / Levels.
export default function ColorConnectComplete({
  levelNum, moves, pairs, time, perfect, usedHint, isLast, onNext, onReplay, onLevels,
}) {
  const drop = useRef(new Animated.Value(0)).current;
  const swing = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const starAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const btnIn = useRef(new Animated.Value(0)).current;
  const confetti = useRef(Array.from({ length: CONFETTI }, (_, i) => ({
    x: Math.random() * SW,
    drift: (Math.random() - 0.5) * 80,
    delay: Math.random() * 0.35,
    size: 6 + Math.random() * 8,
    color: DOT_COLORS[i % DOT_COLORS.length],
    spin: Math.random() > 0.5 ? 1 : -1,
  }))).current;

  const earned = perfect ? 3 : usedHint ? 1 : 2;

  useEffect(() => {
    Animated.spring(drop, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.delay(150),
      Animated.spring(swing, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
    ]).start();
    Animated.timing(fall, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.stagger(170, starAnims.map((a) => Animated.spring(a, {
      toValue: 1, friction: 4, tension: 120, useNativeDriver: true,
    }))).start();
    Animated.sequence([
      Animated.delay(700),
      Animated.spring(btnIn, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [drop, swing, fall, starAnims, btnIn]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,6,30,0.72)' }]} />
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
        <Animated.View style={{
          width: CARD_W,
          opacity: drop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-SH * 0.6, 0] }) },
            // Swing around the handle: pivot sits above the card's centre.
            { translateY: -(HANGER_H + 200) },
            { rotate: swing.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '0deg'] }) },
            { translateY: HANGER_H + 200 },
          ],
        }}>
          <Hanger />

          {/* Blue outer frame */}
          <LinearGradient colors={['#7CC0FF', '#4A95F2', '#3478DA']} style={s.frame}>
            <View style={s.frameRim} />
            {/* Cream inner panel */}
            <LinearGradient colors={['#FFF9EE', '#FFF1DC', '#FCE6C8']} style={s.panel}>
              <View style={s.starsRow}>
                {[0, 1, 2].map((i) => {
                  const a = starAnims[i];
                  const big = i === 1;
                  const sz = big ? STAR_BIG : STAR_SMALL;
                  return (
                    <View key={i} style={[{ width: sz, height: sz }, !big && { marginTop: STAR_BIG * 0.24 }]}>
                      <GlossyStar empty size={sz} />
                      {i < earned && (
                        <Animated.View style={[StyleSheet.absoluteFill, {
                          opacity: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
                          transform: [
                            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) },
                            { rotate: a.interpolate({ inputRange: [0, 1], outputRange: [`${(i - 1) * 40 - 20}deg`, `${(i - 1) * 8}deg`] }) },
                          ],
                        }]}>
                          <GlossyStar size={sz} />
                        </Animated.View>
                      )}
                    </View>
                  );
                })}
              </View>

              <Animated.View style={{
                alignSelf: 'stretch', opacity: btnIn,
                transform: [{ scale: btnIn.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              }}>
                <GlossyButton
                  label={isLast ? 'All Done!' : 'Next'}
                  colors={['#B6F53A', '#6FD81C', '#38B20E']} base="#24800A" stroke="#1C6B07"
                  onPress={onNext} big
                />
                <View style={s.row}>
                  <GlossyButton label="Replay" colors={['#FFE06A', '#FFB52B', '#F58E0C']} base="#B85F00" stroke="#9A4E00" onPress={onReplay} />
                  <GlossyButton label="Levels" colors={['#8CCBFF', '#4E9BF5', '#2C74DA']} base="#1B4FA0" stroke="#173F80" onPress={onLevels} />
                </View>
              </Animated.View>
            </LinearGradient>

            {/* Bolts at the bottom corners */}
            <View style={[s.bolt, { left: 26 }]}><View style={s.boltIn} /></View>
            <View style={[s.bolt, { right: 26 }]}><View style={s.boltIn} /></View>
          </LinearGradient>

          {/* Ribbon header */}
          <View style={s.ribbonWrap} pointerEvents="none">
            <View style={[s.ribbonFold, { left: 0 }]} />
            <View style={[s.ribbonFold, { right: 0 }]} />
            <LinearGradient colors={['#79C1FF', '#4C98F4', '#2F76DD']} style={s.ribbon}>
              <View style={s.ribbonShine} />
              <Text style={s.ribbonTxt}>Level {levelNum}</Text>
            </LinearGradient>
          </View>

          {/* Close (×) bubble */}
          <Pressable onPress={onLevels} hitSlop={10} style={s.close}>
            {({ pressed }) => (
              <LinearGradient colors={['#8CCBFF', '#4E9BF5']} style={[s.closeFace, pressed && { transform: [{ scale: 0.9 }] }]}>
                <Text style={s.closeTxt}>✕</Text>
              </LinearGradient>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

// The carry handle the card hangs from, with a small loop where it attaches.
function Hanger() {
  const w = CARD_W * 0.62;
  return (
    <View style={{ height: HANGER_H, alignItems: 'center' }} pointerEvents="none">
      <Svg width={w} height={HANGER_H + 20} style={{ position: 'absolute', top: 0 }}>
        <Defs>
          <SvgLinear id="hg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8CCBFF" />
            <Stop offset="1" stopColor="#2F76DD" />
          </SvgLinear>
        </Defs>
        <Path
          d={`M14 ${HANGER_H + 20} L26 22 Q30 10 44 10 L${w - 44} 10 Q${w - 30} 10 ${w - 26} 22 L${w - 14} ${HANGER_H + 20}`}
          fill="none" stroke="#1B4FA0" strokeWidth={22} strokeLinejoin="round"
        />
        <Path
          d={`M14 ${HANGER_H + 20} L26 22 Q30 10 44 10 L${w - 44} 10 Q${w - 30} 10 ${w - 26} 22 L${w - 14} ${HANGER_H + 20}`}
          fill="none" stroke="url(#hg)" strokeWidth={15} strokeLinejoin="round"
        />
        <Path d={`M48 14 L${w - 48} 14`} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" />
      </Svg>
      {/* loop */}
      <View style={s.loop} />
    </View>
  );
}

// Chunky rounded 5-point star with a jelly-like gloss.
function starPath(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r : R;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += `${i ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}
const STAR_OUT = starPath(50, 53, 40, 21);
const STAR_IN = starPath(50, 55, 22, 12);

function GlossyStar({ size, empty }) {
  if (empty) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d={STAR_OUT} fill="#E9D7BC" stroke="#E9D7BC" strokeWidth={12} strokeLinejoin="round" />
        <Path d={STAR_OUT} fill="#DCC6A6" stroke="#DCC6A6" strokeWidth={6} strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="sf" cx="45%" cy="35%" r="70%">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="0.45" stopColor="#FFC13B" />
          <Stop offset="1" stopColor="#FF8A12" />
        </RadialGradient>
      </Defs>
      <Path d={STAR_OUT} fill="#E0700A" stroke="#E0700A" strokeWidth={14} strokeLinejoin="round" transform="translate(0 3)" />
      <Path d={STAR_OUT} fill="url(#sf)" stroke="#FFAE2E" strokeWidth={12} strokeLinejoin="round" />
      <Path d={STAR_IN} fill="#FFD36A" fillOpacity={0.75} stroke="#FFD36A" strokeOpacity={0.75} strokeWidth={8} strokeLinejoin="round" />
      <Ellipse cx="38" cy="30" rx="9" ry="5" fill="#FFFFFF" fillOpacity={0.75} transform="rotate(-30 38 30)" />
      <Rect x="56" y="22" width="5" height="5" rx="2.5" fill="#FFFFFF" fillOpacity={0.6} />
    </Svg>
  );
}

// Jelly button: darker base under a glossy gradient face with a shine band.
function GlossyButton({ label, colors, base, stroke, onPress, big }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[{ marginTop: 12 }, !big && { flex: 1 }]}>
      {({ pressed }) => (
        <View style={{ backgroundColor: base, borderRadius: 26, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 }}>
          <LinearGradient colors={colors} style={[s.btnFace, big && { paddingVertical: 14 }]}>
            <View style={s.btnShine} />
            <Text style={[s.btnTxt, { fontSize: big ? 32 : 21, textShadowColor: stroke }]}>{label}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loop: {
    position: 'absolute', bottom: -14, width: 18, height: 38, borderRadius: 9,
    borderWidth: 5, borderColor: '#A8DAFF', backgroundColor: 'transparent',
  },
  frame: {
    borderRadius: 46, padding: 14, paddingBottom: 30,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 16,
  },
  frameRim: {
    ...StyleSheet.absoluteFillObject, borderRadius: 46, borderWidth: 3, borderColor: 'rgba(255,255,255,0.35)',
  },
  panel: {
    borderRadius: 34, paddingTop: 54, paddingBottom: 20, paddingHorizontal: 18, alignItems: 'center',
    borderWidth: 3, borderColor: '#F2D9B4',
  },
  starsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 2, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  btnFace: { borderRadius: 26, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnShine: { position: 'absolute', top: 5, left: 16, right: 16, height: '34%', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)' },
  btnTxt: { ...LEVEL_FONT, color: '#FFFFFF', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1, letterSpacing: 0.5 },
  bolt: {
    position: 'absolute', bottom: 7, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#3478DA', borderWidth: 3, borderColor: '#9CD0FF', alignItems: 'center', justifyContent: 'center',
  },
  boltIn: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1B4FA0' },
  ribbonWrap: { position: 'absolute', top: HANGER_H - 22, left: CARD_W * 0.14, right: CARD_W * 0.14, alignItems: 'center' },
  ribbonFold: {
    position: 'absolute', bottom: -10, width: 22, height: 22, backgroundColor: '#1B4FA0', transform: [{ rotate: '45deg' }],
  },
  ribbon: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14,
    borderWidth: 2, borderColor: '#A8DAFF',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  ribbonShine: { position: 'absolute', top: 4, left: 12, right: 12, height: '35%', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)' },
  ribbonTxt: {
    ...LEVEL_FONT, fontSize: 36, color: '#FFFFFF', letterSpacing: 1,
    textShadowColor: '#1B4FA0', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1,
  },
  close: { position: 'absolute', top: HANGER_H + 2, right: -6 },
  closeFace: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#A8DAFF',
  },
  closeTxt: { color: '#1B4FA0', fontSize: 22, fontWeight: '900' },
});

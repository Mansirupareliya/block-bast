import React, { useEffect, useMemo, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './AppText';
import { DOT_COLORS } from '../utils/colorConnect';
import { DOT_IMAGES } from '../utils/colorConnectAssets';
import { LEVEL_FONT } from '../utils/fonts';

// The celebration that plays when a pair of dots gets connected. Drawn on top
// of the board (in board coordinates) and removed by the screen when done.
//   1. the line flashes bright white and glows, then fades back
//   2. a glowing comet with a trail races along the line, dot to dot
//   3. both balls pop (bounce bigger with a white flash) and settle
//   4. two shockwave rings expand from each ball
//   5. a burst of coloured / white sparks and little stars from each ball
//   6. a praise word floats up from the middle of the line
// Everything uses the native driver, so it stays smooth during a drag.
export const CONNECT_FX_MS = 1100;

const PRAISE = ['Nice!', 'Great!', 'Awesome!', 'Super!', 'Brilliant!', 'Perfect!'];
const SPARKS = 12;

function ConnectFX({ path, color, n, cs, linePath }) {
  const c = DOT_COLORS[color];
  const center = (cell) => [((cell % n) + 0.5) * cs, (Math.floor(cell / n) + 0.5) * cs];
  const pts = useMemo(() => path.map(center), [path, n, cs]); // eslint-disable-line react-hooks/exhaustive-deps
  const ends = [pts[0], pts[pts.length - 1]];
  const mid = pts[Math.floor(pts.length / 2)];

  const flash = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const praise = useRef(new Animated.Value(0)).current;

  // Random but fixed for this effect's lifetime.
  const word = useMemo(() => PRAISE[Math.floor(Math.random() * PRAISE.length)], []);
  const sparks = useMemo(() => Array.from({ length: SPARKS }, (_, i) => ({
    angle: (i / SPARKS) * Math.PI * 2 + Math.random() * 0.4,
    dist: cs * (0.7 + Math.random() * 0.7),
    size: Math.max(3, cs * (0.08 + Math.random() * 0.08)),
    star: i % 3 === 0,
    white: i % 2 === 1,
  })), [cs]);

  useEffect(() => {
    const steps = Math.max(1, pts.length - 1);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.timing(travel, {
        toValue: steps, duration: Math.min(650, 160 + steps * 45), easing: Easing.inOut(Easing.quad), useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 3, tension: 180, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 2, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(burst, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(praise, { toValue: 1, duration: CONNECT_FX_MS - 50, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Comet position along the path: one interpolation point per cell.
  const idx = pts.map((_, i) => i);
  const single = pts.length < 2;
  const cometX = single ? pts[0][0] : travel.interpolate({ inputRange: idx, outputRange: pts.map((p) => p[0]) });
  const cometY = single ? pts[0][1] : travel.interpolate({ inputRange: idx, outputRange: pts.map((p) => p[1]) });
  const cometOpacity = travel.interpolate({
    inputRange: [0, 0.2, Math.max(0.3, pts.length - 1.4), Math.max(0.4, pts.length - 1)],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });

  const ball = cs * 0.52;
  const popScale = pop.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.45, 1] });
  const popFlash = pop.interpolate({ inputRange: [0, 0.6, 2], outputRange: [0, 0.75, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. line flash */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: flash }]}>
        <Svg width={cs * n} height={cs * n}>
          <Path d={linePath} fill="none" stroke={c} strokeOpacity={0.35} strokeWidth={cs * 0.7} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={linePath} fill="none" stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={cs * 0.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>

      {/* 2. comet with a short trail */}
      {[0.9, 0.55, 0.3].map((lag, i) => {
        const r = cs * (0.3 - i * 0.07);
        const x = single ? cometX : travel.interpolate({
          inputRange: idx.map((v) => v + lag * i), outputRange: pts.map((p) => p[0]), extrapolate: 'clamp',
        });
        const y = single ? cometY : travel.interpolate({
          inputRange: idx.map((v) => v + lag * i), outputRange: pts.map((p) => p[1]), extrapolate: 'clamp',
        });
        return (
          <Animated.View key={`c${i}`} style={{
            position: 'absolute', left: -r, top: -r, width: r * 2, height: r * 2, borderRadius: r,
            backgroundColor: i === 0 ? '#FFFFFF' : c,
            opacity: Animated.multiply(cometOpacity, 1 - i * 0.3),
            transform: [{ translateX: i === 0 ? cometX : x }, { translateY: i === 0 ? cometY : y }],
            shadowColor: c, shadowOpacity: 1, shadowRadius: r, elevation: 0,
            borderWidth: i === 0 ? r * 0.35 : 0, borderColor: c,
          }} />
        );
      })}

      {ends.map(([x, y], e) => (
        <React.Fragment key={`e${e}`}>
          {/* 4. shockwave rings */}
          {[0, 1].map((w) => {
            const t = burst.interpolate({
              inputRange: [w * 0.15, Math.min(1, 0.75 + w * 0.15)], outputRange: [0, 1], extrapolate: 'clamp',
            });
            return (
              <Animated.View key={`w${w}`} style={{
                position: 'absolute', left: x - cs * 0.5, top: y - cs * 0.5, width: cs, height: cs, borderRadius: cs,
                borderWidth: Math.max(2, cs * (w ? 0.04 : 0.07)), borderColor: w ? '#FFFFFF' : c,
                opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.1 + w * 0.4] }) }],
              }} />
            );
          })}

          {/* 5. spark + star burst */}
          {sparks.map((sp, i) => {
            const d = burst.interpolate({ inputRange: [0, 1], outputRange: [0, sp.dist] });
            const style = {
              position: 'absolute', left: x - sp.size / 2, top: y - sp.size / 2,
              opacity: burst.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 0.8, 0] }),
              transform: [
                { translateX: Animated.multiply(d, Math.cos(sp.angle + e)) },
                { translateY: Animated.multiply(d, Math.sin(sp.angle + e)) },
                { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 0.3] }) },
              ],
            };
            return sp.star ? (
              <Animated.Text key={`s${i}`} style={[style, {
                left: x - sp.size, top: y - sp.size * 1.3, fontSize: sp.size * 2.2,
                color: sp.white ? '#FFFFFF' : c, textShadowColor: c, textShadowRadius: 6,
              }]}>✦</Animated.Text>
            ) : (
              <Animated.View key={`s${i}`} style={[style, {
                width: sp.size, height: sp.size, borderRadius: sp.size, backgroundColor: sp.white ? '#FFFFFF' : c,
              }]} />
            );
          })}

          {/* 3. ball pop: a copy of the ball bounces over the real one */}
          <Animated.View style={{
            position: 'absolute', left: x - ball / 2, top: y - ball / 2, width: ball, height: ball,
            transform: [{ scale: popScale }],
          }}>
            <Image source={DOT_IMAGES[color]} fadeDuration={0} style={{ width: ball, height: ball }} />
            <Animated.View style={{
              ...StyleSheet.absoluteFillObject, borderRadius: ball, backgroundColor: '#FFFFFF', opacity: popFlash,
            }} />
          </Animated.View>
        </React.Fragment>
      ))}

      {/* 6. floating praise */}
      <Animated.View style={{
        position: 'absolute', left: mid[0] - cs * 2, top: mid[1] - cs * 0.9, width: cs * 4, alignItems: 'center',
        opacity: praise.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: praise.interpolate({ inputRange: [0, 1], outputRange: [0, -cs * 0.9] }) },
          { scale: praise.interpolate({ inputRange: [0, 0.15, 0.3, 1], outputRange: [0.4, 1.25, 1, 1] }) },
        ],
      }}>
        <Text style={[styles.praise, { fontSize: Math.max(18, Math.min(30, cs * 0.5)), textShadowColor: c }]}>
          {word}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  praise: { ...LEVEL_FONT, color: '#FFFFFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10, letterSpacing: 1 },
});

export default React.memo(ConnectFX);

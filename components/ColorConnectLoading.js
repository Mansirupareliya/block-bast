import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Text as SvgText, G, Circle, Rect, Path, Ellipse,
} from 'react-native-svg';

// Color Connect's loading splash: soft blue-to-lilac sky with puffy clouds,
// a chunky white/cream "COLOR CONNECT" title on a thick royal-blue outline,
// little dot tiles bobbing around it, and a "Loading..." label over a green
// filling bar. Calls onDone once the bar is full.

const { width: SW, height: SH } = Dimensions.get('window');
const FONT = 'LilitaOne';
const DURATION = 2200;
const TITLE_W = Math.min(SW * 0.86, 380);

// ── Clouds ────────────────────────────────────────────────────────────────
// Each cloud is a cluster of soft circles (radial gradient fading out at the
// rim), so the edges blur into the sky instead of looking cut out.
const CLOUDS = [
  // [centre x, centre y (fractions of the screen), scale, tint]
  [0.08, 0.07, 0.55, 'w'],
  [0.98, 0.17, 0.5, 'w'],
  [0.05, 0.36, 0.9, 'p'],
  [0.95, 0.42, 1.0, 'p'],
  [0.08, 0.64, 1.0, 'p'],
  [0.9, 0.73, 1.1, 'p'],
  [0.4, 0.86, 1.3, 'p'],
  [0.0, 0.95, 1.2, 'w'],
  [0.85, 0.98, 1.3, 'w'],
];
const PUFFS = [[0, 0, 1], [-0.9, 0.25, 0.75], [0.95, 0.2, 0.8], [-0.4, -0.45, 0.7], [0.45, -0.4, 0.72], [0, 0.45, 0.85]];

function Clouds() {
  const base = SW * 0.2;
  const out = [];
  CLOUDS.forEach(([fx, fy, scale, tint], i) => {
    const r = base * scale;
    PUFFS.forEach(([dx, dy, rs], j) => {
      out.push(
        <Circle key={`${i}-${j}`} cx={fx * SW + dx * r} cy={fy * SH + dy * r} r={r * rs}
          fill={`url(#${tint === 'w' ? 'puffW' : 'puffP'})`} />,
      );
    });
  });
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="puffW" cx="50%" cy="45%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="0.7" stopColor="#F2F4FF" stopOpacity="0.75" />
          <Stop offset="1" stopColor="#E6ECFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="puffP" cx="50%" cy="40%" r="50%">
          <Stop offset="0" stopColor="#FFF2FB" stopOpacity="0.95" />
          <Stop offset="0.65" stopColor="#E9C9F2" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#C9A8EE" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {out}
    </Svg>
  );
}

// ── Floating tiles ────────────────────────────────────────────────────────
// Glossy game tiles (cream face, red base) showing a coloured dot with a
// bit of line, in place of the fruit tiles in a classic tile-match splash.
function Tile({ size, color, line, style, phase }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(phase),
      Animated.timing(bob, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, phase]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.12] });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, { transform: [...(style.transform || []), { translateY }] }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect x={6} y={14} width={88} height={84} rx={18} fill="#C9443A" />
        <Rect x={6} y={6} width={88} height={82} rx={18} fill="#FFF8EC" />
        <Rect x={12} y={10} width={76} height={20} rx={10} fill="#FFFFFF" opacity={0.8} />
        <Path d={line} stroke={color} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Circle cx={50} cy={47} r={20} fill={color} />
        <Ellipse cx={43} cy={40} rx={7} ry={5} fill="#FFFFFF" opacity={0.6} />
      </Svg>
    </Animated.View>
  );
}

// ── Title ─────────────────────────────────────────────────────────────────
// One word: deep-blue 3D base, thick royal-blue outline, darker face edge
// for depth, gradient face, gloss.
function BubbleWord({ text, x, y, size, grad, edge }) {
  const common = {
    x, y, fontSize: size, fontFamily: FONT, textAnchor: 'middle',
    strokeLinejoin: 'round', strokeLinecap: 'round',
  };
  return (
    <G>
      <SvgText {...common} y={y + size * 0.1} fill="#25209A" stroke="#25209A" strokeWidth={size * 0.34}>{text}</SvgText>
      <SvgText {...common} fill="#3F3CD4" stroke="#3F3CD4" strokeWidth={size * 0.3}>{text}</SvgText>
      <SvgText {...common} fill="none" stroke="#6E6CF2" strokeWidth={size * 0.12} strokeOpacity={0.6}>{text}</SvgText>
      <SvgText {...common} y={y + size * 0.07} fill={edge}>{text}</SvgText>
      <SvgText {...common} fill={`url(#${grad})`}>{text}</SvgText>
      <SvgText {...common} fill="url(#gloss)">{text}</SvgText>
    </G>
  );
}

function Title({ width }) {
  return (
    <Svg width={width} height={width * 0.66} viewBox="0 0 400 264">
      <Defs>
        <SvgGradient id="whiteFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.6" stopColor="#F4F7FF" />
          <Stop offset="1" stopColor="#DCE6FF" />
        </SvgGradient>
        <SvgGradient id="creamFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFBF2" />
          <Stop offset="0.6" stopColor="#FFF0D8" />
          <Stop offset="1" stopColor="#F7DDB4" />
        </SvgGradient>
        <SvgGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
          <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="0.37" stopColor="#FFFFFF" stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <BubbleWord text="COLOR" x={200} y={112} size={108} grad="whiteFace" edge="#A9B8E8" />
      <BubbleWord text="CONNECT" x={200} y={216} size={80} grad="creamFace" edge="#D9A877" />
    </Svg>
  );
}

// "Loading..." in white with a dark navy outline.
function LoadingLabel({ dots }) {
  const label = `Loading${'.'.repeat(dots)}`;
  const common = { x: 100, y: 34, fontSize: 30, fontFamily: FONT, textAnchor: 'middle', strokeLinejoin: 'round' };
  return (
    <Svg width={200} height={46} viewBox="0 0 200 46">
      <SvgText {...common} y={37} fill="#1E2354" stroke="#1E2354" strokeWidth={7}>{label}</SvgText>
      <SvgText {...common} fill="#1E2354" stroke="#1E2354" strokeWidth={6}>{label}</SvgText>
      <SvgText {...common} fill="#FFFFFF">{label}</SvgText>
    </Svg>
  );
}

export default function ColorConnectLoading({ onDone }) {
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [dots, setDots] = useState(1);
  const [barW, setBarW] = useState(0);

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    const anim = Animated.timing(progress, {
      toValue: 1, duration: DURATION, easing: Easing.inOut(Easing.quad), useNativeDriver: false,
    });
    anim.start(({ finished }) => { if (finished) setTimeout(onDone, 180); });
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 380);
    return () => { anim.stop(); clearInterval(t); };
  }, [progress, pop, onDone]);

  // Never fully empty, like the reference: a small green nub shows at once.
  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [Math.min(barW, 24), Math.max(0, barW)] });
  const t = TITLE_W;

  return (
    <View style={st.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <LinearGradient colors={['#3D8DF2', '#5E9CF4', '#8FA6F2', '#B5A8EE', '#C3A6EA']}
        locations={[0, 0.3, 0.55, 0.8, 1]} style={StyleSheet.absoluteFill} />
      <Clouds />

      <Animated.View style={[st.titleWrap, {
        opacity: pop,
        transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }]}>
        <Title width={t} />
        <Tile size={t * 0.2} color="#FF3B30" line="M50 47 L50 90" phase={0}
          style={{ top: -t * 0.14, right: t * 0.2, transform: [{ rotate: '8deg' }] }} />
        <Tile size={t * 0.18} color="#FFB800" line="M50 47 L90 47" phase={400}
          style={{ top: t * 0.12, left: -t * 0.02, transform: [{ rotate: '-12deg' }] }} />
        <Tile size={t * 0.16} color="#2FD158" line="M50 47 L10 47" phase={800}
          style={{ top: t * 0.24, right: -t * 0.03, transform: [{ rotate: '10deg' }] }} />
      </Animated.View>

      <View style={st.loadingWrap}>
        <LoadingLabel dots={dots} />
        <View style={st.barOuter}>
          <View style={st.barTrack} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <Animated.View style={[st.barFill, { width: fillW }]}>
              <LinearGradient colors={['#9CF57A', '#4FD84A', '#2DB533']} style={StyleSheet.absoluteFill} />
              <View style={st.barShine} />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6FA0F3', alignItems: 'center' },
  titleWrap: { marginTop: SH * 0.2, width: TITLE_W, alignItems: 'center' },
  loadingWrap: { position: 'absolute', top: SH * 0.66, alignItems: 'center', width: '100%' },
  barOuter: {
    marginTop: 4, width: Math.min(SW * 0.66, 360), height: 30, borderRadius: 15,
    backgroundColor: '#5B5FA8', padding: 3,
    shadowColor: '#1E2354', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  barTrack: { flex: 1, borderRadius: 12, backgroundColor: '#272845', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 12, overflow: 'hidden' },
  barShine: {
    position: 'absolute', top: 3, left: 6, right: 6, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

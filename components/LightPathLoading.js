import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, StatusBar, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Text as SvgText, G, Polygon, Rect, Ellipse,
} from 'react-native-svg';

// Light Path's loading splash: bubbly two-tone "LIGHT PATH" title over a
// purple hex-patterned backdrop, with a "Loading..." label and a filling
// bar. Calls onDone once the bar is full.

const { width: SW, height: SH } = Dimensions.get('window');
const FONT = 'LilitaOne';
const DURATION = 2200;
const TITLE_W = Math.min(SW * 0.68, 300); // width of the "LIGHT PATH" title

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

// Faint honeycomb across the whole screen, fading in toward the bottom.
function HexPattern() {
  const r = 34;
  const w = r * 1.5;
  const h = r * Math.sqrt(3);
  const hexes = [];
  for (let col = 0; col * w < SW + r; col++) {
    for (let row = 0; row * h < SH + h; row++) {
      const cx = col * w;
      const cy = row * h + (col % 2 ? h / 2 : 0);
      if (cy < SH * 0.42) continue;
      const o = 0.05 + 0.07 * ((cy - SH * 0.42) / (SH * 0.58));
      hexes.push(<Polygon key={`${col}-${row}`} points={hexPoints(cx, cy, r - 5)} fill="#2A1470" opacity={o} />);
    }
  }
  return <Svg style={StyleSheet.absoluteFill} pointerEvents="none">{hexes}</Svg>;
}

// A chunky glossy hexagon gem, like the ones floating around the title.
function Gem({ size, top, color, dark, left, right, rotate = 0 }) {
  return (
    <View style={{ position: 'absolute', top, left, right, transform: [{ rotate: `${rotate}deg` }] }} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points={hexPoints(50, 56, 44)} fill={dark} />
        <Polygon points={hexPoints(50, 48, 44)} fill={color} />
        <Polygon points={hexPoints(50, 48, 30)} fill="#FFFFFF" opacity={0.18} />
        <Ellipse cx={36} cy={30} rx={12} ry={6} fill="#FFFFFF" opacity={0.55} />
      </Svg>
    </View>
  );
}

// One word of the title: dark 3D base, thick outline, gradient face, gloss.
function BubbleWord({ text, x, y, size, rotate, grad, outline, depth }) {
  const common = {
    x, y, fontSize: size, fontFamily: FONT, textAnchor: 'middle',
    strokeLinejoin: 'round', strokeLinecap: 'round',
  };
  return (
    <G rotation={rotate} origin={`${x}, ${y}`}>
      <SvgText {...common} y={y + size * 0.09} fill={depth} stroke={depth} strokeWidth={size * 0.16}>{text}</SvgText>
      <SvgText {...common} fill={outline} stroke={outline} strokeWidth={size * 0.14}>{text}</SvgText>
      <SvgText {...common} fill={`url(#${grad})`}>{text}</SvgText>
      <SvgText {...common} fill="url(#gloss)">{text}</SvgText>
    </G>
  );
}

function Title({ width }) {
  return (
    <Svg width={width} height={width * 0.72} viewBox="0 0 360 260">
      <Defs>
        <SvgGradient id="cyanFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B4FAFF" />
          <Stop offset="0.45" stopColor="#5FD8FF" />
          <Stop offset="1" stopColor="#2A9BF2" />
        </SvgGradient>
        <SvgGradient id="goldFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF07A" />
          <Stop offset="0.5" stopColor="#FFC81E" />
          <Stop offset="1" stopColor="#FF9A0A" />
        </SvgGradient>
        <SvgGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <Stop offset="0.38" stopColor="#FFFFFF" stopOpacity="0.1" />
          <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <BubbleWord text="LIGHT" x={182} y={112} size={108} rotate={-3}
        grad="cyanFace" outline="#1A3FA8" depth="#14287A" />
      <BubbleWord text="PATH" x={178} y={228} size={112} rotate={-2}
        grad="goldFace" outline="#7A3410" depth="#55230A" />
    </Svg>
  );
}

// "Loading..." in dark navy with a cream outline.
function LoadingLabel({ dots }) {
  const label = `Loading${'.'.repeat(dots)}`;
  const common = { x: 8, y: 34, fontSize: 32, fontFamily: FONT, strokeLinejoin: 'round' };
  return (
    <Svg width={200} height={46} viewBox="0 0 200 46">
      <SvgText {...common} fill="#FFF4D6" stroke="#FFF4D6" strokeWidth={7}>{label}</SvgText>
      <SvgText {...common} fill="#1E2354">{label}</SvgText>
    </Svg>
  );
}

export default function LightPathLoading({ onDone }) {
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

  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, barW)] });
  const titleW = TITLE_W;

  return (
    <View style={st.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <LinearGradient colors={['#2F2A8F', '#5B3FC4', '#8C5FE0', '#7246CC', '#5A33B0']}
        locations={[0, 0.25, 0.5, 0.75, 1]} style={StyleSheet.absoluteFill} />

      {/* Soft glow behind the middle plus two stage-light beams from the top */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#C9A8FF" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#C9A8FF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={SW / 2} cy={SH * 0.5} rx={SW * 0.8} ry={SH * 0.3} fill="url(#glow)" />
        <Polygon points={`${SW * 0.08},0 ${SW * 0.3},0 ${SW * 0.62},${SH * 0.45} ${SW * 0.34},${SH * 0.45}`} fill="#FFFFFF" opacity={0.05} />
        <Polygon points={`${SW * 0.6},0 ${SW * 0.78},0 ${SW * 0.66},${SH * 0.4} ${SW * 0.44},${SH * 0.4}`} fill="#FFFFFF" opacity={0.035} />
        <Rect x={0} y={0} width={SW} height={SH * 0.08} fill="#1C1660" opacity={0.35} />
      </Svg>
      <HexPattern />

      <Animated.View style={[st.titleWrap, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: pop }]}>
        <Gem size={titleW * 0.17} top={-4} left={titleW * 0.02} rotate={-14} color="#FF4B3E" dark="#B3201A" />
        <Gem size={titleW * 0.15} top={-12} right={titleW * 0.03} rotate={12} color="#3FD651" dark="#1E8A2C" />
        <Gem size={titleW * 0.2} top={titleW * 0.42} left={-titleW * 0.04} rotate={-8} color="#4FB4FF" dark="#1F6FC4" />
        <Gem size={titleW * 0.24} top={titleW * 0.44} right={-titleW * 0.05} rotate={10} color="#B44CFF" dark="#7120B8" />
        <Title width={titleW} />
      </Animated.View>

      <View style={st.loadingWrap}>
        <LoadingLabel dots={dots} />
        <View style={st.barOuter}>
          <View style={st.barTrack} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <Animated.View style={[st.barFill, { width: fillW }]}>
              <LinearGradient colors={['#FFD54A', '#FFB400', '#FF9C00']} style={StyleSheet.absoluteFill} />
              <View style={st.barShine} />
            </Animated.View>
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#4A2FA8', alignItems: 'center' },
  titleWrap: { marginTop: SH * 0.16, width: TITLE_W, alignItems: 'center' },
  loadingWrap: { position: 'absolute', bottom: SH * 0.12, alignItems: 'center', width: '100%' },
  barOuter: {
    marginTop: 4, width: Math.min(SW * 0.6, 340), height: 30, borderRadius: 15,
    backgroundColor: '#FFF1C9', padding: 4,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  barTrack: { flex: 1, borderRadius: 11, backgroundColor: '#273160', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 11, overflow: 'hidden' },
  barShine: {
    position: 'absolute', top: 3, left: 6, right: 6, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

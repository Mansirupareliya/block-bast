import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, Pressable, Image, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, LinearGradient as SvgGradient, Stop, Rect, Polygon, Text as SvgText,
} from 'react-native-svg';
import { Text } from './AppText';
import { Planks } from './LightPathLevelMap';
import { LEVEL_FONT } from '../utils/fonts';
import { subscribeStreak, addCoins } from '../utils/dailyStreak';
import { showInterstitial } from '../utils/interstitialAd';
import { playTap, playWin } from '../utils/audioManager';

// Light Path's full-screen "Level Complete" page: falling confetti, an
// orange ribbon banner, the stars earned, a total-stars progress card, and a
// coin reward. A pointer slides along a multiplier bar; the green button
// stops it, shows an ad and pays base x multiplier, the orange one pays the
// base coins. Either then moves on (onNext).

const { width: SW, height: SH } = Dimensions.get('window');
const COIN_IMG = require('../assets/coin.png');
const FONT = 'LilitaOne';

const BASE_COINS = 10;
const MULTS = [1.5, 2, 2.5, 3, 2.5, 2, 1.5];
const MULT_COLORS = ['#E8392C', '#F07A2A', '#F6B83A', '#7CCB3A', '#F6B83A', '#F07A2A', '#E8392C'];
const BAR_W = Math.min(SW - 40, 380);
const SEG_W = BAR_W / MULTS.length;

const CONFETTI_COLORS = ['#FF4D4D', '#FF9F1C', '#FFD23F', '#3BE8FF', '#2D9CFF', '#7CCB3A', '#FF5FA8'];

// Text with a solid outline (stroke drawn underneath the fill).
function OutlinedText({ text, width, height, size, fill = '#FFFFFF', outline, strokeWidth, x, y, anchor = 'middle' }) {
  const common = {
    x: x ?? width / 2, y: y ?? height / 2 + size * 0.35, fontSize: size, fontFamily: FONT,
    textAnchor: anchor, strokeLinejoin: 'round',
  };
  return (
    <Svg width={width} height={height}>
      <SvgText {...common} fill={outline} stroke={outline} strokeWidth={strokeWidth ?? size * 0.18}>{text}</SvgText>
      <SvgText {...common} fill={fill}>{text}</SvgText>
    </Svg>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────
function ConfettiPiece({ delay, x, color, w, h, duration, spin }) {
  const fall = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(fall, {
      toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [fall, duration, delay]);
  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-30, SH + 30] });
  const translateX = fall.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 14, 0, -14, 0] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spin}deg`] });
  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: x, width: w, height: h, borderRadius: 1.5, backgroundColor: color,
      transform: [{ translateY }, { translateX }, { rotate }],
    }} />
  );
}

function Confetti({ count = 46 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    key: i,
    x: Math.random() * SW,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 4 + Math.random() * 4,
    h: 10 + Math.random() * 8,
    delay: Math.random() * 3000,
    duration: 3200 + Math.random() * 2600,
    spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
  })), [count]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(({ key, ...p }) => <ConfettiPiece key={key} {...p} />)}
    </View>
  );
}

// ── Ribbon banner ─────────────────────────────────────────────────────────
function sparkle(cx, cy, r) {
  const k = r * 0.28;
  return `${cx},${cy - r} ${cx + k},${cy - k} ${cx + r},${cy} ${cx + k},${cy + k} ${cx},${cy + r} ${cx - k},${cy + k} ${cx - r},${cy} ${cx - k},${cy - k}`;
}

function Ribbon({ width }) {
  return (
    <Svg width={width} height={width / 3} viewBox="0 0 360 120">
      <Defs>
        <SvgGradient id="ribbonFace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF9F5A" />
          <Stop offset="1" stopColor="#F05A24" />
        </SvgGradient>
      </Defs>
      {/* tails behind, with the folds that tuck under the banner */}
      <Polygon points="4,46 66,46 66,106 4,106 26,76" fill="#E4501F" />
      <Polygon points="356,46 294,46 294,106 356,106 334,76" fill="#E4501F" />
      <Polygon points="50,92 66,92 66,106" fill="#9E3210" />
      <Polygon points="310,92 294,92 294,106" fill="#9E3210" />
      {/* front banner */}
      <Rect x={48} y={18} width={264} height={76} rx={14} fill="url(#ribbonFace)" />
      <Rect x={58} y={23} width={244} height={14} rx={7} fill="#FFFFFF" opacity={0.28} />
      <Polygon points={sparkle(70, 58, 11)} fill="#FFD94A" />
      <Polygon points={sparkle(290, 58, 11)} fill="#FFD94A" />
      <SvgText x={180} y={70} fontSize={33} fontFamily={FONT} textAnchor="middle"
        fill="#B03E14" stroke="#B03E14" strokeWidth={6} strokeLinejoin="round">LEVEL COMPLETE</SvgText>
      <SvgText x={180} y={70} fontSize={33} fontFamily={FONT} textAnchor="middle" fill="#FFF6E2">LEVEL COMPLETE</SvgText>
    </Svg>
  );
}

// ── Stars earned this level, popping in one after another ────────────────
function StarShape({ size, filled }) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size / 2 : size * 0.21;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${size / 2 + r * Math.cos(a)},${size / 2 + r * Math.sin(a)}`);
  }
  return (
    <Svg width={size} height={size}>
      <Polygon points={pts.join(' ')} fill={filled ? '#FFC93C' : '#E6D3B8'}
        stroke={filled ? '#B97A0F' : '#BFA888'} strokeWidth={2.5} strokeLinejoin="round" />
    </Svg>
  );
}

function EarnedStars({ stars }) {
  const pops = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(220, pops.map((v) => Animated.spring(v, {
      toValue: 1, friction: 4, tension: 90, useNativeDriver: true,
    }))).start();
  }, [pops]);
  return (
    <View style={st.starsRow}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{
          marginTop: i === 1 ? 0 : 18,
          transform: [{ scale: pops[i] }, { rotate: i === 0 ? '-12deg' : i === 2 ? '12deg' : '0deg' }],
        }}>
          <StarShape size={i === 1 ? 74 : 58} filled={i < stars} />
        </Animated.View>
      ))}
    </View>
  );
}

// ── Total stars progress card ─────────────────────────────────────────────
function StarsCard({ total, max }) {
  const pct = Math.max(0.04, Math.min(1, total / max));
  return (
    <View style={st.card}>
      <View style={{ flex: 1, paddingLeft: 18, paddingRight: 8 }}>
        <OutlinedText text="Total Stars" width={190} height={34} size={24} outline="#3A2B8A" x={0} anchor="start" />
        <View style={st.cardTrack}>
          <View style={[st.cardFill, { width: `${pct * 100}%` }]} />
          <Text style={st.cardTrackTxt}>{total}/{max}</Text>
        </View>
      </View>
      <View style={st.cardBadge}>
        <StarShape size={46} filled />
      </View>
    </View>
  );
}

// ── Multiplier bar with the sliding pointer ──────────────────────────────
function MultiplierBar({ pos }) {
  const translateX = pos.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_W - 1] });
  return (
    <View style={{ width: BAR_W + 12, alignItems: 'center' }}>
      <View style={st.barOuter}>
        <View style={st.barInner}>
          {MULTS.map((m, i) => (
            <View key={i} style={[st.seg, { backgroundColor: MULT_COLORS[i] }]}>
              <OutlinedText text={`x${m}`} width={SEG_W} height={40} size={17} outline="rgba(90,30,10,0.75)" strokeWidth={3.5} />
            </View>
          ))}
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[st.pointer, { transform: [{ translateX }] }]}>
        <Svg width={34} height={30}>
          <Polygon points="3,3 31,3 17,27" fill="#FFFFFF" stroke="#5A4A6A" strokeWidth={3} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Chunky 3D reward button: darker base under a glossy face.
function RewardButton({ colors, base, onPress, disabled, children }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <View style={[st.btnWrap, disabled && { opacity: 0.6 }]}>
          <View style={[st.btnBase, { backgroundColor: base }]} />
          <LinearGradient colors={colors} style={[st.btnFace, { borderColor: base, transform: [{ translateY: pressed ? 4 : 0 }] }]}>
            <View style={st.btnShine} />
            <View style={st.btnRow}>{children}</View>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

export default function LightPathComplete({ levelNum, stars, totalStars, maxStars, onNext, onReplay, onHome }) {
  const [coins, setCoins] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mult, setMult] = useState(null); // multiplier the pointer stopped on
  const pos = useRef(new Animated.Value(0)).current;
  const posNow = useRef(0);
  const anim = useRef(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeStreak((s) => setCoins(s.coins)), []);

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }).start();
    const id = pos.addListener(({ value }) => { posNow.current = value; });
    anim.current = Animated.loop(Animated.sequence([
      Animated.timing(pos, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pos, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    anim.current.start();
    return () => { anim.current?.stop(); pos.removeListener(id); };
  }, [pos, enter]);

  // While sliding, the green button shows what the pointer is on right now.
  const [liveMult, setLiveMult] = useState(MULTS[0]);
  useEffect(() => {
    const t = setInterval(() => {
      const i = Math.min(MULTS.length - 1, Math.floor(posNow.current * MULTS.length));
      setLiveMult(MULTS[i]);
    }, 80);
    return () => clearInterval(t);
  }, []);
  const shownMult = mult ?? liveMult;
  const bonus = Math.round(BASE_COINS * shownMult);

  const claimBonus = () => {
    if (busy) return;
    playTap();
    anim.current?.stop();
    const i = Math.min(MULTS.length - 1, Math.floor(posNow.current * MULTS.length));
    const m = MULTS[i];
    setMult(m);
    setBusy(true);
    const amount = Math.round(BASE_COINS * m);
    // Watching the ad earns the multiplied reward; the reward is paid
    // whether or not an ad was actually ready to show.
    setTimeout(() => showInterstitial(() => {
      addCoins(amount);
      playWin();
      setTimeout(onNext, 450);
    }), 500);
  };

  const claimBase = () => {
    if (busy) return;
    playTap();
    setBusy(true);
    anim.current?.stop();
    addCoins(BASE_COINS);
    setTimeout(onNext, 250);
  };

  const pop = enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
      <Planks />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,238,228,0.88)' }]} />
      <Confetti />

      {/* top bar: home, level title, coin balance */}
      <View style={st.topBar}>
        <Pressable onPress={() => { if (!busy) { playTap(); onHome(); } }} hitSlop={12} style={st.homeBtn}>
          <Text style={st.homeTxt}>⌂</Text>
        </Pressable>
        <OutlinedText text={`Level ${levelNum}`} width={150} height={44} size={30} fill="#FFFFFF" outline="#8A7A80" strokeWidth={4} />
        <View style={st.coinPill}>
          <Image source={COIN_IMG} style={st.coinIcon} />
          <Text style={st.coinPillTxt}>{coins}</Text>
        </View>
      </View>

      <Animated.View style={[st.center, { opacity: enter, transform: [{ scale: pop }] }]}>
        <Ribbon width={Math.min(SW - 16, 400)} />
        <EarnedStars stars={stars} />
        <StarsCard total={totalStars} max={maxStars} />
      </Animated.View>

      <View style={st.bottom}>
        <MultiplierBar pos={pos} />
        <View style={st.btnRowOuter}>
          <RewardButton colors={['#8BE04A', '#5CC22A', '#43A81A']} base="#2F7F10" onPress={claimBonus} disabled={busy}>
            <OutlinedText text={`${bonus}`} width={52} height={44} size={30} outline="#2F6A0E" strokeWidth={5} />
            <Image source={COIN_IMG} style={st.btnCoin} />
            <View style={st.playIcon}>
              <Svg width={16} height={16}><Polygon points="3,1 15,8 3,15" fill="#3D7A16" /></Svg>
            </View>
          </RewardButton>
          <RewardButton colors={['#FFD15A', '#FFB52E', '#FF9A1A']} base="#C46A00" onPress={claimBase} disabled={busy}>
            <OutlinedText text={`${BASE_COINS}`} width={46} height={44} size={30} outline="#9A4F00" strokeWidth={5} />
            <Image source={COIN_IMG} style={st.btnCoin} />
          </RewardButton>
        </View>
        <Pressable onPress={() => { if (!busy) { playTap(); onReplay(); } }} hitSlop={10}>
          <Text style={st.replayTxt}>↻ Replay level</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 50,
  },
  homeBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6B4426', borderWidth: 3, borderColor: '#F3D9A8',
  },
  homeTxt: { fontSize: 24, color: '#FFF4DC', marginTop: -3 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', minWidth: 84, height: 36, borderRadius: 18,
    backgroundColor: '#6B4A42', paddingRight: 14,
  },
  coinIcon: { width: 40, height: 40, marginLeft: -10, marginRight: 4 },
  coinPillTxt: { ...LEVEL_FONT, fontSize: 20, color: '#FFFFFF', flex: 1, textAlign: 'right' },

  center: { alignItems: 'center', marginTop: SH * 0.06 },
  starsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4, marginBottom: 18 },

  card: {
    flexDirection: 'row', alignItems: 'center', width: Math.min(SW - 70, 330), height: 84,
    borderRadius: 22, backgroundColor: '#6F62E0', borderWidth: 3, borderColor: '#5246C0',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  cardTrack: {
    height: 24, borderRadius: 12, backgroundColor: '#3A2F9A', overflow: 'hidden',
    justifyContent: 'center', marginTop: 2,
  },
  cardFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12, backgroundColor: '#FFB52E' },
  cardTrackTxt: { ...LEVEL_FONT, fontSize: 15, color: '#FFFFFF', textAlign: 'center' },
  cardBadge: {
    width: 92, height: 92, borderRadius: 46, marginRight: -14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2C2466', borderWidth: 6, borderColor: '#7468E8',
  },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: SH * 0.07, alignItems: 'center' },
  barOuter: {
    width: BAR_W + 12, height: 56, borderRadius: 28, padding: 6, backgroundColor: '#FFF4EA',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  barInner: { flex: 1, flexDirection: 'row', borderRadius: 22, overflow: 'hidden' },
  seg: { width: SEG_W, alignItems: 'center', justifyContent: 'center' },
  pointer: { position: 'absolute', top: -20, left: 6 - 17 },

  btnRowOuter: { flexDirection: 'row', gap: 22, marginTop: 30 },
  btnWrap: { width: Math.min((SW - 70) / 2, 170), height: 64 },
  btnBase: { position: 'absolute', left: 0, right: 0, top: 6, height: 58, borderRadius: 22 },
  btnFace: {
    height: 58, borderRadius: 22, borderWidth: 2.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  btnShine: {
    position: 'absolute', top: 4, left: 12, right: 12, height: 13, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnCoin: { width: 30, height: 30, marginLeft: 2 },
  playIcon: {
    width: 26, height: 26, borderRadius: 5, marginLeft: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4FFE8', borderWidth: 2, borderColor: '#3D7A16',
  },
  replayTxt: { ...LEVEL_FONT, fontSize: 16, color: '#8A6A5A', marginTop: 18 },
});

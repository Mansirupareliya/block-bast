import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Floating particle block ───────────────────────────────────────────────
const PARTICLES = [
  { x: SW * 0.06,  delay: 0,    dur: 7000, size: 22, color: '#FF5252', rot: 20  },
  { x: SW * 0.18,  delay: 1400, dur: 8500, size: 14, color: '#FFD700', rot: -12 },
  { x: SW * 0.32,  delay: 700,  dur: 6500, size: 26, color: '#42A5F5', rot: 35  },
  { x: SW * 0.48,  delay: 2200, dur: 9000, size: 16, color: '#66BB6A', rot: -25 },
  { x: SW * 0.60,  delay: 500,  dur: 7500, size: 20, color: '#AB47BC', rot: 15  },
  { x: SW * 0.72,  delay: 1900, dur: 8000, size: 12, color: '#FF8C00', rot: -8  },
  { x: SW * 0.84,  delay: 1100, dur: 7200, size: 24, color: '#26C6DA', rot: 28  },
  { x: SW * 0.25,  delay: 3000, dur: 8800, size: 18, color: '#EC407A', rot: -18 },
  { x: SW * 0.55,  delay: 2600, dur: 7800, size: 10, color: '#FFD700', rot: 42  },
  { x: SW * 0.90,  delay: 400,  dur: 6800, size: 28, color: '#4CAF50', rot: -30 },
];

function Particle({ x, delay, dur, size, color, rot }) {
  const y   = useRef(new Animated.Value(SH + 40)).current;
  const op  = useRef(new Animated.Value(0)).current;
  const rotate = `${rot}deg`;

  useEffect(() => {
    const run = () => {
      y.setValue(SH + 40);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y,  { toValue: -60,  duration: dur,        useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.55, duration: 800,        useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.55, duration: dur - 1600, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,   duration: 800,        useNativeDriver: true }),
          ]),
        ]),
      ]).start(run);
    };
    run();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute', left: x,
      width: size, height: size, borderRadius: size * 0.22,
      backgroundColor: color,
      opacity: op,
      transform: [{ translateY: y }, { rotate }],
    }} />
  );
}

// ── Block Blast artwork ───────────────────────────────────────────────────
const BB_GRID = [
  ['#42A5F5','#AB47BC','#42A5F5','#FF5252'],
  ['#FF8C00','#42A5F5','#66BB6A','#42A5F5'],
  ['#42A5F5','#FF5252','#AB47BC','#66BB6A'],
  ['#66BB6A','#42A5F5','#FF5252','#FF8C00'],
];
function BlockArt() {
  const S = 24;
  return (
    <View style={{ borderRadius: 8, overflow: 'hidden', elevation: 6 }}>
      {BB_GRID.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((c, i) => (
            <View key={i} style={{ width: S, height: S, backgroundColor: c, margin: 1.5, borderRadius: 4 }}>
              <View style={{ position: 'absolute', top: 2, left: 2, width: '50%', height: '35%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 2 }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Tic-tac-toe artwork ───────────────────────────────────────────────────
const TTT_CELLS = ['✕','◯',null,'◯',null,'✕',null,'✕','◯'];
function TicArt() {
  const S = 28;
  return (
    <View style={{ borderRadius: 8, overflow: 'hidden' }}>
      {[0,1,2].map(r => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {[0,1,2].map(c => {
            const v = TTT_CELLS[r*3+c];
            return (
              <View key={c} style={{
                width: S, height: S, margin: 1.5,
                borderRadius: 6,
                backgroundColor: v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              }}>
                {v === '✕' && <Text style={{ color: '#64B5F6', fontSize: 13, fontWeight: 'bold' }}>✕</Text>}
                {v === '◯' && <Text style={{ color: '#FF6B6B', fontSize: 12, fontWeight: 'bold' }}>◯</Text>}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Memory Match artwork ──────────────────────────────────────────────────
const MEM_EMOJIS = ['🐶','🦊','🐸','🦋','🦄','🐙'];
function MemoryArt() {
  const S = 26;
  const revealed = [0, 3]; // indices that show emoji
  return (
    <View style={{ borderRadius: 8, overflow: 'hidden' }}>
      {[0,1].map(r => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {[0,1,2].map(c => {
            const idx = r * 3 + c;
            const show = revealed.includes(idx);
            return (
              <View key={c} style={{
                width: S, height: S, margin: 2, borderRadius: 6,
                backgroundColor: show ? '#1E1040' : '#4A148C',
                borderWidth: 1,
                borderColor: show ? 'rgba(124,77,255,0.5)' : 'rgba(186,104,200,0.3)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {show
                  ? <Text style={{ fontSize: 14 }}>{MEM_EMOJIS[idx % 3]}</Text>
                  : <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>✦</Text>
                }
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Game card ─────────────────────────────────────────────────────────────
function GameCard({ title, subtitle, tags, accent, art, onPress, enterAnim }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(pressScale, { toValue: 0.96, friction: 8, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(pressScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ width: '100%' }, enterAnim]}>
      <TouchableOpacity onPress={onPress} onPressIn={onIn} onPressOut={onOut} activeOpacity={1}>
        <Animated.View style={[styles.card, { transform: [{ scale: pressScale }] }]}>

          {/* Artwork banner */}
          <LinearGradient colors={[accent + 'EE', accent + '88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardBanner}>
            <View style={styles.artWrap}>{art}</View>
            {/* Diagonal decoration */}
            <View style={[styles.bannerDeco, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          </LinearGradient>

          {/* Info section */}
          <View style={styles.cardBody}>
            {/* Tags */}
            <View style={styles.tagRow}>
              {tags.map((t, i) => (
                <View key={i} style={[styles.tag, { borderColor: accent + '55', backgroundColor: accent + '18' }]}>
                  <Text style={[styles.tagText, { color: accent }]}>{t}</Text>
                </View>
              ))}
            </View>

            {/* Title + subtitle */}
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSub}>{subtitle}</Text>

            {/* Play row */}
            <View style={[styles.playRow, { borderTopColor: 'rgba(255,255,255,0.07)' }]}>
              <Text style={[styles.playLabel, { color: accent }]}>PLAY NOW</Text>
              <View style={[styles.playArrow, { backgroundColor: accent }]}>
                <Text style={styles.playArrowText}>›</Text>
              </View>
            </View>
          </View>

          {/* Subtle left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accent }]} />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────
export default function HomeScreen({ onSelect }) {
  const headerY  = useRef(new Animated.Value(-30)).current;
  const headerO  = useRef(new Animated.Value(0)).current;
  const card1Y   = useRef(new Animated.Value(50)).current;
  const card1O   = useRef(new Animated.Value(0)).current;
  const card2Y   = useRef(new Animated.Value(70)).current;
  const card2O   = useRef(new Animated.Value(0)).current;
  const card3Y   = useRef(new Animated.Value(90)).current;
  const card3O   = useRef(new Animated.Value(0)).current;
  const dotBlink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.spring(headerY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
        Animated.timing(headerO, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(card1Y, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(card1O, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(card2Y, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(card2O, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(card3Y, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(card3O, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(dotBlink, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      Animated.timing(dotBlink, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      {/* Background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080818' }]} />
      {/* Subtle radial glow at top */}
      <View style={styles.topGlow} />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      <View style={{ height: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 12 : 54 }} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: headerO, transform: [{ translateY: headerY }] }]}>
          {/* Live dot + label */}
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity: dotBlink }]} />
            <Text style={styles.liveText}>GAME HUB</Text>
          </View>

          <Text style={styles.headline}>
            Pick Your{'\n'}<Text style={styles.headlineAccent}>Game</Text>
          </Text>
          <Text style={styles.headlineSub}>3 games · Play offline · Free forever</Text>
        </Animated.View>

        {/* ── Cards ── */}
        <GameCard
          title="Block Blast"
          subtitle="Place blocks · Complete rows · Beat the score"
          tags={['🧩 PUZZLE', '♾ ENDLESS', '🏆 HIGH SCORE']}
          accent="#4C9EFF"
          art={<BlockArt />}
          onPress={() => onSelect('blockblast')}
          enterAnim={{ opacity: card1O, transform: [{ translateY: card1Y }] }}
        />

        <GameCard
          title="Tic-Tac-Toe"
          subtitle="You vs Computer · 3 difficulty levels · Track wins"
          tags={['🤖 VS AI', '🎯 STRATEGY', '🔴 3 MODES']}
          accent="#FF6B6B"
          art={<TicArt />}
          onPress={() => onSelect('tictactoe')}
          enterAnim={{ opacity: card2O, transform: [{ translateY: card2Y }] }}
        />

        <GameCard
          title="Memory Match"
          subtitle="Flip cards · Find pairs · Beat your time"
          tags={['🧠 MEMORY', '⏱ TIMED', '🃏 3 SIZES']}
          accent="#AA00FF"
          art={<MemoryArt />}
          onPress={() => onSelect('memorymatch')}
          enterAnim={{ opacity: card3O, transform: [{ translateY: card3Y }] }}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>Tap any card to start playing</Text>
          <View style={styles.footerDot} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },

  // background
  topGlow: {
    position: 'absolute', top: -120, left: SW / 2 - 150,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: '#2A1A6E',
    opacity: 0.5,
  },

  // Header
  header: { marginBottom: 28, marginTop: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4C9EFF', marginRight: 7 },
  liveText:  { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 3 },
  headline:  { color: '#FFFFFF', fontSize: 40, fontWeight: '800', lineHeight: 46, marginBottom: 8, letterSpacing: -0.5 },
  headlineAccent: {
    color: '#4C9EFF',
    textShadowColor: '#4C9EFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  headlineSub: { color: 'rgba(255,255,255,0.35)', fontSize: 13, letterSpacing: 0.3 },

  // Card
  card: {
    backgroundColor: '#11112A',
    borderRadius: 20,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },

  // Banner artwork area
  cardBanner: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artWrap: { alignItems: 'center', justifyContent: 'center', elevation: 8 },
  bannerDeco: {
    position: 'absolute', bottom: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
  },

  // Body
  cardBody: { padding: 16, paddingLeft: 18 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  tagText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  cardTitle: {
    color: '#FFFFFF', fontSize: 22, fontWeight: '800',
    marginBottom: 4, letterSpacing: -0.3,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 17, marginBottom: 14,
  },

  playRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, paddingTop: 12,
  },
  playLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  playArrow: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  playArrowText: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginTop: -2 },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 10 },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  footerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, letterSpacing: 0.5 },
});

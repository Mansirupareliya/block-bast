import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW } = Dimensions.get('window');

// ── Emoji pools ────────────────────────────────────────────────────────────
const ALL_EMOJIS = [
  '🐶','🐱','🦊','🐻','🐼','🦁','🐮','🐷',
  '🐸','🦋','🐬','🦄','🦖','🦈','🐙','🦀',
  '🐧','🦔','🦜','🐝','🦩','🐳','🦚','🐞',
];

const MODES = [
  { key: 'easy',   label: '4 × 4', cols: 4, pairs: 8,  emoji: '🟢' },
  { key: 'medium', label: '5 × 4', cols: 5, pairs: 10, emoji: '🟡' },
  { key: 'hard',   label: '6 × 6', cols: 6, pairs: 18, emoji: '🔴' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function buildDeck(pairs) {
  const pool = ALL_EMOJIS.slice(0, pairs);
  const deck = [...pool, ...pool]
    .sort(() => Math.random() - 0.5)
    .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
  return deck;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Card component ─────────────────────────────────────────────────────────
function MemoryCard({ card, size, onPress, scaleAnim, disabled }) {
  const isVisible = card.flipped || card.matched;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || card.matched || card.flipped}
      style={{ padding: size * 0.04 }}
    >
      <Animated.View style={[{ transform: [{ scaleX: scaleAnim }] }]}>
        {isVisible ? (
          /* Face up */
          <View style={[
            styles.cardFront,
            { width: size, height: size, borderRadius: size * 0.18 },
            card.matched && styles.cardMatched,
          ]}>
            {card.matched && (
              <LinearGradient
                colors={['rgba(105,240,174,0.2)','rgba(0,230,118,0.1)']}
                style={[StyleSheet.absoluteFill, { borderRadius: size * 0.18 }]}
              />
            )}
            <Text style={{ fontSize: size * 0.44, lineHeight: size * 0.56 }}>{card.emoji}</Text>
            {card.matched && (
              <View style={styles.matchTick}>
                <Text style={styles.matchTickText}>✓</Text>
              </View>
            )}
          </View>
        ) : (
          /* Face down */
          <LinearGradient
            colors={['#4A148C', '#7B1FA2', '#9C27B0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.cardBack, { width: size, height: size, borderRadius: size * 0.18 }]}
          >
            {/* Pattern dots */}
            <View style={styles.cardPattern}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[styles.patternDot, { opacity: 0.15 + i * 0.05 }]} />
              ))}
            </View>
            <Text style={[styles.cardQ, { fontSize: size * 0.35 }]}>✦</Text>
          </LinearGradient>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function MemoryMatchScreen({ onBack }) {
  const [mode,       setMode]       = useState(MODES[0]);
  const [cards,      setCards]      = useState(() => buildDeck(MODES[0].pairs));
  const [selected,   setSelected]   = useState([]);   // indices of flipped (unmatched) cards
  const [canFlip,    setCanFlip]    = useState(true);
  const [moves,      setMoves]      = useState(0);
  const [matched,    setMatched]    = useState(0);
  const [timer,      setTimer]      = useState(0);
  const [running,    setRunning]    = useState(false);
  const [complete,   setComplete]   = useState(false);
  const [bestTimes,  setBestTimes]  = useState({ easy: null, medium: null, hard: null });
  const [showModes,  setShowModes]  = useState(false);

  // One Animated.Value per card slot
  const cardAnims = useRef([]);
  if (cardAnims.current.length !== cards.length) {
    cardAnims.current = cards.map(() => new Animated.Value(1));
  }

  // Animations for win screen
  const winScale = useRef(new Animated.Value(0)).current;
  const winOp    = useRef(new Animated.Value(0)).current;
  // Header entrance
  const hdrY  = useRef(new Animated.Value(-20)).current;
  const hdrO  = useRef(new Animated.Value(0)).current;

  // Pulsing star for unflipped cards
  const starPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(starPulse, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
      Animated.timing(starPulse, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(hdrY, { toValue: 0, friction: 7, useNativeDriver: true }),
      Animated.timing(hdrO, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Timer
  const timerRef = useRef(null);
  useEffect(() => {
    if (running && !complete) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running, complete]);

  // ── Flip animation helper ─────────────────────────────────────────────
  const flipAnim = useCallback((idx, callback) => {
    const anim = cardAnims.current[idx];
    Animated.sequence([
      Animated.timing(anim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start(callback);
  }, []);

  const flipBackAnims = useCallback((idxA, idxB, afterFlip) => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(cardAnims.current[idxA], { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(cardAnims.current[idxA], { toValue: 1, duration: 140, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(cardAnims.current[idxB], { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(cardAnims.current[idxB], { toValue: 1, duration: 140, useNativeDriver: true }),
      ]),
    ]).start(afterFlip);
  }, []);

  // ── Card tap ──────────────────────────────────────────────────────────
  const handleCardPress = useCallback((idx) => {
    if (!canFlip || cards[idx].flipped || cards[idx].matched) return;

    // Start timer on first flip
    if (!running) setRunning(true);

    // Phase 1: flip this card face-up
    flipAnim(idx, () => {
      setCards(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], flipped: true };
        return next;
      });
    });

    const newSelected = [...selected, idx];

    if (newSelected.length < 2) {
      setSelected(newSelected);
      return;
    }

    // Two cards selected — check for match
    const [a, b] = newSelected;
    setMoves(m => m + 1);
    setCanFlip(false);
    setSelected([]);

    setTimeout(() => {
      if (cards[a].emoji === cards[b].emoji || (a !== b && cards[a].emoji === cards[idx].emoji)) {
        // Re-read from the latest cards state
        setCards(prev => {
          const idxA = newSelected[0], idxB = newSelected[1];
          if (prev[idxA].emoji !== prev[idxB].emoji && prev[idx].emoji !== prev[idxA === idx ? idxB : idxA].emoji) {
            // No match  (guarded double-check)
            return prev;
          }
          const next = [...prev];
          const mA = newSelected[0], mB = newSelected[1];
          if (next[mA].emoji === next[mB].emoji) {
            next[mA] = { ...next[mA], matched: true, flipped: true };
            next[mB] = { ...next[mB], matched: true, flipped: true };
            return next;
          }
          return prev;
        });
        setCanFlip(true);
      } else {
        // Flip both back
        flipBackAnims(newSelected[0], newSelected[1], () => {
          setCards(prev => {
            const next = [...prev];
            next[newSelected[0]] = { ...next[newSelected[0]], flipped: false };
            next[newSelected[1]] = { ...next[newSelected[1]], flipped: false };
            return next;
          });
          setCanFlip(true);
        });
      }
    }, 700);
  }, [canFlip, cards, selected, running, flipAnim, flipBackAnims]);

  // ── Check for match properly ──────────────────────────────────────────
  useEffect(() => {
    if (selected.length === 2) return;
    // Count matched pairs
    const matchedCount = cards.filter(c => c.matched).length / 2;
    setMatched(matchedCount);
    if (matchedCount === mode.pairs && mode.pairs > 0) {
      setComplete(true);
      setRunning(false);
      setBestTimes(prev => {
        const key = mode.key;
        if (!prev[key] || timer < prev[key]) return { ...prev, [key]: timer };
        return prev;
      });
      winScale.setValue(0); winOp.setValue(0);
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(winScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
          Animated.timing(winOp,   { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 300);
    }
  }, [cards]);

  // ── New game ──────────────────────────────────────────────────────────
  const newGame = useCallback((m = mode) => {
    const deck = buildDeck(m.pairs);
    setCards(deck);
    cardAnims.current = deck.map(() => new Animated.Value(1));
    setSelected([]);
    setCanFlip(true);
    setMoves(0);
    setMatched(0);
    setTimer(0);
    setRunning(false);
    setComplete(false);
    winScale.setValue(0);
    winOp.setValue(0);
  }, [mode]);

  const selectMode = (m) => {
    setMode(m);
    setShowModes(false);
    newGame(m);
  };

  // Card size based on mode columns
  const PADDING  = 28;
  const cardSize = Math.floor((SW - PADDING * 2) / mode.cols) - 6;
  const rows     = Math.ceil((mode.pairs * 2) / mode.cols);
  const bestT    = bestTimes[mode.key];

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080818' }]} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <View style={{ height: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 50 }} />

      {/* ── Top bar ── */}
      <Animated.View style={[styles.topBar, { opacity: hdrO, transform: [{ translateY: hdrY }] }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Memory Match</Text>
          <Text style={styles.screenSub}>{matched}/{mode.pairs} pairs</Text>
        </View>

        {/* Mode selector */}
        <TouchableOpacity onPress={() => setShowModes(p => !p)} activeOpacity={0.85}>
          <LinearGradient colors={['#7C4DFF','#AA00FF']} style={styles.modeChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.modeChipText}>{mode.emoji} {mode.label}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Mode dropdown */}
      {showModes && (
        <View style={styles.dropdown}>
          {MODES.map(m => (
            <TouchableOpacity key={m.key} onPress={() => selectMode(m)} activeOpacity={0.85}>
              <LinearGradient
                colors={m.key === 'easy' ? ['#4A148C','#6A1B9A'] : m.key === 'medium' ? ['#7C4DFF','#4A148C'] : ['#AA00FF','#7C4DFF']}
                style={styles.dropRow}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.dropRowText}>{m.emoji} {m.label}</Text>
                {bestTimes[m.key] && <Text style={styles.dropBest}>Best: {formatTime(bestTimes[m.key])}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{moves}</Text>
          <Text style={styles.statLabel}>MOVES</Text>
        </View>

        <View style={[styles.statCard, styles.statCardCenter]}>
          <Text style={[styles.statNum, styles.timerNum]}>{formatTime(timer)}</Text>
          <Text style={styles.statLabel}>TIME</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNum}>{matched}</Text>
          <Text style={styles.statLabel}>PAIRS</Text>
          {bestT && <Text style={styles.bestLabel}>Best {formatTime(bestT)}</Text>}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressFill, { width: `${(matched / mode.pairs) * 100}%` }]} />
        <Text style={styles.progressText}>{Math.round((matched / mode.pairs) * 100)}%</Text>
      </View>

      {/* ── Card grid ── */}
      <ScrollView
        contentContainerStyle={[styles.grid, { paddingHorizontal: PADDING, paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={rows > 5}
      >
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={styles.gridRow}>
            {Array.from({ length: mode.cols }).map((_, c) => {
              const idx = r * mode.cols + c;
              if (idx >= cards.length) return <View key={c} style={{ width: cardSize + 8, height: cardSize + 8 }} />;
              return (
                <MemoryCard
                  key={cards[idx].id}
                  card={cards[idx]}
                  size={cardSize}
                  onPress={() => handleCardPress(idx)}
                  scaleAnim={cardAnims.current[idx] || new Animated.Value(1)}
                  disabled={!canFlip}
                />
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* ── Win overlay ── */}
      {complete && (
        <Animated.View style={[styles.winOverlay, { opacity: winOp }]}>
          <Animated.View style={[styles.winCard, { transform: [{ scale: winScale }] }]}>
            <LinearGradient colors={['#2A1060','#1A0A40','#0D0730']} style={styles.winGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

              {/* Confetti-like dots */}
              {['#FF6B6B','#FFD700','#4C9EFF','#69F0AE','#AB47BC'].map((c, i) => (
                <View key={i} style={[styles.confettiDot, { backgroundColor: c, top: 10 + i * 14, left: 10 + (i % 3) * 40, transform: [{ rotate: `${i * 37}deg` }] }]} />
              ))}

              <Text style={styles.winEmoji}>🎉</Text>
              <Text style={styles.winTitle}>You Did It!</Text>
              <Text style={styles.winSub}>{mode.label} cleared</Text>

              <View style={styles.winStats}>
                <View style={styles.winStat}>
                  <Text style={styles.winStatNum}>{moves}</Text>
                  <Text style={styles.winStatLabel}>moves</Text>
                </View>
                <View style={styles.winStatDiv} />
                <View style={styles.winStat}>
                  <Text style={[styles.winStatNum, { color: '#FFD700' }]}>{formatTime(timer)}</Text>
                  <Text style={styles.winStatLabel}>time</Text>
                </View>
                {bestT === timer && (
                  <>
                    <View style={styles.winStatDiv} />
                    <View style={styles.winStat}>
                      <Text style={[styles.winStatNum, { color: '#69F0AE' }]}>🏆</Text>
                      <Text style={styles.winStatLabel}>new best!</Text>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity onPress={() => newGame(mode)} activeOpacity={0.85}>
                <LinearGradient colors={['#AA00FF','#7C4DFF','#4C9EFF']} style={styles.winBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.winBtnText}>▶  PLAY AGAIN</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { newGame(MODES[Math.min(MODES.findIndex(m => m.key === mode.key) + 1, MODES.length - 1)]); selectMode(MODES[Math.min(MODES.findIndex(m => m.key === mode.key) + 1, MODES.length - 1)]); }} activeOpacity={0.8} style={styles.nextModeBtn}>
                <Text style={styles.nextModeText}>
                  {MODES.findIndex(m => m.key === mode.key) < MODES.length - 1 ? '→ Try harder mode' : '✓ You beat them all!'}
                </Text>
              </TouchableOpacity>

            </LinearGradient>
          </Animated.View>
        </Animated.View>
      )}

      {/* New game button */}
      {!complete && (
        <TouchableOpacity onPress={() => newGame(mode)} activeOpacity={0.8} style={styles.newGameRow}>
          <View style={styles.newGameBtn}>
            <Text style={styles.newGameText}>↺  New Game</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },

  topGlow: {
    position: 'absolute', top: -80, left: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#4A148C', opacity: 0.35,
  },
  bottomGlow: {
    position: 'absolute', bottom: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#7C4DFF', opacity: 0.2,
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 16, marginBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 26, lineHeight: 30 },
  titleBlock: { alignItems: 'center' },
  screenTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  screenSub:   { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  modeChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  modeChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 60 : 110,
    right: 16, zIndex: 999, borderRadius: 14, overflow: 'hidden',
    elevation: 24, gap: 2,
  },
  dropRow: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropRowText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dropBest:    { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  // Stats
  statsRow: {
    flexDirection: 'row', width: '100%', paddingHorizontal: 16, gap: 8, marginBottom: 10,
  },
  statCard: {
    flex: 1, backgroundColor: '#11112A',
    borderRadius: 14, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statCardCenter: { borderColor: 'rgba(124,77,255,0.4)' },
  statNum: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  timerNum: { color: '#AA00FF', textShadowColor: '#AA00FF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  bestLabel: { color: '#AA00FF', fontSize: 9, marginTop: 2 },

  // Progress
  progressWrap: {
    width: SW - 32, height: 6, backgroundColor: '#11112A',
    borderRadius: 3, marginBottom: 12, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#7C4DFF',
  },
  progressText: { position: 'absolute', right: 6, color: 'rgba(255,255,255,0.4)', fontSize: 9 },

  // Grid
  grid: { alignItems: 'center' },
  gridRow: { flexDirection: 'row' },

  // Cards
  cardFront: {
    backgroundColor: '#1E1040',
    borderWidth: 1.5, borderColor: 'rgba(124,77,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: '#7C4DFF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  cardMatched: {
    borderColor: 'rgba(105,240,174,0.5)',
    elevation: 8,
    shadowColor: '#69F0AE', shadowOpacity: 0.4,
  },
  matchTick: {
    position: 'absolute', top: 3, right: 3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#69F0AE', alignItems: 'center', justifyContent: 'center',
  },
  matchTickText: { color: '#000', fontSize: 8, fontWeight: 'bold' },

  cardBack: {
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#AA00FF', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  cardPattern: {
    position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', padding: 4,
  },
  patternDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: '#FFFFFF', margin: 3,
  },
  cardQ: { color: '#FFFFFF', fontWeight: 'bold' },

  // New game
  newGameRow: { paddingBottom: 16, paddingTop: 4 },
  newGameBtn: {
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: 'rgba(124,77,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(124,77,255,0.3)',
  },
  newGameText: { color: '#AA00FF', fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  // Win overlay
  winOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  winCard: {
    width: SW * 0.82, borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(124,77,255,0.4)',
    elevation: 24,
    shadowColor: '#AA00FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20,
  },
  winGrad: { padding: 28, alignItems: 'center', overflow: 'hidden' },

  confettiDot: { position: 'absolute', width: 8, height: 8, borderRadius: 2 },

  winEmoji: { fontSize: 52, marginBottom: 8 },
  winTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  winSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 },

  winStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  winStat:  { alignItems: 'center' },
  winStatNum: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  winStatLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  winStatDiv:   { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.1)' },

  winBtn: {
    borderRadius: 24, paddingHorizontal: 36, paddingVertical: 13,
    elevation: 8, shadowColor: '#AA00FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10,
    marginBottom: 12,
  },
  winBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 1.5 },

  nextModeBtn: { paddingVertical: 6 },
  nextModeText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});

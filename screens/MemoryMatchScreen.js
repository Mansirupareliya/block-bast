import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playClick, playSuccess } from '../utils/audioManager';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Themes & Icons ────────────────────────────────────────────────────────
const THEMES = {
  ANIMALS: ['🐶','🐱','🐮','🐴','🐷','🐑','🐘','🐰','🐦','🦆','🦉','🐧','🕷️','🐠','🐢','🐛','🐝','🐞','🐌','🐬','🦘','🐨','🐼','🦋'],
  FOOD:    ['🍎','🥕','🍕','🍔','🍦','☕','🧁','🍭','🎂','🍜','🥐','🍗','🌭','🥩','🍒','🍇','🍍','🍉','🍄','🥜','🌶️','🥖','🌮','🍿'],
  VEHICLES:['🚗','🏎️','🚌','✈️','🚂','🚲','🛵','🏍️','🚁','🚀','⛵','🛳️','🚚','🚜','🚑','🚒','🚇','🚕','🚐','🛺','🛻','🚊','🚐','🚌'],
  SPORTS:  ['⚽','🏀','🎾','🏈','⚾','⛳','🏐','🏓','🎳','🎱','🏏','🏒','🛹','🏂','⛷️','🏊','🥋','🏋️','🤸','🏅','🏆','🎯','🎙️','💪'],
  NATURE:  ['☀️','🌧️','❄️','☁️','⚡','💨','🌙','🌨️','🔥','💧','🍃','🌲','🌲','🌷','🌸','🌍','🌙','⭐','☁️','🌈','☂️','🏔️','🧭','🌅']
};
const THEME_KEYS = Object.keys(THEMES);

// ── Levels ────────────────────────────────────────────────────────────────
const RAW = [
  // 1-10: 8 pairs (4x4 grid - much smaller cells than 3x4)
  [1,8,4], [2,8,4], [3,8,4], [4,8,4], [5,8,4], [6,8,4], [7,8,4], [8,8,4], [9,8,4], [10,8,4],
  // 11-20: 10 pairs (4x5 grid)
  [11,10,4], [12,10,4], [13,10,4], [14,10,4], [15,10,4], [16,10,4], [17,10,4], [18,10,4], [19,10,4], [20,10,4],
  // 21-30: 12 pairs (4x6 grid)
  [21,12,4], [22,12,4], [23,12,4], [24,12,4], [25,12,4], [26,12,4], [27,12,4], [28,12,4], [29,12,4], [30,12,4],
  // 31-40: 15 pairs (5x6 grid - very small cells)
  [31,15,5], [32,15,5], [33,15,5], [34,15,5], [35,15,5], [36,15,5], [37,15,5], [38,15,5], [39,15,5], [40,15,5],
  // 41-50: 18 pairs (6x6 grid)
  [41,18,6], [42,18,6], [43,18,6], [44,18,6], [45,18,6], [46,18,6], [47,18,6], [48,18,6], [49,18,6], [50,18,6],
];

const LEVELS = RAW.map(([level, pairs, cols]) => ({
  level, pairs, cols,
  theme: THEME_KEYS[(level - 1) % THEME_KEYS.length],
  timeLimit: 30 + (level * 5), // dynamic time limit
}));

// ── Helpers ───────────────────────────────────────────────────────────────
function buildDeck(pairs, themeKey) {
  const icons = THEMES[themeKey] || THEMES.NATURE;
  const pool = icons.slice(0, pairs);
  return [...pool, ...pool]
    .map((iconName, idx) => ({ id: idx, iconName, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5);
}


// ── Memory Card ───────────────────────────────────────────────────────────
function MemoryCard({ card, size, onPress, scaleAnim, disabled }) {
  const isVisible = card.flipped || card.matched;
  const br = size * 0.15;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || card.matched || card.flipped}
      style={{ padding: Math.max(2, size * 0.05) }}
    >
      <Animated.View style={{ transform: [{ scaleX: scaleAnim }] }}>
        {isVisible ? (
          <View style={[
            cardStyles.front,
            { width: size, height: size, borderRadius: br },
            card.matched && { opacity: 0.6 },
          ]}>
            <Text style={{ fontSize: size * 0.55, textAlign: 'center', includeFontPadding: false }}>
              {card.iconName}
            </Text>
          </View>
        ) : (
          <View style={[cardStyles.back, { width: size, height: size, borderRadius: br }]}>
            {/* Inner highlight for 3D bevel effect */}
            <View style={[StyleSheet.absoluteFill, cardStyles.backInner]} />
            <Text style={[cardStyles.qMark, { fontSize: size * 0.6 }]}>?</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

let globalUnlockedLevel = 1;

// ── Main Screen ───────────────────────────────────────────────────────────
export default function MatchmakerScreen({ onBack }) {
  const [view, setView] = useState('start'); // 'start' | 'game' | 'levels'
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(globalUnlockedLevel);
  const [bestScore, setBestScore] = useState(0); // arbitrary scoring for UI
  const [score, setScore] = useState(0);

  // Game state
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [canFlip, setCanFlip] = useState(true);
  const [matched, setMatched] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);

  const cardAnims = useRef([]);

  // Timer removed for now
  useEffect(() => {
    // No timer logic
  }, [running, complete]);

  const cfg = LEVELS[currentLevelIdx] || LEVELS[0];

  const startLevel = useCallback((levelNum) => {
    const idx = levelNum - 1;
    const lcfg = LEVELS[idx];
    const deck = buildDeck(lcfg.pairs, lcfg.theme);
    setCurrentLevelIdx(idx);
    setCards(deck);
    cardAnims.current = deck.map(() => new Animated.Value(1));
    setSelected([]); setCanFlip(true);
    setMatched(0); setScore(0);
    setTimeLeft(lcfg.timeLimit);
    setRunning(true); setComplete(false);
    setView('game');
  }, []);

  const flipAnim = useCallback((idx, cb) => {
    const anim = cardAnims.current[idx];
    if (!anim) { cb?.(); return; }
    Animated.sequence([
      Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(cb);
  }, []);

  const flipBackBoth = useCallback((a, b, cb) => {
    if (!cardAnims.current[a] || !cardAnims.current[b]) { cb?.(); return; }
    Animated.parallel([
      Animated.sequence([
        Animated.timing(cardAnims.current[a], { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(cardAnims.current[a], { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(cardAnims.current[b], { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(cardAnims.current[b], { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
    ]).start(cb);
  }, []);

  const handleCardPress = useCallback((idx) => {
    if (!canFlip || cards[idx].flipped || cards[idx].matched || complete) return;

    playClick();

    flipAnim(idx, () => {
      setCards(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], flipped: true };
        return next;
      });
    });

    const newSel = [...selected, idx];
    if (newSel.length < 2) { setSelected(newSel); return; }

    const [a, b] = newSel;
    setCanFlip(false);
    setSelected([]);

    setTimeout(() => {
      const isMatch = cards[a].iconName === cards[b].iconName;

      if (isMatch) {
        playSuccess();
        setScore(s => s + 50);
        setMatched(m => m + 1);
        setCards(prev => {
          const next = [...prev];
          next[a] = { ...next[a], matched: true, flipped: true };
          next[b] = { ...next[b], matched: true, flipped: true };
          return next;
        });
        
        // Check win
        if (matched + 1 >= cfg.pairs) {
          setRunning(false);
          setComplete(true);
          playSuccess();
          setBestScore(prev => Math.max(prev, score + 50));
          
          const nextLevel = Math.max(maxUnlockedLevel, cfg.level + 1);
          setMaxUnlockedLevel(nextLevel);
          globalUnlockedLevel = nextLevel;
        }
        setCanFlip(true);
      } else {
        flipBackBoth(a, b, () => {
          setCards(prev => {
            const next = [...prev];
            next[a] = { ...next[a], flipped: false };
            next[b] = { ...next[b], flipped: false };
            return next;
          });
          setCanFlip(true);
        });
      }
    }, 600);
  }, [canFlip, cards, selected, complete, matched, cfg, score, timeLeft, flipAnim, flipBackBoth]);

  // ── Render Start Screen ─────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <View style={startStyles.root}>
        <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
        
        {/* Large watermark ? */}
        <Text style={startStyles.watermark}>?</Text>
        
        <View style={startStyles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{top:20,bottom:20,left:20,right:20}}>
            <Text style={{fontSize: 24, color: '#333'}}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={startStyles.content}>
          <Text style={startStyles.title}>Match</Text>
          <Text style={startStyles.subtitle}>maker</Text>
          
          <Text style={startStyles.desc}>Pairs are made in Matchmaker heaven. Start matching!</Text>
          
          <TouchableOpacity style={startStyles.playBtn} activeOpacity={0.8} onPress={() => setView('levels')}>
            <Text style={startStyles.playText}>Play</Text>
            <View style={startStyles.coin}><Text style={startStyles.coinText}>150</Text></View>
          </TouchableOpacity>
          
          <Text style={startStyles.bestScoreLabel}>Your Best Score:</Text>
          <Text style={startStyles.bestScoreVal}>{bestScore}</Text>
        </View>
      </View>
    );
  }

  // ── Render Levels Screen ────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={startStyles.root}>
        <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
        
        <View style={[startStyles.header, { flexDirection: 'row', alignItems: 'center', marginBottom: 20 }]}>
          <TouchableOpacity onPress={() => setView('start')} hitSlop={{top:20,bottom:20,left:20,right:20}}>
            <Text style={{fontSize: 24, color: '#333', marginRight: 20}}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111' }}>Levels</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {LEVELS.map((l, i) => {
              const unlocked = l.level <= maxUnlockedLevel;
              return (
                <TouchableOpacity
                  key={i}
                  style={[startStyles.levelBtn, !unlocked && startStyles.levelBtnLocked]}
                  onPress={() => unlocked && startLevel(l.level)}
                  activeOpacity={unlocked ? 0.8 : 1}
                >
                  <Text style={[startStyles.levelBtnText, !unlocked && startStyles.levelBtnTextLocked]}>
                    {unlocked ? l.level : '🔒'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Render Game Screen ──────────────────────────────────────────────────
  const cols = cfg.cols;
  const padding = 20;
  // Calculate size to comfortably fit `cols` number of cards, accounting for MemoryCard's internal padding
  const cardSize = Math.floor(((SW - (padding * 2)) / cols) / 1.12);

  return (
    <View style={gameStyles.root}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
      <View style={{ paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 }}>
        <TouchableOpacity onPress={() => setView('start')} hitSlop={{top:20,bottom:20,left:20,right:20}}>
          <Text style={{fontSize: 28, color: '#333'}}>←</Text>
        </TouchableOpacity>
      </View>
      
      <View style={gameStyles.statsBar}>
        <View style={gameStyles.statItem}><Text style={gameStyles.statLabel}>Level</Text><Text style={gameStyles.statValue}>{cfg.level}</Text></View>
        <View style={gameStyles.statDivider} />
        <View style={gameStyles.statItem}><Text style={gameStyles.statLabel}>Matched</Text><Text style={gameStyles.statValue}>{matched}</Text></View>
        <View style={gameStyles.statDivider} />
        <View style={gameStyles.statItem}><Text style={gameStyles.statLabel}>Pairs</Text><Text style={gameStyles.statValue}>{cfg.pairs}</Text></View>
      </View>

      <ScrollView contentContainerStyle={{ padding, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={gameStyles.grid}>
          {cards.map((card, idx) => (
            <MemoryCard
              key={idx}
              card={card}
              size={cardSize}
              onPress={() => handleCardPress(idx)}
              scaleAnim={cardAnims.current[idx]}
            />
          ))}
        </View>
        <View style={{height: 100}} />
      </ScrollView>



      {/* Simple Complete Overlay */}
      {complete && (
        <View style={[StyleSheet.absoluteFill, gameStyles.overlay]}>
          <View style={gameStyles.popup}>
            <Text style={gameStyles.popupTitle}>Level Complete!</Text>
            <TouchableOpacity 
              style={gameStyles.nextBtn} 
              onPress={() => startLevel(cfg.level + 1)}
            >
              <Text style={gameStyles.nextBtnText}>Next Level</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const startStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBE4C4' },
  watermark: {
    position: 'absolute', bottom: -50, right: -50,
    fontSize: 400, fontWeight: '900',
    color: '#000000', opacity: 0.04,
    transform: [{ rotate: '15deg' }]
  },
  header: { paddingTop: 50, paddingHorizontal: 20 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  title: { fontSize: 52, fontWeight: '900', color: '#111', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 0, marginBottom: -10 },
  subtitle: { fontSize: 44, fontWeight: '900', color: '#111', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: {width: 2, height: 2}, textShadowRadius: 0, marginBottom: 30 },
  desc: { fontSize: 16, color: '#333', textAlign: 'center', fontWeight: '500', marginBottom: 40, lineHeight: 24 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFB800', // darker yellow/orange
    paddingVertical: 14, paddingHorizontal: 30,
    borderRadius: 30,
    borderWidth: 2, borderColor: '#B38100',
    marginBottom: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 0, elevation: 2
  },
  playText: { fontSize: 22, fontWeight: '800', color: '#111', marginRight: 10 },
  coin: { backgroundColor: '#FFD52E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#B38100' },
  coinText: { fontSize: 16, fontWeight: '700', color: '#111' },
  bestScoreLabel: { fontSize: 14, color: '#333', fontWeight: '600', marginBottom: 4 },
  bestScoreVal: { fontSize: 24, fontWeight: '800', color: '#EE2244' },
  levelBtn: {
    width: 60, height: 60,
    backgroundColor: '#FFB800', // Yellow/orange
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#B38100',
    justifyContent: 'center', alignItems: 'center',
    margin: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 0, elevation: 2
  },
  levelBtnText: { 
    fontSize: 22, fontWeight: '800', color: '#111',
  },
  levelBtnLocked: {
    backgroundColor: '#E0E0E0',
    borderColor: 'rgba(255,255,255,0.8)',
    borderBottomColor: 'rgba(0,0,0,0.1)',
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  levelBtnTextLocked: {
    fontSize: 22,
    textShadowColor: 'transparent',
    opacity: 0.5
  }
});

const gameStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBE4C4' },
  statsBar: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 20, borderRadius: 20, padding: 15, justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#777', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#333' },
  statDivider: { width: 1, height: 20, backgroundColor: '#EEE' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },

  
  overlay: { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  popup: { backgroundColor: '#FFF', padding: 30, borderRadius: 20, alignItems: 'center', width: SW * 0.8 },
  popupTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 20 },
  nextBtn: { backgroundColor: '#FFD52E', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30 },
  nextBtnText: { fontSize: 18, fontWeight: '800', color: '#111' }
});

const cardStyles = StyleSheet.create({
  front: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E0E0E0',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  back: {
    backgroundColor: '#FF9E00', // Base orange
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3
  },
  backInner: {
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)', // Top/Left light bevel
    borderBottomColor: 'rgba(0,0,0,0.15)', // Bottom shadow bevel
    borderRightColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12
  },
  qMark: {
    fontWeight: '900', color: '#222', // Almost black
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0
  }
});

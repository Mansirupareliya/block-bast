import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { playTap, playFlip, playMatch, playMismatch, playWin, playLocked } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber } from '../utils/storage';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Themes & Icons ────────────────────────────────────────────────────────
const THEMES = {
  ANIMALS: ['🐶', '🐱', '🐮', '🐴', '🐷', '🐑', '🐘', '🐰', '🐦', '🦆', '🦉', '🐧', '🕷️', '🐠', '🐢', '🐛', '🐝', '🐞', '🐌', '🐬', '🦘', '🐨', '🐼', '🦋', '🦁', '🐯', '🐻', '🐹', '🦔', '🦇', '🦎', '🐊', '🐭', '🐺', '🦝', '🦡', '🦦', '🦨', '🐗', '🐿️', '🦥', '🦫', '🐫', '🦙', '🦒', '🦓', '🦏', '🦛', '🐐', '🐏'],
  FOOD: ['🍎', '🥕', '🍕', '🍔', '🍦', '☕', '🧁', '🍭', '🎂', '🍜', '🥐', '🍗', '🌭', '🥩', '🍒', '🍇', '🍍', '🍉', '🍄', '🥜', '🌶️', '🥖', '🌮', '🍿', '🍋', '🍌', '🥦', '🍩', '🥨', '🍰', '🧀', '🍳', '🍏', '🍐', '🍊', '🍑', '🥭', '🥥', '🥝', '🍅', '🍆', '🥑', '🥒', '🌽', '🫒', '🧄', '🧅', '🥔', '🍠', '🥞'],
  VEHICLES: ['🚗', '🏎️', '🚌', '✈️', '🚂', '🚲', '🛵', '🏍️', '🚁', '🚀', '⛵', '🛳️', '🚚', '🚜', '🚑', '🚒', '🚇', '🚕', '🚐', '🛺', '🛻', '🚊', '🚞', '🛶', '🚤', '🚝', '🛥️', '🚔', '🚓', '🚡', '🚟', '🚃', '🚙', '🚎', '🚛', '🛩️', '🛫', '🛬', '🚄', '🚅', '🚆', '🚈', '🛰️', '🛴', '🚘', '🚖', '🚍', '🛞', '⛴️', '🚠'],
  SPORTS: ['⚽', '🏀', '🎾', '🏈', '⚾', '⛳', '🏐', '🏓', '🎳', '🎱', '🏏', '🏒', '🛹', '🏂', '⛷️', '🏊', '🥋', '🏋️', '🤸', '🏅', '🏆', '🎯', '🎙️', '💪', '🤾', '🚴', '🏇', '🤺', '🥊', '🏸', '🥌', '🛼', '🥇', '🥈', '🥉', '🏹', '🎿', '🛷', '🏄', '🚣', '🧗', '🤼', '🤽', '🏃', '🤹', '⛹️', '🥅', '🎽', '🪀', '🎣'],
  NATURE: ['☀️', '🌧️', '❄️', '☁️', '⚡', '💨', '🌙', '🌨️', '🔥', '💧', '🍃', '🌲', '🌴', '🌷', '🌸', '🌍', '🌎', '⭐', '🌪️', '🌈', '☂️', '🏔️', '🧭', '🌅', '🌊', '🍂', '🍁', '🌵', '🌻', '🌼', '🌾', '☄️', '🌑', '🌕', '🌗', '🌛', '🌫️', '🌬️', '🌡️', '🌏', '🪐', '✨', '🌠', '🌌', '🌇', '🌄', '🗻', '🍀', '🌳', '🌿']
};
const THEME_KEYS = Object.keys(THEMES);

// ── Levels ────────────────────────────────────────────────────────────────
// Boards are always square (rows === cols) so the grid never tapers off into
// an uneven last row. An odd-sided square (11x11) has an odd cell count and
// can't be filled with pure pairs, so it gets one extra pre-solved "bonus"
// tile (see buildDeck) dropped in the dead center to fill the gap.
const RAW = [
  // 1-10: 4x4 grid (8 pairs)
  [1, 8, 4], [2, 8, 4], [3, 8, 4], [4, 8, 4], [5, 8, 4], [6, 8, 4], [7, 8, 4], [8, 8, 4], [9, 8, 4], [10, 8, 4],
  // 11-20: 6x6 grid (18 pairs)
  [11, 18, 6], [12, 18, 6], [13, 18, 6], [14, 18, 6], [15, 18, 6], [16, 18, 6], [17, 18, 6], [18, 18, 6], [19, 18, 6], [20, 18, 6],
  // 21-30: 8x8 grid (32 pairs)
  [21, 32, 8], [22, 32, 8], [23, 32, 8], [24, 32, 8], [25, 32, 8], [26, 32, 8], [27, 32, 8], [28, 32, 8], [29, 32, 8], [30, 32, 8],
  // 31-40: 10x10 grid (50 pairs)
  [31, 50, 10], [32, 50, 10], [33, 50, 10], [34, 50, 10], [35, 50, 10], [36, 50, 10], [37, 50, 10], [38, 50, 10], [39, 50, 10], [40, 50, 10],
  // 41-50: 11x11 grid (60 pairs + 1 center bonus tile)
  [41, 60, 11], [42, 60, 11], [43, 60, 11], [44, 60, 11], [45, 60, 11], [46, 60, 11], [47, 60, 11], [48, 60, 11], [49, 60, 11], [50, 60, 11],
];

const LEVELS = RAW.map(([level, pairs, cols]) => ({
  level, pairs, cols,
  // An odd-sided square (cols is odd) can't be filled by pure pairs alone —
  // it needs the one extra bonus tile from buildDeck.
  bonusTile: cols % 2 === 1,
  theme: THEME_KEYS[(level - 1) % THEME_KEYS.length],
}));

// ── Helpers ───────────────────────────────────────────────────────────────
function buildDeck(pairs, themeKey, withBonus) {
  const icons = THEMES[themeKey] || THEMES.NATURE;
  // Cycle through the theme's icons rather than slicing, since the largest
  // boards need more pairs than any theme has unique icons for — icons
  // simply repeat across extra pairs.
  const pool = Array.from({ length: pairs }, (_, i) => icons[i % icons.length]);
  const deck = [...pool, ...pool]
    .map((iconName, idx) => ({ id: idx, iconName, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5);

  if (withBonus) {
    // Pre-solved decorative tile, never flippable (matched: true disables
    // it in MemoryCard already). Spliced in at the dead-center index of the
    // deck rather than shuffled with the rest, so on an odd-sided square
    // (e.g. 11x11, index 60 of 121) it always lands visually in the middle.
    const bonusCard = { id: deck.length, iconName: '⭐', flipped: true, matched: true, bonus: true };
    deck.splice(Math.floor(deck.length / 2), 0, bonusCard);
  }

  return deck;
}


// ── Memory Card ───────────────────────────────────────────────────────────
// Each revealed card gets a different pastel background from this palette
// (cycling by card id) — matches the reference board's colorful pastel
// tiles instead of one plain white card for every icon.
const CARD_COLORS = ['#8FD9CE', '#FFB877', '#C9A6E8', '#F4C4D4', '#A8D98F', '#8FC1E8'];

function MemoryCard({ card, size, onPress, scaleAnim, disabled }) {
  const isVisible = card.flipped || card.matched;
  const br = size * 0.18;
  const pastel = CARD_COLORS[card.id % CARD_COLORS.length];

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
            { width: size, height: size, borderRadius: br, backgroundColor: card.bonus ? '#FFD52E' : pastel },
            card.matched && !card.bonus && { opacity: 0.6 },
          ]}>
            <Text style={{ fontSize: size * 0.55, textAlign: 'center', includeFontPadding: false }}>
              {card.iconName}
            </Text>
          </View>
        ) : (
          <View style={[cardStyles.back, { width: size, height: size, borderRadius: br }]}>
            {/* Inner highlight for 3D bevel effect */}
            <View style={[StyleSheet.absoluteFill, cardStyles.backInner, { borderRadius: br }]} />
            <Text style={[cardStyles.qMark, { fontSize: size * 0.6 }]}>?</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Glossy cartoon bubble button (back arrows, Play button) ──────────────
// A chunky glossy circle — bold saturated border, a lighter-top/darker-
// bottom gradient face, a diagonal glossy highlight blob, and a drop
// shadow — matching a classic "cartoon button set" look, built purely
// from Views/LinearGradient (no image assets).
function CartoonButton({ size = 44, onPress, children, style }) {
  const borderW = Math.max(3, size * 0.06);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} style={style}>
      <LinearGradient
        colors={['#FFE27A', '#FFC93C', '#B9782E']}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: '#7A4A18',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
        }}
      >
        <View style={{
          position: 'absolute', top: size * 0.1, left: size * 0.12,
          width: size * 0.38, height: size * 0.22, borderRadius: size * 0.18,
          backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-18deg' }],
        }} />
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// Same glossy recipe as a wide pill, for the Play button.
function CartoonPillButton({ onPress, children, style }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      <LinearGradient
        colors={['#FFE27A', '#FFC93C', '#B9782E']}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          paddingVertical: 14, paddingHorizontal: 34, borderRadius: 30,
          borderWidth: 3, borderColor: '#7A4A18', overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
        }}
      >
        <View style={{
          position: 'absolute', top: 6, left: 16, width: 60, height: 16,
          borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.5)', transform: [{ rotate: '-10deg' }],
        }} />
        {children}
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── "3D bubble" text (Level Complete title) ───────────────────────────────
// RN Text has no text-stroke, so the outline is faked by stacking the same
// string in the outline color at small offsets behind the real, colored
// text on top — a standard trick for this cartoon-game lettering look.
function BubbleText({ children, size = 32, color = '#FFD23F', stroke = '#7A4A18' }) {
  const offsets = [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2], [-2, 0], [2, 0]];
  const base = { fontSize: size, fontWeight: '900', textAlign: 'center', lineHeight: size * 1.05 };
  return (
    <View>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

// ── Starburst backdrop (Level Complete overlay) ───────────────────────────
// A radial-gradient sky plus alternating light/dark rays fanning out from
// just above center — matches the classic "celebration" level-complete
// background instead of a plain dim overlay.
function Starburst() {
  const rayCount = 16;
  const cx = SW / 2, cy = SH * 0.4;
  const rayLen = Math.max(SW, SH) * 1.5;
  return (
    // width/height as "100%" (not fixed SW/SH pixels) so this actually
    // stretches to fill whatever its container really measures — a fixed
    // pixel size here left a gap on devices where the true drawable area
    // is taller than Dimensions.get('window') reports (common with
    // Android's edge-to-edge display), exposing the screen underneath.
    // viewBox keeps all the ray/gradient math below working in SW×SH
    // coordinates regardless of the actual rendered size.
    <Svg width="100%" height="100%" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="burstBg" cx="50%" cy="38%" r="75%">
          <Stop offset="0" stopColor="#6BD2F5" />
          <Stop offset="1" stopColor="#1E7FC2" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={SW} height={SH} fill="url(#burstBg)" />
      {Array.from({ length: rayCount }).map((_, i) => (
        <Rect
          key={i}
          x={cx - rayLen * 0.06} y={cy - rayLen}
          width={rayLen * 0.12} height={rayLen}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.02)'}
          transform={`rotate(${(360 / rayCount) * i} ${cx} ${cy})`}
        />
      ))}
    </Svg>
  );
}

// ── Level path (winding map, like a Candy-Crush-style level select) ─────
// No lock icon, no emoji: every node always shows its plain level number.
// Locked nodes are simply disabled + greyed out; unlocked ones are enabled
// + colored. Each node is built as a little 3D "puck" — a wooden base disc
// peeking out from behind a glossy gradient-shaded circle — purely from
// Views/LinearGradient, no image assets or emoji involved.
const PATH_NODE = 60;
const PATH_ROW_H = 104;
const PATH_PAD = 60;

const NODE_GRADIENT = {
  done:    ['#8FE0FF', '#2E86D8', '#155A96'],
  locked:  ['#E3E7EA', '#B9C0C6', '#8A9096'],
  current: ['#9CF5B8', '#33C46B', '#187A44'],
};

function pathNodeCenter(i, containerWidth) {
  const amplitude = (containerWidth - PATH_NODE - PATH_PAD * 2) / 2;
  const x = containerWidth / 2 + amplitude * Math.sin(i * 0.9);
  const y = PATH_PAD + i * PATH_ROW_H;
  return { x, y };
}

// A wide, rounded tan ribbon between two node centers — the walkable trail
// itself, rather than a thin wire.
function PathConnector({ from, to }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
  const width = PATH_NODE * 0.6;
  return (
    <View
      style={{
        position: 'absolute',
        left: midX - length / 2 - width * 0.25, top: midY - width / 2,
        width: length + width * 0.5, height: width, borderRadius: width / 2,
        backgroundColor: '#F0DDB5',
        borderWidth: 2, borderColor: 'rgba(122,74,24,0.25)',
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

// The current-level marker — a rounded pin with a hollow center, like a
// map "you are here" pin, built from two overlapping Views (a circle head
// + a rotated-square point) rather than an emoji or image.
function PinMarker({ size, colors }) {
  const point = size * 0.5;
  return (
    <View style={{ width: size, height: size * 1.25, alignItems: 'center' }}>
      <View style={{
        position: 'absolute', bottom: 0,
        width: point, height: point, borderRadius: 4,
        backgroundColor: colors[1],
        transform: [{ rotate: '45deg' }],
      }} />
      <LinearGradient colors={colors} style={[pathStyles.pinHead, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: '#F0DDB5' }} />
      </LinearGradient>
    </View>
  );
}

function PathNode({ num, state, x, y, onPress }) {
  const isCurrent = state === 'current';
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isCurrent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCurrent, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const colors = NODE_GRADIENT[state];

  return (
    <View style={{ position: 'absolute', left: x - PATH_NODE * 0.9, top: y - PATH_NODE * 0.9, width: PATH_NODE * 1.8, height: PATH_NODE * 1.8, alignItems: 'center', justifyContent: 'center' }}>
      {/* Landing — the path widening into a clearing under each node */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={pathStyles.landing} />
      </View>

      <TouchableOpacity disabled={state === 'locked'} activeOpacity={0.8} onPress={onPress}>
        <Animated.View style={{ alignItems: 'center', transform: isCurrent ? [{ translateY }] : undefined }}>
          {isCurrent ? (
            <PinMarker size={PATH_NODE * 0.78} colors={colors} />
          ) : (
            <View style={{ width: PATH_NODE, height: PATH_NODE, alignItems: 'center' }}>
              {/* Wooden base disc peeking out below the glossy face */}
              <View style={pathStyles.woodBase} />
              <LinearGradient colors={colors} style={pathStyles.nodeFace}>
                <View style={pathStyles.shine} />
                <Text style={[pathStyles.nodeText, state === 'locked' && pathStyles.nodeTextLocked]}>{num}</Text>
              </LinearGradient>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

// ── Animated background (start screen) ───────────────────────────────────
// A handful of the game's own memory-match icons gently drifting behind the
// content, plus a slow breathing pulse on the big "?" watermark, so the
// landing page feels alive instead of static. Plain RN `Animated` — no new
// dependency, matches how every other animation in this app is built.
const FLOAT_ICONS = ['🐶', '🍕', '🚗', '⚽', '🌙', '🍦', '🐢', '⭐'];

function FloatingIcon({ icon, size, duration, delay, style }) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(bob, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob, duration, delay]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <Animated.Text
      style={[style, { fontSize: size, transform: [{ translateY }, { rotate }] }]}
    >
      {icon}
    </Animated.Text>
  );
}

const FLOAT_POSITIONS = [
  { top: '9%',  left: '8%',  size: 38, duration: 2200, delay: 0 },
  { top: '16%', right: '10%', size: 30, duration: 1900, delay: 300 },
  { top: '40%', left: '5%',  size: 28, duration: 2500, delay: 650 },
  { top: '52%', right: '8%', size: 40, duration: 2100, delay: 150 },
  { top: '66%', left: '12%', size: 30, duration: 2400, delay: 500 },
  { top: '76%', right: '16%', size: 26, duration: 1800, delay: 800 },
];

function FloatingBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLOAT_POSITIONS.map((p, i) => (
        <FloatingIcon
          key={i}
          icon={FLOAT_ICONS[i % FLOAT_ICONS.length]}
          size={p.size}
          duration={p.duration}
          delay={p.delay}
          style={{ position: 'absolute', top: p.top, left: p.left, right: p.right, opacity: 0.22 }}
        />
      ))}
    </View>
  );
}

// Slow breathing pulse on the giant "?" watermark already used on the
// start screen — scale + a touch of rotation, subtle enough to read as
// ambient life rather than a distraction.
function PulsingWatermark() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = pulse.interpolate({ inputRange: [0, 1], outputRange: ['15deg', '18deg'] });

  return (
    <Animated.Text style={[startStyles.watermark, { transform: [{ scale }, { rotate }] }]}>
      ?
    </Animated.Text>
  );
}

let globalUnlockedLevel = 1;
let globalBestScore = 0;

// ── Main Screen ───────────────────────────────────────────────────────────
export default function MatchmakerScreen({ onBack }) {
  const [view, setView] = useState('start'); // 'start' | 'game' | 'levels'
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(globalUnlockedLevel);
  const [bestScore, setBestScore] = useState(globalBestScore); // arbitrary scoring for UI
  const [score, setScore] = useState(0);

  // Game state
  const [cards, setCards] = useState([]);
  const [selected, setSelected] = useState([]);
  const [canFlip, setCanFlip] = useState(true);
  const [matched, setMatched] = useState(0);
  const [complete, setComplete] = useState(false);
  const [hintActive, setHintActive] = useState(false);

  const cardAnims = useRef([]);


  // Restore progress saved on a previous app session. The `global*` vars
  // above only survive while the JS engine stays alive (screen navigations
  // within one session); a full app close/reopen resets them, which is
  // what was reported — so read the persisted values once on mount and
  // adopt them if they're ahead of what we have in memory.
  useEffect(() => {
    loadNumber(STORAGE_KEYS.MATCHMAKER_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlockedLevel) {
        globalUnlockedLevel = saved;
        setMaxUnlockedLevel(saved);
      }
    });
    loadNumber(STORAGE_KEYS.MATCHMAKER_BEST_SCORE, 0).then((saved) => {
      if (saved > globalBestScore) {
        globalBestScore = saved;
        setBestScore(saved);
      }
    });
  }, []);

  const cfg = LEVELS[currentLevelIdx] || LEVELS[0];

  const startLevel = useCallback((levelNum) => {
    const idx = levelNum - 1;
    const lcfg = LEVELS[idx];
    const deck = buildDeck(lcfg.pairs, lcfg.theme, lcfg.bonusTile);
    setCurrentLevelIdx(idx);
    setCards(deck);
    cardAnims.current = deck.map(() => new Animated.Value(1));
    setSelected([]); setCanFlip(true);
    setMatched(0); setScore(0);
    setComplete(false);
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

    playFlip();

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
        playMatch();
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
          setComplete(true);
          playWin();

          const finalScore = score + 50;
          if (finalScore > globalBestScore) {
            globalBestScore = finalScore;
            setBestScore(finalScore);
            saveNumber(STORAGE_KEYS.MATCHMAKER_BEST_SCORE, finalScore);
          }

          const nextLevel = Math.max(maxUnlockedLevel, cfg.level + 1);
          setMaxUnlockedLevel(nextLevel);
          globalUnlockedLevel = nextLevel;
          saveNumber(STORAGE_KEYS.MATCHMAKER_MAX_UNLOCKED, nextLevel);
        }
        setCanFlip(true);
      } else {
        playMismatch();
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
  }, [canFlip, cards, selected, complete, matched, cfg, score, flipAnim, flipBackBoth]);

  // Briefly reveals every still-hidden card so the player can peek at the
  // board, then flips them all back — a real hint, not just decoration.
  const showHint = useCallback(() => {
    if (hintActive || complete || !canFlip) return;
    setHintActive(true);
    setCanFlip(false);
    setCards(prev => prev.map(c => (c.matched ? c : { ...c, flipped: true })));
    setTimeout(() => {
      setCards(prev => prev.map(c => (c.matched ? c : { ...c, flipped: false })));
      setCanFlip(true);
      setHintActive(false);
    }, 900);
  }, [hintActive, complete, canFlip]);

  // ── Render Start Screen ─────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <View style={startStyles.root}>
        <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

        <FloatingBackground />

        {/* Large watermark ? — slow breathing pulse */}
        <PulsingWatermark />

        <View style={startStyles.header}>
          <CartoonButton size={44} onPress={() => { playTap(); onBack(); }}>
            <Text style={startStyles.cartoonArrow}>←</Text>
          </CartoonButton>
        </View>

        <View style={startStyles.content}>
          <Text style={startStyles.title}>Match</Text>
          <Text style={startStyles.subtitle}>maker</Text>

          <Text style={startStyles.desc}>Pairs are made in Matchmaker heaven. Start matching!</Text>

          <CartoonPillButton onPress={() => { playTap(); setView('levels'); }} style={{ marginBottom: 40 }}>
            <Text style={startStyles.playText}>Play</Text>
            <View style={startStyles.coin}><Text style={startStyles.coinText}>150</Text></View>
          </CartoonPillButton>

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

        {(() => {
          const pathWidth = SW;
          const centers = LEVELS.map((_, i) => pathNodeCenter(i, pathWidth));
          const contentHeight = PATH_PAD * 2 + (LEVELS.length - 1) * PATH_ROW_H;
          return (
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              <View style={{ width: pathWidth, height: contentHeight }}>
                {centers.slice(1).map((to, i) => (
                  <PathConnector key={i} from={centers[i]} to={to} />
                ))}
                {LEVELS.map((l, i) => {
                  const state = l.level > maxUnlockedLevel ? 'locked'
                    : l.level === maxUnlockedLevel ? 'current' : 'done';
                  return (
                    <PathNode
                      key={i}
                      num={l.level}
                      state={state}
                      x={centers[i].x}
                      y={centers[i].y}
                      onPress={() => {
                        if (state !== 'locked') { playTap(); startLevel(l.level); }
                        else playLocked();
                      }}
                    />
                  );
                })}
              </View>
            </ScrollView>
          );
        })()}

        {/* Full-bleed scenery — no header bar, just a floating back button
            over the scene, like the reference's floating circular icons.
            Rendered after the ScrollView so it always stays on top. */}
        <CartoonButton size={44} onPress={() => { playTap(); setView('start'); }} style={pathStyles.floatingBack}>
          <Text style={pathStyles.floatingBackArrow}>←</Text>
        </CartoonButton>
      </View>
    );
  }

  // ── Render Game Screen ──────────────────────────────────────────────────
  const cols = cfg.cols;
  // Horizontal space actually lost before a card can render, matching
  // boardFrame's marginHorizontal (20*2) + borderWidth (4*2) and the
  // ScrollView's contentContainerStyle padding (10*2) below — using just
  // the outer 20*2 here (as before) undercounted this, so the computed
  // card size was too big and rows fell one column short of `cols`,
  // breaking the square grid shape.
  const boardHorizontalLoss = 20 * 2 + 4 * 2 + 10 * 2;
  // Calculate size to comfortably fit `cols` number of cards, accounting for MemoryCard's internal padding
  const cardSize = Math.floor(((SW - boardHorizontalLoss) / cols) / 1.12);
  const isLastLevel = cfg.level >= LEVELS.length;

  return (
    <View style={gameStyles.root}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      {/* ── Top HUD ── */}
      <View style={gameStyles.hudRow}>
        <View style={gameStyles.hudCol}>
          <View style={gameStyles.scorePill}>
            <Text style={gameStyles.pillIcon}>⭐</Text>
            <Text style={gameStyles.scorePillTxt}>{score}</Text>
          </View>
          <CartoonButton size={44} onPress={() => { playTap(); setView('levels'); }} style={{ marginTop: 8 }}>
            <Text style={gameStyles.hudIcon}>←</Text>
          </CartoonButton>
        </View>

        <View style={gameStyles.targetCard}>
          <Text style={gameStyles.targetLabel}>PAIRS</Text>
          <Text style={gameStyles.targetIcon}>{matched}/{cfg.pairs}</Text>
        </View>

        <View style={gameStyles.hudCol}>
          <View style={gameStyles.levelPill}>
            <Text style={gameStyles.pillIcon}>👑</Text>
            <Text style={gameStyles.levelPillTxt}>LEVEL {cfg.level}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <CartoonButton size={44} onPress={() => { playTap(); startLevel(cfg.level); }}>
              <Text style={gameStyles.hudIcon}>↻</Text>
            </CartoonButton>
            <CartoonButton size={44} onPress={() => { playTap(); showHint(); }}>
              <Text style={gameStyles.hudIcon}>💡</Text>
            </CartoonButton>
          </View>
        </View>
      </View>

      <Text style={gameStyles.instruction}>Match all {cfg.pairs} pairs!</Text>

      <View style={gameStyles.statRow}>
        <View style={gameStyles.statPill}><Text style={gameStyles.statPillTxt}>💎 {score}</Text></View>
        <View style={gameStyles.statPill}><Text style={gameStyles.statPillTxt}>🏆 {bestScore}</Text></View>
      </View>

      <View style={gameStyles.boardFrame}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
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
        </ScrollView>
      </View>

      {/* ── Level Complete overlay ── */}
      {complete && (
        // `elevation` is required (not just absoluteFill) so this actually
        // paints over the HUD buttons/cards beneath it on Android — Android
        // orders overlapping views by elevation regardless of render order,
        // and those buttons/cards have their own elevation (2-6) for their
        // drop shadows, which otherwise shows through underneath this.
        <View style={[StyleSheet.absoluteFill, { elevation: 999, backgroundColor: '#1E7FC2' }]}>
          <Starburst />
          <View style={gameStyles.completeTopBar}>
            <View style={gameStyles.coinPill}>
              <Text style={gameStyles.pillIcon}>🏆</Text>
              <Text style={gameStyles.coinPillTxt}>{bestScore}</Text>
            </View>
            <TouchableOpacity style={gameStyles.closeBtn} onPress={() => { playTap(); setView('levels'); }}>
              <Text style={gameStyles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={gameStyles.completeCenter}>
            <View style={gameStyles.popup}>
              <BubbleText size={34}>Level{'\n'}Complete</BubbleText>
              <Text style={gameStyles.starsRow}>⭐⭐⭐</Text>
              <Text style={gameStyles.scoreLabel}>score</Text>
              <View style={gameStyles.scorePillDark}>
                <Text style={gameStyles.scorePillDarkTxt}>{score.toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={gameStyles.replayBtn} onPress={() => { playTap(); startLevel(cfg.level); }}>
                <Text style={gameStyles.replayBtnTxt}>Replay</Text>
              </TouchableOpacity>
            </View>

            <View style={gameStyles.navRow}>
              <TouchableOpacity style={gameStyles.navBtn} onPress={() => { playTap(); setView('levels'); }}>
                <Text style={gameStyles.navBtnTxt}>«  Back</Text>
              </TouchableOpacity>
              {!isLastLevel && (
                <TouchableOpacity style={gameStyles.navBtn} onPress={() => { playTap(); startLevel(cfg.level + 1); }}>
                  <Text style={gameStyles.navBtnTxt}>Next  »</Text>
                </TouchableOpacity>
              )}
            </View>
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
  title: { fontSize: 52, fontWeight: '900', color: '#111', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0, marginBottom: -10 },
  subtitle: { fontSize: 44, fontWeight: '900', color: '#111', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0, marginBottom: 30 },
  desc: { fontSize: 16, color: '#333', textAlign: 'center', fontWeight: '500', marginBottom: 40, lineHeight: 24 },
  cartoonArrow: { fontSize: 20, color: '#5A3410', fontWeight: '900', marginTop: -2 },
  playText: { fontSize: 22, fontWeight: '800', color: '#111', marginRight: 10 },
  coin: { backgroundColor: '#FFD52E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#B38100' },
  coinText: { fontSize: 16, fontWeight: '700', color: '#111' },
  bestScoreLabel: { fontSize: 14, color: '#333', fontWeight: '600', marginBottom: 4 },
  bestScoreVal: { fontSize: 24, fontWeight: '800', color: '#EE2244' },
});

// ── Level path node styles ────────────────────────────────────────────────
const pathStyles = StyleSheet.create({
  landing: {
    width: PATH_NODE * 1.55, height: PATH_NODE * 1.05,
    borderRadius: PATH_NODE,
    backgroundColor: '#F0DDB5',
  },
  woodBase: {
    position: 'absolute', bottom: -10,
    width: PATH_NODE * 0.94, height: PATH_NODE * 0.5,
    borderRadius: PATH_NODE * 0.47,
    backgroundColor: '#B9782E',
    borderWidth: 2, borderColor: '#7A4A18',
  },
  nodeFace: {
    width: PATH_NODE, height: PATH_NODE, borderRadius: PATH_NODE / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4,
  },
  shine: {
    position: 'absolute', top: 7, left: 10,
    width: PATH_NODE * 0.38, height: PATH_NODE * 0.2,
    borderRadius: PATH_NODE * 0.2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '-20deg' }],
  },
  nodeText: {
    fontSize: 22, fontWeight: '900', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1,
  },
  nodeTextLocked: { color: 'rgba(255,255,255,0.9)' },
  pinHead: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  floatingBack: {
    position: 'absolute', top: 50, left: 20,
  },
  floatingBackArrow: { fontSize: 20, color: '#5A3410', fontWeight: '900', marginTop: -2 },
});

const gameStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3E4C9' },

  // ── Top HUD ──
  hudRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: 50, paddingHorizontal: 16, gap: 10,
  },
  hudCol: { alignItems: 'center' },
  pillIcon: { fontSize: 14, marginRight: 4 },
  scorePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#5FB4E0', borderWidth: 2, borderColor: '#2C7FAE',
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  scorePillTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  levelPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0A868', borderWidth: 2, borderColor: '#B8722E',
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  levelPillTxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  hudIcon: { fontSize: 18 },
  targetCard: {
    width: 84, height: 84, borderRadius: 14,
    backgroundColor: '#FFF6E4', borderWidth: 2, borderColor: '#B8722E',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  targetLabel: { fontSize: 10, fontWeight: '800', color: '#7A5A38', letterSpacing: 0.5, marginBottom: 2 },
  targetIcon: { fontSize: 20, fontWeight: '800', color: '#7A5A38' },

  instruction: { textAlign: 'center', color: '#7A5A38', fontSize: 13, fontWeight: '600', marginTop: 10, marginHorizontal: 30 },

  // ── Stat pills row ──
  statRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12, marginBottom: 10 },
  statPill: {
    backgroundColor: '#FFF6E4', borderWidth: 1.5, borderColor: '#D9BE94',
    borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16,
  },
  statPillTxt: { fontSize: 14, fontWeight: '800', color: '#7A5A38' },

  // ── Board frame ──
  boardFrame: {
    flex: 1, marginHorizontal: 20, marginBottom: 24,
    backgroundColor: '#DCC29A', borderRadius: 22,
    borderWidth: 4, borderColor: '#B8860B',
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },

  // ── Level Complete overlay ──
  completeTopBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 50,
  },
  coinPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,30,50,0.5)', borderRadius: 18,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  coinPillTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#E8544A', borderWidth: 2, borderColor: '#B02E26',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnTxt: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },

  completeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  popup: {
    backgroundColor: '#F5E6D3', borderRadius: 28, borderWidth: 3, borderColor: 'rgba(122,74,24,0.25)',
    paddingVertical: 28, paddingHorizontal: 30, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  starsRow: { fontSize: 32, marginTop: 12, marginBottom: 10 },
  scoreLabel: { fontSize: 14, fontWeight: '700', color: '#7A5A38', marginBottom: 6 },
  scorePillDark: {
    backgroundColor: '#1E2A44', borderRadius: 16,
    paddingVertical: 8, paddingHorizontal: 28, marginBottom: 20,
  },
  scorePillDarkTxt: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  replayBtn: {
    backgroundColor: '#8FD9E0', borderWidth: 2, borderColor: '#3E9DA8',
    borderRadius: 22, paddingVertical: 10, paddingHorizontal: 34,
  },
  replayBtnTxt: { fontSize: 16, fontWeight: '800', color: '#1E5A60' },

  navRow: { flexDirection: 'row', gap: 16, marginTop: 24 },
  navBtn: {
    backgroundColor: '#F0A868', borderWidth: 2, borderColor: '#B8722E',
    borderRadius: 20, paddingVertical: 12, paddingHorizontal: 22,
  },
  navBtnTxt: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

const cardStyles = StyleSheet.create({
  front: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3,
  },
  back: {
    backgroundColor: '#C9A87C', // Flat tan — matches the reference board's empty cells
    borderWidth: 2, borderColor: '#A9835C',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  backInner: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)', // Top/Left light bevel
    borderBottomColor: 'rgba(0,0,0,0.12)', // Bottom shadow bevel
    borderRightColor: 'rgba(0,0,0,0.12)',
  },
  qMark: {
    fontWeight: '900', color: '#7A5A38',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0
  }
});

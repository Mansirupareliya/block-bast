import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, ScrollView, Image, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { playTap, playFlip, playMatch, playMismatch, playWin, playLocked } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber } from '../utils/storage';
import { getPlayerName } from '../utils/playerIdentity';
import { submitProgress } from '../utils/leaderboardService';
import LeaderboardScreen from './LeaderboardScreen';
import AdBanner from '../components/AdBanner';
import { showInterstitial } from '../utils/interstitialAd';
import BackButton from '../components/BackButton';
import ImageButton from '../components/ImageButton';
import ArtStartScreen from '../components/ArtStartScreen';
import TrophyButton from '../components/TrophyButton';
import { LEVEL_FONT } from '../utils/fonts';

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
// Boards are cols x rows (taller than wide, to fill the portrait board).
// An odd cell count can't be filled with pure pairs, so those boards get one
// extra pre-solved "bonus" tile (see buildDeck) dropped in the dead center.
const GRID_BY_GROUP = [
  { cols: 4, rows: 6 },   // levels 1-10:  24 cells, 12 pairs
  { cols: 5, rows: 7 },   // levels 11-20: 35 cells, 17 pairs + bonus
  { cols: 6, rows: 8 },   // levels 21-30: 48 cells, 24 pairs
  { cols: 7, rows: 9 },   // levels 31-40: 63 cells, 31 pairs + bonus
  { cols: 8, rows: 10 },  // levels 41-50: 80 cells, 40 pairs
];
const LEVELS_PER_GROUP = 10;

const LEVELS = Array.from({ length: GRID_BY_GROUP.length * LEVELS_PER_GROUP }, (_, i) => {
  const level = i + 1;
  const { cols, rows } = GRID_BY_GROUP[Math.floor(i / LEVELS_PER_GROUP)];
  const cells = cols * rows;
  return {
    level, cols, rows,
    pairs: Math.floor(cells / 2),
    bonusTile: cells % 2 === 1,
    theme: THEME_KEYS[(level - 1) % THEME_KEYS.length],
  };
});

// Testing switch: true opens every level on the map. Set back to false
// before release so levels unlock one by one again.
const UNLOCK_ALL_LEVELS = false;

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

// Memoized: a tap only re-renders the cards whose data actually changed,
// not the whole (up to 80-card) board. `onPress` must be stable; it's
// called with the card's index.
const MemoryCard = React.memo(function MemoryCard({ card, index, size, onPress, scaleAnim, disabled }) {
  const isVisible = card.flipped || card.matched;
  const br = size * 0.18;
  const pastel = CARD_COLORS[card.id % CARD_COLORS.length];

  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
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
});

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
        colors={['#8FE9FF', '#29B6F6', '#0A6FD1']}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: '#063E8A',
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
const PATH_NODE = 44;
const PATH_ROW_H = 84;
const PATH_PAD = 60;

// Candy colors from the level-map artwork: gold like its stars and blocks
// for finished levels, hat-ribbon pink for the current one, deep indigo
// (blending into the background) for locked ones.
const NODE_GRADIENT = {
  done:    ['#FFE58A', '#FFB31F', '#E07A00'],
  locked:  ['#7B72E6', '#4E43C2', '#2F268C'],
  current: ['#FFA3E4', '#FF3FB4', '#B0157A'],
};
// Solid (not translucent) so the landings cleanly cover the path's ends
// instead of the path's edges showing through them.
const PATH_FILL = '#4B40C8';
const PATH_EDGE = '#8F84F0';

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
        backgroundColor: PATH_FILL,
        borderWidth: 2, borderColor: PATH_EDGE,
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
        <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, backgroundColor: '#FFFFFF' }} />
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
// ── Start screen ──────────────────────────────────────────────────────────
// Full artwork with the PLAY button drawn in (see ArtStartScreen).
function MatchmakerStart({ onBack, onLeaderboard, onPlay }) {
  return (
    <ArtStartScreen
      bg={require('../assets/matchmaker_start_bg.jpg')}
      fg={require('../assets/matchmaker_start_fg.png')}
      art={{ w: 941, h: 1672 }}
      playRect={{ x: 333, y: 1010, w: 275, h: 95 }}
      onPlay={onPlay}
      backgroundColor="#1E1470"
    >
      <View style={[startStyles.header, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <BackButton onPress={onBack} />
        <TrophyButton onPress={onLeaderboard} />
      </View>
    </ArtStartScreen>
  );
}

export default function MatchmakerScreen({ onBack }) {
  const [view, setView] = useState('start'); // 'start' | 'game' | 'levels' | 'leaderboard'
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
  const [boardBox, setBoardBox] = useState(null); // measured board size, for card sizing

  const cardAnims = useRef([]);
  // The pair the last hint showed; repeated hints show this same pair
  // again until it's matched, then a new one is picked.
  const hintPairRef = useRef(null);
  // Taps can arrive faster than React re-renders, so the current selection
  // is also tracked in a ref (state alone could miss a quick second tap).
  const selectedRef = useRef([]);


  // Pushes this player's current name + stage reached to the shared
  // leaderboard. Fire-and-forget: a leaderboard that isn't configured yet,
  // or a flaky connection, should never interrupt gameplay.
  const syncLeaderboardProgress = useCallback(() => {
    getPlayerName().then((name) => {
      submitProgress('matchmakerLeaderboard', { name, maxLevel: globalUnlockedLevel, bestScore: globalBestScore }).catch((error) => {
        console.log('Leaderboard sync skipped:', error.message);
      });
    });
  }, []);

  // Restore progress saved on a previous app session. The `global*` vars
  // above only survive while the JS engine stays alive (screen navigations
  // within one session); a full app close/reopen resets them, which is
  // what was reported — so read the persisted values once on mount and
  // adopt them if they're ahead of what we have in memory.
  useEffect(() => {
    Promise.all([
      loadNumber(STORAGE_KEYS.MATCHMAKER_MAX_UNLOCKED, 1),
      loadNumber(STORAGE_KEYS.MATCHMAKER_BEST_SCORE, 0),
    ]).then(([savedLevel, savedScore]) => {
      if (savedLevel > globalUnlockedLevel) {
        globalUnlockedLevel = savedLevel;
        setMaxUnlockedLevel(savedLevel);
      }
      if (savedScore > globalBestScore) {
        globalBestScore = savedScore;
        setBestScore(savedScore);
      }
      syncLeaderboardProgress();
    });
  }, [syncLeaderboardProgress]);

  const cfg = LEVELS[currentLevelIdx] || LEVELS[0];

  const startLevel = useCallback((levelNum) => {
    const idx = levelNum - 1;
    const lcfg = LEVELS[idx];
    const deck = buildDeck(lcfg.pairs, lcfg.theme, lcfg.bonusTile);
    setCurrentLevelIdx(idx);
    setCards(deck);
    cardAnims.current = deck.map(() => new Animated.Value(1));
    setSelected([]); selectedRef.current = []; hintPairRef.current = null; setCanFlip(true);
    setMatched(0); setScore(0);
    setComplete(false);
    setView('game');
  }, []);

  // Quick "unfold" from a thin sliver — the new face is already set when
  // this starts, so the picture shows the instant the card is tapped.
  const unfold = useCallback((idx) => {
    const anim = cardAnims.current[idx];
    if (!anim) return;
    anim.setValue(0.15);
    Animated.timing(anim, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, []);

  // Fold cards shut, swap them back to "?" at the fold's midpoint (onMid),
  // then unfold. Used for a mismatch and for ending a hint.
  const foldBack = useCallback((indices, onMid) => {
    const anims = indices.map((i) => cardAnims.current[i]).filter(Boolean);
    Animated.parallel(anims.map((v) => Animated.timing(v, { toValue: 0.15, duration: 110, useNativeDriver: true })))
      .start(() => {
        onMid();
        Animated.parallel(anims.map((v) => Animated.timing(v, { toValue: 1, duration: 140, useNativeDriver: true }))).start();
      });
  }, []);

  const handleCardPress = useCallback((idx) => {
    if (!canFlip || cards[idx].flipped || cards[idx].matched || complete) return;
    if (selectedRef.current.includes(idx)) return;

    playFlip();
    setCards(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], flipped: true };
      return next;
    });
    unfold(idx);

    const newSel = [...selectedRef.current, idx];
    if (newSel.length < 2) { selectedRef.current = newSel; setSelected(newSel); return; }

    const [a, b] = newSel;
    selectedRef.current = [];
    setCanFlip(false);
    setSelected([]);

    // A match resolves quickly; a mismatch stays up a little longer so the
    // player can see both pictures before they flip back.
    const isMatch = cards[a].iconName === cards[b].iconName;
    setTimeout(() => {

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

          syncLeaderboardProgress();
        }
        setCanFlip(true);
      } else {
        playMismatch();
        foldBack([a, b], () => {
          setCards(prev => {
            const next = [...prev];
            next[a] = { ...next[a], flipped: false };
            next[b] = { ...next[b], flipped: false };
            return next;
          });
          setCanFlip(true);
        });
      }
    }, isMatch ? 250 : 650);
  }, [canFlip, cards, complete, matched, cfg, score, unfold, foldBack, syncLeaderboardProgress]);

  // Stable identity for MemoryCard's onPress so memoized cards don't all
  // re-render on every tap; always calls the latest handler.
  const pressRef = useRef(handleCardPress);
  pressRef.current = handleCardPress;
  const onCardPress = useCallback((idx) => pressRef.current(idx), []);

  // Hint = a full-screen ad, then one matching pair revealed for a moment
  // and turned back over. If the player already has a card face-up, the
  // hint shows that card's partner instead.
  const revealHint = useCallback(() => {
    const hidden = (i) => !cards[i].matched && !cards[i].flipped;
    const open = selectedRef.current[0];
    let reveal;
    if (open !== undefined) {
      const partner = cards.findIndex((c, i) => hidden(i) && c.iconName === cards[open].iconName);
      reveal = partner === -1 ? [] : [partner];
    } else {
      const last = hintPairRef.current;
      if (last && last.every(hidden)) {
        reveal = last;
      } else {
        const pool = cards.map((_, i) => i).filter(hidden);
        const a = pool[Math.floor(Math.random() * pool.length)];
        const b = pool.find((i) => i !== a && cards[i].iconName === cards[a].iconName);
        reveal = a === undefined || b === undefined ? [] : [a, b];
        hintPairRef.current = reveal.length ? reveal : null;
      }
    }

    if (!reveal.length) { setCanFlip(true); setHintActive(false); return; }

    setCards(prev => prev.map((c, i) => (reveal.includes(i) ? { ...c, flipped: true } : c)));
    reveal.forEach(unfold);
    setTimeout(() => {
      foldBack(reveal, () => {
        setCards(prev => prev.map((c, i) => (reveal.includes(i) ? { ...c, flipped: false } : c)));
        setCanFlip(true);
        setHintActive(false);
      });
    }, 1000);
  }, [cards, unfold, foldBack]);

  const showHint = useCallback(() => {
    if (hintActive || complete || !canFlip) return;
    setHintActive(true);
    setCanFlip(false);
    // Reveal after the ad closes (or right away if no ad was ready).
    showInterstitial(revealHint);
  }, [hintActive, complete, canFlip, revealHint]);

  // ── Render Leaderboard Screen ───────────────────────────────────────────
  if (view === 'leaderboard') {
    return (
      <LeaderboardScreen
        onBack={() => { playTap(); setView('start'); }}
        collectionName="matchmakerLeaderboard"
        sortFields={['maxLevel', 'bestScore']}
        title="Leaderboard"
        showStage
      />
    );
  }

  // ── Render Start Screen ─────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <MatchmakerStart
        onBack={() => { playTap(); onBack(); }}
        onLeaderboard={() => { playTap(); setView('leaderboard'); }}
        onPlay={() => { playTap(); setView('levels'); }}
      />
    );
  }

  // ── Render Levels Screen ────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={startStyles.artRoot}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <Image source={require('../assets/matchmaker_levels_bg.jpg')} style={startStyles.artImage} resizeMode="cover" />

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
                  const unlockedUpTo = UNLOCK_ALL_LEVELS ? LEVELS.length : maxUnlockedLevel;
                  const state = l.level > unlockedUpTo ? 'locked'
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
        <BackButton onPress={() => { playTap(); setView('start'); }} style={pathStyles.floatingBack} />
      </View>
    );
  }

  // ── Render Game Screen ──────────────────────────────────────────────────
  const { cols, rows } = cfg;
  // Cards are sized to fit the board both ways, so every grid fills the
  // board instead of leaving it half empty. Before the board is measured,
  // fall back to fitting the width (board margins 20*2 + border 4*2).
  // Inner space = measured board minus the grid padding (10*2). Each card
  // cell is the card plus MemoryCard's padding of max(2, 5%) per side.
  const innerW = boardBox ? boardBox.width - 20 : SW - (20 * 2 + 4 * 2 + 10 * 2);
  const innerH = boardBox ? boardBox.height - 20 : Infinity;
  const cell = Math.min(innerW / cols, innerH / rows);
  const cardSize = Math.floor(Math.min(cell / 1.1, cell - 4));
  const cardCell = cardSize + 2 * Math.max(2, cardSize * 0.05);
  const isLastLevel = cfg.level >= LEVELS.length;

  return (
    <View style={gameStyles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <Image source={require('../assets/matchmaker_levels_bg.jpg')} style={startStyles.artImage} resizeMode="cover" />

      {/* ── Top HUD ── */}
      <View style={gameStyles.hudRow}>
        <View style={gameStyles.hudCol}>
          <View style={gameStyles.scorePill}>
            <Text style={gameStyles.pillIcon}>⭐</Text>
            <Text style={gameStyles.scorePillTxt}>{score}</Text>
          </View>
          <BackButton onPress={() => { playTap(); setView('levels'); }} style={{ marginTop: 8 }} />
        </View>

        <View style={gameStyles.targetCard}>
          <Text style={gameStyles.targetLabel}>PAIRS</Text>
          <Text style={gameStyles.targetIcon}>{matched}/{cfg.pairs}</Text>
        </View>

        <View style={gameStyles.hudCol}>
          <View style={gameStyles.levelPill}>
            <Text style={gameStyles.pillIcon}>🏆</Text>
            <Text style={gameStyles.levelPillTxt}>LEVEL {cfg.level}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <ImageButton
              source={require('../assets/restart_button.png')}
              aspect={160 / 155}
              size={44}
              onPress={() => { playTap(); startLevel(cfg.level); }}
            />
            <CartoonButton size={44} onPress={() => { playTap(); showHint(); }}>
              <Text style={gameStyles.hudIcon}>💡</Text>
            </CartoonButton>
          </View>
        </View>
      </View>

      <Text style={gameStyles.instruction}>Match all {cfg.pairs} pairs!</Text>

      <View style={gameStyles.statRow}>
        <View style={gameStyles.statPill}><Text style={gameStyles.statPillTxt}>💎 {score}</Text></View>
        <View style={[gameStyles.statPill, gameStyles.statPillRow]}>
          <Text style={gameStyles.pillIcon}>🏆</Text>
          <Text style={gameStyles.statPillTxt}>{bestScore}</Text>
        </View>
      </View>

      <View
        style={gameStyles.boardFrame}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          // minus the frame's 4px border on each side
          setBoardBox({ width: width - 8, height: height - 8 });
        }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, alignItems: 'center', flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
          <View style={[gameStyles.grid, { width: Math.ceil(cols * cardCell) + 1 }]}>
            {cards.map((card, idx) => (
              <MemoryCard
                key={idx}
                card={card}
                size={cardSize}
                index={idx}
                onPress={onCardPress}
                scaleAnim={cardAnims.current[idx]}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <AdBanner />

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
            <TouchableOpacity style={gameStyles.closeBtn} onPress={() => { playTap(); setView('levels'); showInterstitial(); }}>
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
              <TouchableOpacity style={gameStyles.navBtn} onPress={() => { playTap(); setView('levels'); showInterstitial(); }}>
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
  artRoot: { flex: 1, backgroundColor: '#1E1470' },
  // Explicit size: absoluteFill alone lets Android draw the image at its own
  // pixel size (zoomed in and blurry) instead of fitting the screen.
  artImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
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
    backgroundColor: PATH_FILL,
    borderWidth: 2, borderColor: PATH_EDGE,
  },
  woodBase: {
    position: 'absolute', bottom: -PATH_NODE * 0.16,
    width: PATH_NODE * 0.94, height: PATH_NODE * 0.5,
    borderRadius: PATH_NODE * 0.47,
    backgroundColor: '#2A1E8F',
    borderWidth: 2, borderColor: '#170F5C',
  },
  nodeFace: {
    width: PATH_NODE, height: PATH_NODE, borderRadius: PATH_NODE / 2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4,
  },
  shine: {
    position: 'absolute', top: PATH_NODE * 0.12, left: PATH_NODE * 0.17,
    width: PATH_NODE * 0.38, height: PATH_NODE * 0.2,
    borderRadius: PATH_NODE * 0.2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '-20deg' }],
  },
  nodeText: {
    fontSize: 18, ...LEVEL_FONT, color: '#FFFFFF',
    textShadowColor: 'rgba(40,15,90,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2,
  },
  nodeTextLocked: { color: 'rgba(255,255,255,0.55)' },
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

// Frosted indigo "glass" panels that sit on the gameplay background art.
const GLASS = { backgroundColor: 'rgba(24,16,96,0.55)', borderColor: 'rgba(143,132,240,0.85)' };

const gameStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E1470' },

  // ── Top HUD ──
  hudRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
    paddingTop: 50, paddingHorizontal: 16, gap: 10,
  },
  hudCol: { alignItems: 'center' },
  pillIcon: { fontSize: 14, marginRight: 4 },
  scorePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#29B6F6', borderWidth: 2, borderColor: '#0A6FD1',
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  scorePillTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  levelPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FF3FB4', borderWidth: 2, borderColor: '#B0157A',
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  levelPillTxt: { fontSize: 14, ...LEVEL_FONT, color: '#FFFFFF', letterSpacing: 0.5 },
  hudIcon: { fontSize: 20, color: '#FFFFFF', fontWeight: '900' },
  targetCard: {
    width: 84, height: 84, borderRadius: 14,
    ...GLASS, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  targetLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5, marginBottom: 2 },
  targetIcon: { fontSize: 20, fontWeight: '900', color: '#FFD23F' },

  instruction: { textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginTop: 10, marginHorizontal: 30 },

  // ── Stat pills row ──
  statRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12, marginBottom: 10 },
  statPill: {
    ...GLASS, borderWidth: 1.5,
    borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16,
  },
  statPillRow: { flexDirection: 'row', alignItems: 'center' },
  statPillTxt: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  // ── Board frame ──
  boardFrame: {
    flex: 1, marginHorizontal: 20, marginBottom: 10,
    backgroundColor: GLASS.backgroundColor, borderRadius: 22,
    borderWidth: 4, borderColor: '#FFB31F',
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
    backgroundColor: '#6A4CE0', // purple candy, from the gameplay background art
    borderWidth: 2, borderColor: '#3D2AA8',
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
    fontWeight: '900', color: '#FFD23F',
    textShadowColor: 'rgba(40,15,90,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 1
  }
});

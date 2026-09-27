import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ScrollView, Animated, Image, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { hapticTap, hapticFail } from '../utils/haptics';
import { playTap, playClick, playSuccess, playLocked } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber } from '../utils/storage';
import { BOXPUSHER_LEVELS } from '../utils/boxPusherLevels';
import { showInterstitial } from '../utils/interstitialAd';
import BackButton from '../components/BackButton';
import ArtStartScreen from '../components/ArtStartScreen';
import { LEVEL_FONT } from '../utils/fonts';

const { width: SW, height: SH } = Dimensions.get('window');
const HIT = { top: 20, bottom: 20, left: 20, right: 20 };
const TIME_LIMIT = 50; // seconds per level before it auto-restarts

const DIRS = {
  up:    [-1, 0],
  down:  [1, 0],
  left:  [0, -1],
  right: [0, 1],
};

// ── Level parsing ─────────────────────────────────────────────────────────
// # wall, ' ' floor, . target, $ crate, * crate-on-target, @ player,
// + player-on-target (see utils/boxPusherLevels.js).
function parseLevel(grid) {
  const rows = grid.length;
  const cols = grid.reduce((m, row) => Math.max(m, row.length), 0);
  const walls = new Set();
  const targets = new Set();
  const crates = new Set();
  let player = null;
  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    for (let c = 0; c < cols; c++) {
      const ch = row[c] || ' ';
      const k = `${r},${c}`;
      if (ch === '#') walls.add(k);
      if (ch === '.' || ch === '*' || ch === '+') targets.add(k);
      if (ch === '$' || ch === '*') crates.add(k);
      if (ch === '@' || ch === '+') player = k;
    }
  }
  return { rows, cols, walls, targets, crates, player };
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── Theme ─────────────────────────────────────────────────────────────────
// A moodier "premium mobile game" look — deep navy gradient, translucent
// glass cards, and a warm gold accent for anything "selected" or
// "celebratory" — instead of the earlier flat mint/green screen.
const BG_GRADIENT = ['#48598C', '#2A3350', '#141A2B'];
const GLASS = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';
const TEXT = '#FFFFFF';
const TEXT_DIM = 'rgba(230,235,255,0.6)';
const ACCENT = '#5B8DEF';
const ACCENT_DIM = 'rgba(91,141,239,0.35)';
const GOLD = '#FFD23F';

// A different cute character per level instead of always the panda —
// cycles through this roster by level number.
const CHARACTERS = ['🦀', '🐤', '🦊', '🐸', '🐘', '🦇', '🐼', '🐷'];

// ── View-drawn 2D lock icon (locked level tiles) ─────────────────────────
function LockIcon({ size = 22, color = 'rgba(255,255,255,0.55)', holeColor = '#232B45' }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{
        position: 'absolute', top: 0,
        width: s * 0.56, height: s * 0.42,
        borderWidth: s * 0.12,
        borderColor: color,
        borderBottomWidth: 0,
        borderTopLeftRadius: s * 0.28,
        borderTopRightRadius: s * 0.28,
      }} />
      <View style={{
        width: s * 0.86, height: s * 0.56,
        borderRadius: s * 0.1,
        backgroundColor: color,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{ width: s * 0.14, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: holeColor }} />
        <View style={{ width: s * 0.08, height: s * 0.14, marginTop: -s * 0.02, backgroundColor: holeColor }} />
      </View>
    </View>
  );
}

// ── Circular glass back/action button ────────────────────────────────────
function GlassButton({ children, onPress, style }) {
  return (
    <TouchableOpacity style={[s.glassBtn, style]} onPress={onPress} activeOpacity={0.7} hitSlop={HIT}>
      {children}
    </TouchableOpacity>
  );
}

// ── Glossy cartoon bubble button (game screen chrome + D-pad) ────────────
// A chunky glossy circle — bold saturated border, a lighter-top/darker-
// bottom gradient face, a diagonal glossy highlight blob, and a drop
// shadow — matching a classic "cartoon button set" look, built purely
// from Views/LinearGradient (no image assets).
function CartoonButton({ size = 60, onPress, disabled, children, style }) {
  const borderW = Math.max(3, size * 0.06);
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={HIT}
      style={style}
    >
      <LinearGradient
        colors={disabled ? ['#9AA0A8', '#767C84', '#565B62'] : ['#FFF8E8', THEME.cream, THEME.creamEdge]}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: disabled ? '#4A4F56' : THEME.purple,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 6,
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

// ── Background ────────────────────────────────────────────────────────────
// A few softly glowing icons drifting behind the content, tuned for the
// dark background — same bobbing technique as Matchmaker's start screen.
const FLOAT_ICONS = ['📦', '✨', '🎋', '🐾', '🌿', '✨'];
const FLOAT_POSITIONS = [
  { top: '8%',  left: '8%',  size: 32, duration: 2200, delay: 0 },
  { top: '15%', right: '10%', size: 22, duration: 1900, delay: 300 },
  { top: '38%', left: '5%',  size: 24, duration: 2500, delay: 650 },
  { top: '50%', right: '8%', size: 34, duration: 2100, delay: 150 },
  { top: '65%', left: '10%', size: 26, duration: 2400, delay: 500 },
  { top: '75%', right: '14%', size: 20, duration: 1800, delay: 800 },
];

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

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });

  return (
    <Animated.Text style={[style, { fontSize: size, transform: [{ translateY }, { rotate }] }]}>
      {icon}
    </Animated.Text>
  );
}

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
          style={{ position: 'absolute', top: p.top, left: p.left, right: p.right, opacity: 0.3 }}
        />
      ))}
    </View>
  );
}

// ── Glowing pulse ring (behind the mascot / the Play button) ─────────────
function GlowPulse({ size, color = ACCENT, style }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.15] });
  return (
    <View
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color, opacity, transform: [{ scale }],
        }}
      />
    </View>
  );
}

// ── "3D bubble" text (logo title) ─────────────────────────────────────────
// RN Text has no text-stroke, so the outline is faked by stacking the same
// string in the outline color at small offsets behind the real, colored
// text on top — a standard trick for this cartoon-game lettering look.
function BubbleText({ children, size = 26, color = '#FFFFFF', stroke = '#1B3A6B' }) {
  const offsets = [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, -2], [0, 2], [-2, 0], [2, 0]];
  const base = { fontSize: size, fontWeight: '900', textAlign: 'center', letterSpacing: 1 };
  return (
    <View>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

// ── View-drawn 5-point star (level rating) ────────────────────────────────
function starPoints(size) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2, innerR = size * 0.21;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function Star({ size = 12, filled }) {
  return (
    <Svg width={size} height={size}>
      <Polygon
        points={starPoints(size)}
        fill={filled ? GOLD : 'rgba(255,255,255,0.16)'}
        stroke={filled ? '#C79A1E' : 'rgba(255,255,255,0.3)'}
        strokeWidth={1}
      />
    </Svg>
  );
}

// ── Sakura courtyard game theme ───────────────────────────────────────────
// The courtyard art fills the whole screen on every phone. It's scaled to
// cover (keeping its proportions, never stretched); on phones taller than the
// art only a thin strip of the side decorations is trimmed, while the paved
// courtyard in the middle always stays in view.
const THEME = {
  purple: '#4B2E6B', purpleDark: '#2E1A45',
  cream: '#F7EEDA', creamEdge: '#CDBF9C',
  pink: '#F7A8C4', pinkDeep: '#E86FA8',
  stone: '#D9CDA8', grout: 'rgba(110,92,55,0.45)',
  roof: '#3E4658', roofEdge: '#262C3A', roofHi: '#5D6782',
  wood: '#6B4526',
};

// `blurred` swaps in a pre-blurred copy of the art (and dims it a little) for
// pages where it sits behind lots of UI, like the level grid. Pre-blurred
// rather than blurRadius, since Android applies blurRadius at the image's own
// pixel size, so the same radius looks much weaker on a big screen.
function CourtyardBackdrop({ blurred = false }) {
  return (
    <>
      <Image
        source={blurred ? require('../assets/boxpusher/courtyard_blur.jpg') : require('../assets/boxpusher/courtyard_bg.jpg')}
        style={s.bgFill}
        resizeMode="cover"
      />
      {blurred && <View style={[s.bgFill, { backgroundColor: 'rgba(30,18,45,0.25)' }]} />}
    </>
  );
}

// D-pad key drawn from the sakura button art; sinks a little while pressed.
const DPAD_ART = {
  up: require('../assets/boxpusher/btn_up.png'),
  down: require('../assets/boxpusher/btn_down.png'),
  left: require('../assets/boxpusher/btn_left.png'),
  right: require('../assets/boxpusher/btn_right.png'),
  undo: require('../assets/boxpusher/btn_undo.png'),
};
const DPAD_W = 82;
const DPAD_H = DPAD_W / 1.19; // button art is ~1.19:1

function DpadButton({ kind, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {({ pressed }) => (
        <Image
          source={DPAD_ART[kind]}
          style={{ width: DPAD_W, height: DPAD_H, transform: [{ scale: pressed ? 0.9 : 1 }], opacity: pressed ? 0.85 : 1 }}
          resizeMode="contain"
        />
      )}
    </Pressable>
  );
}

// ── Level tile: sakura plaque with the level number ───────────────────────
// Same stone-and-sakura plaque as the D-pad keys, blank in the middle for the
// number. Solved levels get 3 filled stars, the next level to play pulses
// with a pink glow, and locked levels are a grey plaque with a lock.
const TILE_COLS = 4;
const TILE_W = Math.min(84, (SW - 40) / TILE_COLS - 10);
const TILE_H = TILE_W / 1.15; // plaque art is 240x209

function LevelTile({ num, state, onPress }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, friction: 6, tension: 90, delay: Math.min(num * 12, 260),
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const locked = state === 'locked';

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }], margin: 5, alignItems: 'center' }}>
      <Pressable onPress={onPress} hitSlop={4}>
        {({ pressed }) => (
          <View style={{ width: TILE_W, height: TILE_H, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : 1 }] }}>
            {state === 'current' && <GlowPulse size={TILE_W * 1.05} color={THEME.pinkDeep} />}
            <Image
              source={locked ? require('../assets/boxpusher/plaque_locked.png') : require('../assets/boxpusher/plaque.png')}
              style={[StyleSheet.absoluteFill, { width: TILE_W, height: TILE_H }]}
              resizeMode="contain"
            />
            {locked ? (
              <LockIcon size={TILE_W * 0.26} color="#6B6B6B" holeColor="#E4E4E4" />
            ) : (
              <Text style={[s.plaqueNum, { fontSize: TILE_W * 0.3 }]}>{num}</Text>
            )}
          </View>
        )}
      </Pressable>
      {!locked && (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
          {[0, 1, 2].map((i) => <Star key={i} size={12} filled={state === 'done'} />)}
        </View>
      )}
    </Animated.View>
  );
}

let globalUnlockedLevel = 1;

// ── Main Screen ───────────────────────────────────────────────────────────
export default function BoxPusherScreen({ onBack }) {
  const [view, setView] = useState('start'); // 'start' | 'levels' | 'game'
  const [levelIdx, setLevelIdx] = useState(0);
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(globalUnlockedLevel);

  const [rows, setRows] = useState(0);
  const [cols, setCols] = useState(0);
  const [walls, setWalls] = useState(() => new Set());
  const [targets, setTargets] = useState(() => new Set());
  const [crates, setCrates] = useState(() => new Set());
  const [player, setPlayer] = useState(null);
  const [moveCount, setMoveCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [complete, setComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);

  const popupAnim = useRef(new Animated.Value(0)).current;

  // Restore progress saved on a previous app session — same pattern as
  // Dogs Blocks / Matchmaker.
  useEffect(() => {
    loadNumber(STORAGE_KEYS.BOXPUSHER_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlockedLevel) {
        globalUnlockedLevel = saved;
        setMaxUnlockedLevel(saved);
      }
    });
  }, []);

  useEffect(() => {
    if (complete) {
      Animated.spring(popupAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
    } else {
      popupAnim.setValue(0);
    }
  }, [complete, popupAnim]);

  const startLevel = useCallback((levelNum) => {
    const idx = levelNum - 1;
    const lvl = BOXPUSHER_LEVELS[idx];
    if (!lvl) return;
    const parsed = parseLevel(lvl.grid);
    setLevelIdx(idx);
    setRows(parsed.rows);
    setCols(parsed.cols);
    setWalls(parsed.walls);
    setTargets(parsed.targets);
    setCrates(parsed.crates);
    setPlayer(parsed.player);
    setMoveCount(0);
    setHistory([]);
    setComplete(false);
    setTimeLeft(TIME_LIMIT);
    setView('game');
  }, []);

  const resetLevel = useCallback(() => {
    startLevel(levelIdx + 1);
  }, [levelIdx, startLevel]);

  // Countdown timer — restarts the level fresh if time runs out before it's
  // solved. Self-rescheduling setTimeout (rather than setInterval) so it
  // cleanly stops the instant `view`/`complete` changes, with no separate
  // stop() call needed.
  useEffect(() => {
    if (view !== 'game' || complete) return;
    if (timeLeft <= 0) {
      resetLevel();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [view, complete, timeLeft, resetLevel]);

  const tryMove = useCallback((dir) => {
    if (complete || !player) return;
    const [dr, dc] = DIRS[dir];
    const [pr, pc] = player.split(',').map(Number);
    const nr = pr + dr, nc = pc + dc;
    const nk = `${nr},${nc}`;
    if (walls.has(nk)) { hapticFail(); return; }
    hapticTap();

    if (crates.has(nk)) {
      const nnr = nr + dr, nnc = nc + dc;
      const nnk = `${nnr},${nnc}`;
      if (walls.has(nnk) || crates.has(nnk)) return; // push blocked

      setHistory(h => [...h, { player, crates, moveCount }]);
      const newCrates = new Set(crates);
      newCrates.delete(nk);
      newCrates.add(nnk);
      setCrates(newCrates);
      setPlayer(nk);
      setMoveCount(m => m + 1);
      playClick();

      if (sameSet(newCrates, targets)) {
        setComplete(true);
        playSuccess();
        const nextLevel = Math.max(maxUnlockedLevel, levelIdx + 2);
        setMaxUnlockedLevel(nextLevel);
        globalUnlockedLevel = nextLevel;
        saveNumber(STORAGE_KEYS.BOXPUSHER_MAX_UNLOCKED, nextLevel);
      }
    } else {
      setHistory(h => [...h, { player, crates, moveCount }]);
      setPlayer(nk);
      setMoveCount(m => m + 1);
      playTap();
    }
  }, [complete, player, walls, crates, targets, moveCount, levelIdx, maxUnlockedLevel]);

  const undo = useCallback(() => {
    if (complete || !history.length) return;
    const last = history[history.length - 1];
    setPlayer(last.player);
    setCrates(last.crates);
    setMoveCount(last.moveCount);
    setHistory(h => h.slice(0, -1));
  }, [complete, history]);

  // ── Render Start Screen ─────────────────────────────────────────────────
  if (view === 'start') {
    // Full artwork with the PLAY button drawn in (see ArtStartScreen).
    // The art is sharp and detailed, so the filler behind it is blurred.
    return (
      <ArtStartScreen
        bg={require('../assets/boxpusher_start_bg.jpg')}
        fg={require('../assets/boxpusher_start_fg.png')}
        art={{ w: 940, h: 1672 }}
        playRect={{ x: 222, y: 1098, w: 498, h: 192 }}
        onPlay={() => { playTap(); setView('levels'); }}
        fillBlur={14}
        backgroundColor="#6FB3E8"
      >
        <View style={s.header}>
          <BackButton onPress={() => { playTap(); onBack(); }} />
        </View>
      </ArtStartScreen>
    );
  }

  // ── Render Levels Screen ────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={[s.root, { backgroundColor: '#6E6A5E' }]}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <CourtyardBackdrop blurred />
        <View style={s.levelsHeader}>
          <BackButton onPress={() => { playTap(); setView('start'); }} />
          <View style={s.gameTitlePill}>
            <Text style={s.gameTitle}>Levels</Text>
          </View>
          <View style={s.levelsCount}>
            <Text style={s.levelsCountTxt}>{Math.min(maxUnlockedLevel - 1, BOXPUSHER_LEVELS.length)}/{BOXPUSHER_LEVELS.length}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.levelsScroll} showsVerticalScrollIndicator={false}>
          <View style={s.levelsPanel}>
            {BOXPUSHER_LEVELS.map((_, i) => {
              const num = i + 1;
              const state = num > maxUnlockedLevel ? 'locked' : num === maxUnlockedLevel ? 'current' : 'done';
              return (
                <LevelTile
                  key={i}
                  num={num}
                  state={state}
                  onPress={() => {
                    if (state !== 'locked') { playTap(); startLevel(num); }
                    else playLocked();
                  }}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Render Game Screen ──────────────────────────────────────────────────
  const PAD = 20;
  const availW = SW - PAD * 2;
  const availH = SH - 450; // header + stats + dpad chrome + bottom banner ad
  let cellSize = Math.floor(Math.min(availW / Math.max(1, cols), availH / Math.max(1, rows)));
  // Levels now go up to a 13x13 maze — no lower floor beyond "still
  // visible", or a big grid on a narrow phone would overflow the screen
  // instead of just rendering smaller cells.
  cellSize = Math.max(16, Math.min(52, cellSize));
  const isLastLevel = levelIdx + 1 >= BOXPUSHER_LEVELS.length;

  const popupScale = popupAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  // A real derived score/star rating from actual performance (time left,
  // moves taken) — not a fabricated number — computed once completion is
  // reached, so it also stays stable if the finished board re-renders.
  const timeFrac = timeLeft / TIME_LIMIT;
  const starsEarned = timeFrac > 0.5 ? 3 : timeFrac > 0.2 ? 2 : 1;
  const score = Math.max(0, 1000 + timeLeft * 20 - moveCount * 10);
  const character = CHARACTERS[levelIdx % CHARACTERS.length];

  return (
    <View style={[s.root, { backgroundColor: '#6E6A5E' }]}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <CourtyardBackdrop />

      <View style={s.gameTopBar}>
        <BackButton onPress={() => { playTap(); setView('levels'); }} />
        <View style={s.gameTitlePill}>
          <Text style={s.gameTitle}>Level {levelIdx + 1}</Text>
        </View>
        <CartoonButton size={46} onPress={() => { playTap(); resetLevel(); }}>
          <Text style={s.cartoonIcon}>↻</Text>
        </CartoonButton>
      </View>

      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>TIME</Text>
          <Text style={s.statValue}>{formatTime(timeLeft)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>MOVES</Text>
          <Text style={s.statValue}>{moveCount}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>CRATES</Text>
          <Text style={s.statValue}>{targets.size}</Text>
        </View>
      </View>

      <View style={s.boardWrap}>
        <View style={[s.board, { width: cols * cellSize, height: rows * cellSize }]}>
          {Array.from({ length: rows }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {Array.from({ length: cols }).map((_, c) => {
                const k = `${r},${c}`;
                const isWall = walls.has(k);
                const isTarget = targets.has(k);
                const isCrate = crates.has(k);
                const isPlayer = player === k;
                return (
                  <View
                    key={c}
                    style={[
                      s.cell,
                      { width: cellSize, height: cellSize },
                      isWall ? s.wallCell : s.floorCell,
                    ]}
                  >
                    {!isWall && isTarget && !isCrate && <View style={s.targetRing} />}
                    {!isWall && isCrate && (
                      <View style={[s.crateWrap, isTarget && s.crateOnTarget]}>
                        <Text style={{ fontSize: cellSize * 0.58 }}>📦</Text>
                      </View>
                    )}
                    {!isWall && isPlayer && (
                      <Text style={{ fontSize: cellSize * 0.66 }}>{CHARACTERS[levelIdx % CHARACTERS.length]}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* ── D-Pad (sakura button art) ── */}
      <View style={s.dpadWrap} pointerEvents={complete ? 'none' : 'auto'}>
        <DpadButton kind="up" onPress={() => tryMove('up')} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DpadButton kind="left" onPress={() => tryMove('left')} />
          <DpadButton kind="undo" onPress={() => { playTap(); undo(); }} />
          <DpadButton kind="right" onPress={() => tryMove('right')} />
        </View>
        <DpadButton kind="down" onPress={() => tryMove('down')} />
      </View>

      {/* Reserved (invisible) space for a banner ad below the controls —
          drop a real ad component (AdMob or similar, needs its own
          account/SDK setup) in place of this View when ready. */}
      <View style={s.adSlot} />

      {complete && (
        <View style={[StyleSheet.absoluteFill, s.overlay, { elevation: 999 }]}>
          <LinearGradient colors={['#3A5A3E', '#1D2E1F', '#0F1710']} style={StyleSheet.absoluteFill} />

          <View style={s.completeTopBar}>
            <BackButton onPress={() => { playTap(); setView('levels'); showInterstitial(); }} />
          </View>

          <View style={s.completeCenter}>
            <Animated.View style={{ opacity: popupAnim, transform: [{ scale: popupScale }], alignItems: 'center' }}>
              <View style={s.popup}>
                {/* Ribbon banner */}
                <View style={s.ribbonRow}>
                  <View style={s.ribbonFlapLeft} />
                  <View style={s.ribbonBody}>
                    <BubbleText size={24} color="#FFFFFF" stroke="#2E7D32">COMPLETE</BubbleText>
                  </View>
                  <View style={s.ribbonFlapRight} />
                </View>

                <Text style={s.levelLabel}>LEVEL {levelIdx + 1}</Text>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {[0, 1, 2].map((i) => <Star key={i} size={30} filled={i < starsEarned} />)}
                </View>

                <View style={s.mascotBurstWrap}>
                  <GlowPulse size={110} color={GOLD} />
                  <Text style={s.mascotBurstChar}>{character}</Text>
                </View>

                <Text style={s.scoreLabel2}>YOUR SCORE</Text>
                <Text style={s.scoreValue2}>{score.toLocaleString()}</Text>

                <View style={{ flexDirection: 'row', gap: 14, marginTop: 18 }}>
                  <TouchableOpacity style={s.pillReplay} onPress={() => { playTap(); resetLevel(); }}>
                    <Text style={s.pillBtnTxt}>↻  REPLAY</Text>
                  </TouchableOpacity>
                  {!isLastLevel && (
                    <TouchableOpacity style={s.pillNext} onPress={() => { playTap(); startLevel(levelIdx + 2); }}>
                      <Text style={s.pillBtnTxt}>NEXT  ▶</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isLastLevel && (
                  <View style={s.allDoneRow}>
                    <Text style={s.allDoneTxt}>You cleared every level!</Text>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 50, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT },
  backArrow: { fontSize: 26, color: TEXT, marginTop: -2 },

  glassBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  // Start screen
  startContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoBadge: {
    width: 190, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 10,
    alignItems: 'center', overflow: 'hidden',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  logoShine: {
    position: 'absolute', top: -14, left: -14, right: -14, height: '55%',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
    transform: [{ rotate: '-3deg' }],
  },
  mascotWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  mascot: { fontSize: 76 },
  descCard: {
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER,
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 22,
  },
  desc: { fontSize: 15, color: TEXT_DIM, textAlign: 'center', fontWeight: '500', lineHeight: 22 },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    marginBottom: 30, gap: 10,
  },
  progressStar: { fontSize: 18 },
  progressTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: GOLD },
  progressTxt: { fontSize: 12, fontWeight: '700', color: TEXT_DIM, minWidth: 44, textAlign: 'right' },

  playBtnWrap: { alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    paddingVertical: 15, paddingHorizontal: 50,
    borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  playText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  // Game screen chrome
  gameTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 6,
  },
  gameTitlePill: {
    backgroundColor: THEME.cream, borderWidth: 3, borderColor: THEME.purple,
    borderRadius: 18, paddingVertical: 5, paddingHorizontal: 18,
  },
  gameTitle: { fontSize: 20, ...LEVEL_FONT, color: THEME.purple },
  cartoonIcon: { fontSize: 22, color: THEME.purple, fontWeight: '900', marginTop: -2 },
  bgFill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  // Levels page (sakura theme)
  levelsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10,
  },
  levelsCount: {
    minWidth: 52, alignItems: 'center',
    backgroundColor: THEME.purple, borderRadius: 14, borderWidth: 2, borderColor: THEME.cream,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  levelsCountTxt: { fontSize: 13, ...LEVEL_FONT, color: THEME.cream },
  levelsScroll: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 100 },
  // Frosted purple card behind the grid so every plaque (including the
  // first row, which sits over the busy rooftops) reads clearly.
  levelsPanel: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    backgroundColor: 'rgba(46,26,69,0.6)',
    borderRadius: 22, borderWidth: 3, borderColor: 'rgba(247,238,218,0.85)',
  },
  plaqueNum: {
    ...LEVEL_FONT, color: THEME.purple, marginTop: 4,
    textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1,
  },

  statsBar: {
    flexDirection: 'row', backgroundColor: 'rgba(247,238,218,0.94)',
    marginHorizontal: 20, marginTop: 6, marginBottom: 14,
    borderRadius: 16, paddingVertical: 10,
    justifyContent: 'space-around', alignItems: 'center',
    borderWidth: 3, borderColor: THEME.purple,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: THEME.pinkDeep, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { fontSize: 17, ...LEVEL_FONT, color: THEME.purple },
  statDivider: { width: 2, height: 22, backgroundColor: 'rgba(75,46,107,0.25)' },

  // Board
  boardWrap: { alignItems: 'center', justifyContent: 'center', flexGrow: 0 },
  // Stone-paved courtyard in a wooden frame: floor = pale flagstones,
  // walls = slate roof tiles, targets = purple/sakura seals (matching the
  // D-pad art).
  board: {
    backgroundColor: THEME.roofEdge,
    borderRadius: 12,
    borderWidth: 5, borderColor: THEME.wood,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  cell: { alignItems: 'center', justifyContent: 'center' },
  wallCell: {
    backgroundColor: THEME.roof,
    borderWidth: 1, borderColor: THEME.roofEdge, borderTopColor: THEME.roofHi,
  },
  floorCell: { backgroundColor: THEME.stone, borderWidth: 1, borderColor: THEME.grout },
  targetRing: {
    width: '52%', height: '52%', borderRadius: 999,
    borderWidth: 3, borderColor: THEME.purple,
    backgroundColor: THEME.pink,
  },
  crateWrap: {
    width: '86%', height: '86%', borderRadius: 8,
    backgroundColor: 'rgba(107,69,38,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(107,69,38,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  crateOnTarget: {
    backgroundColor: 'rgba(247,168,196,0.7)',
    borderColor: THEME.purple, borderWidth: 2.5,
  },

  // D-Pad (glossy cartoon bubble buttons — see CartoonButton)
  dpadWrap: { alignItems: 'center', marginTop: 'auto', marginBottom: 14, gap: 2 },
  adSlot: { height: 60, marginBottom: 16 },

  // Complete overlay
  overlay: { justifyContent: 'center', alignItems: 'center' },
  completeTopBar: { paddingTop: 50, paddingHorizontal: 20 },
  completeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  popup: {
    backgroundColor: '#FBF2DC', paddingTop: 34, paddingBottom: 26, paddingHorizontal: 24,
    borderRadius: 26, alignItems: 'center', width: SW * 0.84,
    borderWidth: 2, borderColor: 'rgba(122,74,24,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },

  // Ribbon banner ("COMPLETE") straddling the top edge of the card
  ribbonRow: {
    position: 'absolute', top: -22, flexDirection: 'row', alignItems: 'center',
  },
  ribbonBody: {
    backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#2E7D32',
    paddingVertical: 10, paddingHorizontal: 22,
  },
  ribbonFlapLeft: {
    width: 0, height: 0,
    borderTopWidth: 22, borderBottomWidth: 22, borderRightWidth: 16,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#2E7D32',
  },
  ribbonFlapRight: {
    width: 0, height: 0,
    borderTopWidth: 22, borderBottomWidth: 22, borderLeftWidth: 16,
    borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#2E7D32',
  },

  levelLabel: { fontSize: 17, ...LEVEL_FONT, color: '#7A5A38', letterSpacing: 1, marginTop: 20 },

  mascotBurstWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  mascotBurstChar: { fontSize: 64 },

  scoreLabel2: { fontSize: 13, fontWeight: '700', color: '#7A5A38', letterSpacing: 1 },
  scoreValue2: { fontSize: 32, fontWeight: '900', color: '#7A5A38' },

  pillReplay: {
    backgroundColor: '#5B8DEF', borderWidth: 2, borderColor: '#2E4E93',
    borderRadius: 24, paddingVertical: 13, paddingHorizontal: 20,
  },
  pillNext: {
    backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#2E7D32',
    borderRadius: 24, paddingVertical: 13, paddingHorizontal: 20,
  },
  pillBtnTxt: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  allDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  allDoneTxt: { fontSize: 13, fontWeight: '700', color: '#7A5A38', textAlign: 'center' },
});

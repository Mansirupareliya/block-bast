import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Rect, Line, Ellipse, Defs, RadialGradient as SvgRadialGradient, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { playTap, playClick, playSuccess, playLocked } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber } from '../utils/storage';
import { BOXPUSHER_LEVELS } from '../utils/boxPusherLevels';

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
        colors={disabled ? ['#9AA0A8', '#767C84', '#565B62'] : ['#FFE27A', '#FFC93C', '#E8790E']}
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: borderW, borderColor: disabled ? '#4A4F56' : '#C1461B',
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

// ── Space backdrop: starfield + drifting planets (Levels screen) ─────────
function Twinkle({ x, y, size, duration, delay }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
  return (
    <Animated.View style={{
      position: 'absolute', top: y, left: x, width: size, height: size,
      borderRadius: size / 2, backgroundColor: '#FFFFFF', opacity,
    }} />
  );
}

const STAR_DOTS = Array.from({ length: 26 }, (_, i) => ({
  x: `${(i * 37) % 100}%`,
  y: `${(i * 53) % 100}%`,
  size: 1.5 + (i % 3),
  duration: 1200 + (i % 5) * 300,
  delay: (i % 7) * 200,
}));

function Planet({ style, colors, ringColor }) {
  return (
    <View style={style}>
      <LinearGradient colors={colors} start={{ x: 0.25, y: 0.2 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      {ringColor && (
        <View style={{
          position: 'absolute', top: '35%', left: -10, right: -10, height: '18%',
          borderTopWidth: 3, borderColor: ringColor, opacity: 0.6, transform: [{ rotate: '-12deg' }],
        }} />
      )}
      <View style={{
        position: 'absolute', top: '55%', left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.28)', borderBottomLeftRadius: 999, borderBottomRightRadius: 999,
      }} />
    </View>
  );
}

function SpaceBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STAR_DOTS.map((d, i) => <Twinkle key={i} {...d} />)}
      <Planet
        style={{ position: 'absolute', top: -30, left: -40, width: 120, height: 120, borderRadius: 60, overflow: 'hidden' }}
        colors={['#8FD98F', '#3E8F4E']}
      />
      <Planet
        style={{ position: 'absolute', top: SH * 0.32, right: -50, width: 140, height: 140, borderRadius: 70, overflow: 'hidden' }}
        colors={['#FFB27A', '#C4622E']}
        ringColor="rgba(255,255,255,0.5)"
      />
      <Planet
        style={{ position: 'absolute', bottom: -50, left: -30, width: 130, height: 130, borderRadius: 65, overflow: 'hidden' }}
        colors={['#9CC9FF', '#3D5FA0']}
      />
    </View>
  );
}

// ── Warehouse backdrop (game screen) ──────────────────────────────────────
// A stylized "crate warehouse floor" scene behind the puzzle board — a
// perspective tiled floor converging toward a horizon, a warm spotlight
// pooling over the play area, hanging lamps, and a couple of stacked
// crates in the corners for depth. Built entirely from SVG shapes/
// gradients (react-native-svg, already a project dependency) — a distinct
// "industrial" palette from the Start/Levels screens' navy/space look.
function CrateStack({ x, y, scale = 1 }) {
  const w = 46 * scale, h = 34 * scale;
  return (
    <>
      <Ellipse cx={x + w / 2} cy={y + h + 6 * scale} rx={w * 0.55} ry={7 * scale} fill="rgba(0,0,0,0.35)" />
      <Rect x={x} y={y} width={w} height={h} rx={4} fill="url(#crateFace)" stroke="#5A3A16" strokeWidth={2} />
      <Line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#5A3A16" strokeWidth={1.5} opacity={0.5} />
      <Line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#5A3A16" strokeWidth={1.5} opacity={0.5} />
      <Rect x={x} y={y - h * 0.82} width={w * 0.78} height={h * 0.78} rx={4} fill="url(#crateFace)" stroke="#5A3A16" strokeWidth={2} />
    </>
  );
}

function HangingLamp({ x }) {
  return (
    <>
      <Line x1={x} y1={0} x2={x} y2={26} stroke="rgba(0,0,0,0.4)" strokeWidth={3} />
      <Ellipse cx={x} cy={26} rx={16} ry={10} fill="#3A2E22" />
      <Ellipse cx={x} cy={70} rx={70} ry={90} fill="url(#lampGlow)" />
    </>
  );
}

function WarehouseBackdrop({ width, height }) {
  const floorTop = height * 0.42;
  const tileRows = 7;
  return (
    // width/height as "100%" (not fixed pixel props) so this actually
    // stretches to fill whatever its container really measures — a fixed
    // pixel size left a gap on devices where the true drawable area is
    // taller than Dimensions.get('window') reports (common with Android's
    // edge-to-edge display), showing blank space beneath it. viewBox keeps
    // all the floor/lamp/crate math below working in width×height
    // coordinates regardless of the actual rendered size.
    <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A2C22" />
          <Stop offset="1" stopColor="#241A13" />
        </SvgLinearGradient>
        <SvgLinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8A5A2E" />
          <Stop offset="1" stopColor="#4A2E15" />
        </SvgLinearGradient>
        <SvgLinearGradient id="crateFace" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C68642" />
          <Stop offset="1" stopColor="#8A5A2E" />
        </SvgLinearGradient>
        <SvgRadialGradient id="spotlight" cx="50%" cy="38%" r="55%">
          <Stop offset="0" stopColor="#FFE9A6" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFE9A6" stopOpacity={0} />
        </SvgRadialGradient>
        <SvgRadialGradient id="lampGlow" cx="50%" cy="0%" r="80%">
          <Stop offset="0" stopColor="#FFE9A6" stopOpacity={0.3} />
          <Stop offset="1" stopColor="#FFE9A6" stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>

      {/* Back wall */}
      <Rect x={0} y={0} width={width} height={floorTop} fill="url(#wall)" />
      {/* Floor */}
      <Rect x={0} y={floorTop} width={width} height={height - floorTop} fill="url(#floor)" />

      {/* Perspective floor tiles — lines converging toward a horizon point
          at the wall/floor seam, giving the flat floor a sense of depth. */}
      {Array.from({ length: tileRows }).map((_, i) => {
        const t = i / tileRows;
        const y = floorTop + (height - floorTop) * (t * t);
        return <Line key={'h' + i} x1={0} y1={y} x2={width} y2={y} stroke="rgba(0,0,0,0.18)" strokeWidth={2} />;
      })}
      {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((m, i) => (
        <Line
          key={'v' + i}
          x1={width / 2 + m * width * 0.06} y1={floorTop}
          x2={width / 2 + m * width * 0.9} y2={height}
          stroke="rgba(0,0,0,0.18)" strokeWidth={2}
        />
      ))}

      {/* Warm overhead spotlight pooling over the play area */}
      <Rect x={0} y={0} width={width} height={height} fill="url(#spotlight)" />

      {/* Hanging warehouse lamps */}
      <HangingLamp x={width * 0.22} />
      <HangingLamp x={width * 0.78} />

      {/* Crate stacks tucked in the corners for depth */}
      <CrateStack x={-6} y={floorTop - 18} scale={1.1} />
      <CrateStack x={width - 52} y={floorTop - 14} scale={1} />
    </Svg>
  );
}

// ── Level tile with a mount-in fade/scale animation ──────────────────────
// Glossy square tile — number + 3-star rating for done/current, a plain
// locked tile with just the lock icon otherwise. Stars are only filled for
// levels actually solved; the "current" (next-to-play) tile shows empty
// stars plus a gold glow ring, matching the reference's highlighted tile.
function LevelTile({ num, state, onPress }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, friction: 6, tension: 90, delay: Math.min(num * 12, 260),
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const opacity = anim;
  const starsFilled = state === 'done';

  return (
    <Animated.View style={{ opacity, transform: [{ scale }], margin: 7 }}>
      <TouchableOpacity
        disabled={state === 'locked'}
        onPress={onPress}
        activeOpacity={state === 'locked' ? 1 : 0.8}
      >
        {state === 'current' && <GlowPulse size={78} color={GOLD} />}
        {state === 'locked' ? (
          <View style={s.spaceTileLocked}>
            <LockIcon size={20} color="rgba(255,255,255,0.4)" holeColor="#1B2338" />
          </View>
        ) : (
          <LinearGradient
            colors={state === 'current' ? ['#FFE9A6', '#FFD23F', '#C79A1E'] : ['#AFCFFF', '#5B8DEF', '#2E4E93']}
            style={s.spaceTile}
          >
            <View style={s.spaceTileShine} />
            <Text style={[s.spaceTileNum, state === 'current' && { color: '#3A2900' }]}>{num}</Text>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[0, 1, 2].map((i) => <Star key={i} size={11} filled={starsFilled} />)}
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
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
    if (walls.has(nk)) return;

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
    const progressPct = Math.min(1, (maxUnlockedLevel - 1) / BOXPUSHER_LEVELS.length);
    return (
      <LinearGradient colors={BG_GRADIENT} style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <FloatingBackground />
        <View style={s.header}>
          <GlassButton onPress={() => { playTap(); onBack(); }}>
            <Text style={s.backArrow}>‹</Text>
          </GlassButton>
        </View>
        <View style={s.startContent}>
          <View style={s.logoWrap}>
            <LinearGradient colors={['#6FA0FF', ACCENT, '#2E4E93']} style={s.logoBadge}>
              <View style={s.logoShine} />
              <BubbleText size={26}>BOX</BubbleText>
              <BubbleText size={26}>PUSHER</BubbleText>
            </LinearGradient>
            <View style={[s.mascotWrap, { marginTop: -46 }]}>
              <GlowPulse size={120} color={ACCENT} />
              <Text style={s.mascot}>🐼</Text>
            </View>
          </View>
          <View style={s.descCard}>
            <Text style={s.desc}>Push every crate onto its glowing target to clear the warehouse!</Text>
          </View>

          <View style={s.progressWrap}>
            <Text style={s.progressStar}>⭐</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct * 100}%` }]} />
            </View>
            <Text style={s.progressTxt}>{maxUnlockedLevel - 1}/{BOXPUSHER_LEVELS.length}</Text>
          </View>

          <TouchableOpacity style={s.playBtnWrap} activeOpacity={0.85} onPress={() => { playTap(); setView('levels'); }}>
            <GlowPulse size={90} color={GOLD} style={{ top: -5 }} />
            <LinearGradient colors={['#6FA0FF', ACCENT, '#3D66C4']} style={s.playBtn}>
              <Text style={s.playText}>Play</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── Render Levels Screen ────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <LinearGradient colors={['#171B3A', '#0E1130', '#070818']} style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <SpaceBackdrop />
        <View style={s.header}>
          <GlassButton onPress={() => { playTap(); setView('start'); }}>
            <Text style={s.backArrow}>‹</Text>
          </GlassButton>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
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
      </LinearGradient>
    );
  }

  // ── Render Game Screen ──────────────────────────────────────────────────
  const PAD = 20;
  const availW = SW - PAD * 2;
  const availH = SH - 380; // header + stats + dpad chrome
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
    <View style={[s.root, { backgroundColor: '#241A13' }]}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <WarehouseBackdrop width={SW} height={SH} />

      <View style={s.gameTopBar}>
        <CartoonButton size={46} onPress={() => { playTap(); setView('levels'); }}>
          <Text style={s.cartoonIcon}>‹</Text>
        </CartoonButton>
        <Text style={s.gameTitle}>Level {levelIdx + 1}</Text>
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

      {/* ── D-Pad (glossy cartoon bubble buttons) ── */}
      <View style={s.dpadWrap} pointerEvents={complete ? 'none' : 'auto'}>
        <CartoonButton size={62} onPress={() => tryMove('up')}>
          <Text style={s.cartoonArrow}>▲</Text>
        </CartoonButton>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CartoonButton size={62} onPress={() => tryMove('left')}>
            <Text style={s.cartoonArrow}>◀</Text>
          </CartoonButton>
          <CartoonButton size={62} onPress={undo}>
            <Text style={s.cartoonUndo}>↩</Text>
          </CartoonButton>
          <CartoonButton size={62} onPress={() => tryMove('right')}>
            <Text style={s.cartoonArrow}>▶</Text>
          </CartoonButton>
        </View>
        <CartoonButton size={62} onPress={() => tryMove('down')}>
          <Text style={s.cartoonArrow}>▼</Text>
        </CartoonButton>
      </View>

      {/* Reserved (invisible) space for a banner ad below the controls —
          drop a real ad component (AdMob or similar, needs its own
          account/SDK setup) in place of this View when ready. */}
      <View style={s.adSlot} />

      {complete && (
        <View style={[StyleSheet.absoluteFill, s.overlay, { elevation: 999 }]}>
          <LinearGradient colors={['#3A5A3E', '#1D2E1F', '#0F1710']} style={StyleSheet.absoluteFill} />

          <View style={s.completeTopBar}>
            <CartoonButton size={40} onPress={() => { playTap(); setView('levels'); }}>
              <Text style={[s.cartoonIcon, { fontSize: 18 }]}>‹</Text>
            </CartoonButton>
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

  // Levels screen
  spaceTile: {
    width: 68, height: 68, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 5,
  },
  spaceTileShine: {
    position: 'absolute', top: -10, left: -10, right: -10, height: '55%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
    transform: [{ rotate: '-4deg' }],
  },
  spaceTileNum: {
    fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  spaceTileLocked: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Game screen chrome
  gameTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 6,
  },
  gameTitle: { fontSize: 18, fontWeight: '800', color: TEXT },
  cartoonIcon: { fontSize: 22, color: '#8B2E12', fontWeight: '900', marginTop: -2 },

  statsBar: {
    flexDirection: 'row', backgroundColor: GLASS,
    marginHorizontal: 20, marginTop: 6, marginBottom: 14,
    borderRadius: 16, paddingVertical: 10,
    justifyContent: 'space-around', alignItems: 'center',
    borderWidth: 1, borderColor: GLASS_BORDER,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: TEXT_DIM, letterSpacing: 0.5 },
  statValue: { fontSize: 17, fontWeight: '800', color: TEXT },
  statDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Board
  boardWrap: { alignItems: 'center', justifyContent: 'center', flexGrow: 0 },
  board: {
    backgroundColor: '#1B2338',
    borderRadius: 12,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  cell: { alignItems: 'center', justifyContent: 'center' },
  wallCell: { backgroundColor: '#141A2B', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.3)' },
  floorCell: { backgroundColor: '#3A4568', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  targetRing: {
    width: '46%', height: '46%', borderRadius: 999,
    borderWidth: 2.5, borderColor: GOLD,
    shadowColor: GOLD, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  crateWrap: {
    width: '82%', height: '82%', borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  crateOnTarget: {
    backgroundColor: 'rgba(255,210,63,0.22)',
    borderColor: GOLD,
  },

  // D-Pad (glossy cartoon bubble buttons — see CartoonButton)
  dpadWrap: { alignItems: 'center', marginTop: 'auto', marginBottom: 14, gap: 10 },
  adSlot: { height: 60, marginBottom: 16 },
  cartoonArrow: { fontSize: 24, color: '#8B2E12', fontWeight: '900' },
  cartoonUndo: { fontSize: 22, color: '#8B2E12', fontWeight: '900' },

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

  levelLabel: { fontSize: 15, fontWeight: '800', color: '#7A5A38', letterSpacing: 1, marginTop: 20 },

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

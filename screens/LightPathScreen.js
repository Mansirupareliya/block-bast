import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Animated, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Polygon, Rect, Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { playTap, playClick, playWin, playLocked, playMatch, playMismatch } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber, loadJSON, saveJSON } from '../utils/storage';
import { notifyLevelReached } from '../utils/notifications';
import { maybeAskForRating } from '../utils/rating';
import {
  LEVEL_COUNT, BEAM_COLORS, getLevel, traceBeams, countTargets,
  cloneGrid, starsFor, tipForLevel, DR as DROW, DC as DCOL,
} from '../utils/lightPath';
import { showInterstitial } from '../utils/interstitialAd';
import BackButton from '../components/BackButton';
import LightPathLevelMap from '../components/LightPathLevelMap';
import LevelCompletePopup from '../components/LevelCompletePopup';
import { LEVEL_FONT } from '../utils/fonts';
import { useBackHandler } from '../utils/useBackHandler';

const { width: SW, height: SH } = Dimensions.get('window');
const HIT = { top: 20, bottom: 20, left: 20, right: 20 };

// ── Theme: dark navy with neon-blue light tubes ───────────────────────────
const BG_GRADIENT = ['#222B3F', '#161C2B', '#0C1019'];
const BOARD_BG = '#1A2030';
const CYAN = '#4FD4FF';
const MAGENTA = '#FF5FA8';
const GOLD = '#FFD23F';
const TEXT = '#FFFFFF';
const TEXT_DIM = 'rgba(220,230,245,0.65)';
const PANEL = 'rgba(255,255,255,0.05)';
const PANEL_BORDER = 'rgba(110,150,195,0.4)';

// ── Small shared pieces ───────────────────────────────────────────────────
function usePulse(duration = 1100) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}

function starPoints(size) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2, innerR = size * 0.21;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(' ');
}

function Star({ size = 12, filled }) {
  return (
    <Svg width={size} height={size}>
      <Polygon
        points={starPoints(size)}
        fill={filled ? GOLD : 'rgba(255,255,255,0.14)'}
        stroke={filled ? '#C79A1E' : 'rgba(255,255,255,0.3)'}
        strokeWidth={1}
      />
    </Svg>
  );
}

function NeonButton({ label, color = CYAN, onPress, style, small }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={HIT} style={style}>
      <View style={[
        s.neonBtn,
        small && s.neonBtnSmall,
        { borderColor: color, shadowColor: color },
      ]}>
        <Text style={[s.neonBtnTxt, small && { fontSize: 14 }, { color }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Board pieces ──────────────────────────────────────────────────────────
// The board is drawn as a grid of outlined rounded tiles on dark navy. The
// laser is a thick glowing neon tube that bends in smooth quarter-circles
// at each mirror. Emitters and crystals are glowing bulbs on green tiles,
// and walls are frosted grey tiles.
const TILE_LINE = 'rgba(110,150,195,0.42)';
const GREEN_FILL = 'rgba(38,150,112,0.38)';
const GREEN_LINE = '#3FD8A0';
const inset = (cs) => Math.max(2, cs * 0.045);

function TileOutline({ cs, fill = 'transparent', line = TILE_LINE, dots, style }) {
  const g = inset(cs);
  return (
    <View pointerEvents="none" style={[{
      position: 'absolute', left: g, top: g, right: g, bottom: g,
      borderRadius: cs * 0.13, borderWidth: 1.5, borderColor: line, backgroundColor: fill,
    }, style]}>
      {dots && <CornerDots cs={cs} color={dots} />}
    </View>
  );
}

function CornerDots({ cs, color }) {
  const d = Math.max(3, cs * 0.065);
  const o = cs * 0.07;
  return [
    { left: o, top: o }, { right: o, top: o }, { left: o, bottom: o }, { right: o, bottom: o },
  ].map((p, i) => (
    <View key={i} style={{ position: 'absolute', ...p, width: d, height: d, borderRadius: d, backgroundColor: color }} />
  ));
}

// Mirrors/splitters are drawn as '/' and rotated 90° for '\'. The rotation
// always spins forward a quarter turn per tap, so it reads as "turning".
function RotatingPiece({ o, size, children }) {
  const turns = useRef(o === '/' ? 0 : 1);
  const anim = useRef(new Animated.Value(turns.current)).current;
  const lastO = useRef(o);
  useEffect(() => {
    if (o === lastO.current) return;
    lastO.current = o;
    turns.current += 1;
    Animated.spring(anim, { toValue: turns.current, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [o, anim]);
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'], extrapolate: 'extend' });
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      {children}
    </Animated.View>
  );
}

function MirrorBar({ size, fixed, splitter }) {
  const a = size * 0.24, b = size * 0.76;
  if (splitter) {
    return (
      <Svg width={size} height={size}>
        <Line x1={a} y1={b} x2={b} y2={a} stroke="rgba(79,212,255,0.25)" strokeWidth={size * 0.16} strokeLinecap="round" />
        <Line x1={a} y1={b} x2={b} y2={a} stroke="#9BE8FF" strokeWidth={size * 0.05}
          strokeDasharray={`${size * 0.07},${size * 0.05}`} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size}>
      <Line x1={a} y1={b} x2={b} y2={a} stroke={fixed ? '#7D8799' : '#D6ECFF'} strokeWidth={size * 0.075} strokeLinecap="round" />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.045} fill={fixed ? '#5A6272' : '#7FB8E6'} />
    </Svg>
  );
}

// A glowing bulb with its screw cap facing `capDir` (where the tube joins).
function Bulb({ cs, color, lit, capDir, pulse, id }) {
  const c = BEAM_COLORS[color];
  const m = cs / 2;
  const br = cs * 0.2;
  const by = m + cs * 0.05; // bulb sits a touch away from its cap
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const deg = capDir * 90; // art is drawn with the cap pointing up (dir 0)
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${deg}deg` }] }]}>
      {lit && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
          <Svg width={cs} height={cs}>
            <Defs>
              <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={c} stopOpacity="0.85" />
                <Stop offset="1" stopColor={c} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={m} cy={by} r={cs * 0.42} fill={`url(#glow${id})`} />
          </Svg>
        </Animated.View>
      )}
      <Svg width={cs} height={cs} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`bulb${id}`} cx="45%" cy="40%" r="60%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.45" stopColor="#E6FAFF" stopOpacity="1" />
            <Stop offset="1" stopColor={c} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        {/* screw cap + neck */}
        <Rect x={m - cs * 0.075} y={by - br - cs * 0.1} width={cs * 0.15} height={cs * 0.11} rx={cs * 0.025}
          fill={lit ? '#CFF4FF' : 'rgba(170,190,215,0.55)'} />
        <Line x1={m - cs * 0.075} y1={by - br - cs * 0.055} x2={m + cs * 0.075} y2={by - br - cs * 0.055}
          stroke={lit ? c : 'rgba(30,40,60,0.6)'} strokeWidth={1.2} />
        <Circle cx={m} cy={by} r={br}
          fill={lit ? `url(#bulb${id})` : 'rgba(140,165,200,0.16)'}
          stroke={lit ? '#FFFFFF' : c} strokeOpacity={lit ? 0.6 : 0.75} strokeWidth={lit ? 1 : 1.6} />
      </Svg>
    </View>
  );
}

// One board cell: its tile and (for mirrors) the tappable rotating bar.
// Bulbs are drawn in a separate layer above the tube (see BulbLayer).
function Cell({ cell, size, lit, active, isMineHit, isHint, pulse, onPress }) {
  let content = <TileOutline cs={size} />;
  if (cell) {
    switch (cell.type) {
      case 'mirror':
        content = (
          <>
            <TileOutline
              cs={size}
              fill={cell.fixed ? 'rgba(150,160,180,0.10)' : active ? 'rgba(79,212,255,0.22)' : 'rgba(79,212,255,0.06)'}
              line={cell.fixed ? 'rgba(160,170,190,0.45)' : active ? CYAN : 'rgba(120,190,240,0.7)'}
              dots={cell.fixed ? 'rgba(200,205,215,0.7)' : null}
            />
            <View style={StyleSheet.absoluteFill}>
              <RotatingPiece o={cell.o} size={size}><MirrorBar size={size} fixed={cell.fixed} /></RotatingPiece>
            </View>
          </>
        );
        break;
      case 'splitter':
        content = (
          <>
            <TileOutline cs={size} fill={active ? 'rgba(79,212,255,0.22)' : 'rgba(79,212,255,0.08)'} line={active ? CYAN : 'rgba(155,232,255,0.75)'} />
            <View style={StyleSheet.absoluteFill}>
              <RotatingPiece o={cell.o} size={size}><MirrorBar size={size} splitter /></RotatingPiece>
            </View>
          </>
        );
        break;
      case 'source':
        content = <TileOutline cs={size} fill={GREEN_FILL} line={GREEN_LINE} dots={GREEN_LINE} />;
        break;
      case 'target':
        content = lit
          ? <TileOutline cs={size} fill={GREEN_FILL} line={GREEN_LINE} dots={GREEN_LINE} />
          : <TileOutline cs={size} fill="rgba(70,90,125,0.25)" line="rgba(130,160,200,0.6)" dots="rgba(130,160,200,0.6)" />;
        break;
      case 'wall':
        content = <TileOutline cs={size} fill="rgba(195,200,212,0.30)" line="rgba(220,225,235,0.5)" dots="rgba(230,234,242,0.75)" />;
        break;
      case 'mine':
        content = (
          <>
            <TileOutline cs={size} fill={isMineHit ? 'rgba(255,70,70,0.45)' : 'rgba(255,90,90,0.08)'} line="rgba(255,110,110,0.6)" />
            <Text style={{ fontSize: size * 0.5 }}>💣</Text>
          </>
        );
        break;
      default:
        break;
    }
  }
  return (
    <Pressable onPress={onPress} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {content}
      {isHint && <HintRing size={size} pulse={pulse} />}
    </Pressable>
  );
}

function HintRing({ size, pulse }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.04] });
  const g = inset(size);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: g, top: g, right: g, bottom: g, borderRadius: size * 0.13,
      borderWidth: 3, borderColor: GOLD, transform: [{ scale }],
    }} />
  );
}

// The neon tube. Each visited cell contributes one piece: a straight run
// edge-to-edge, a quarter-circle bend between two adjacent edges (cubic
// Bézier with the circle constant 0.552), or a half run to/from the centre
// for the emitter and crystals. One <Path> per colour, stroked three times:
// soft wide glow, solid body, bright core.
function tubePaths(visits, cs) {
  const K = 0.552;
  const byColor = {};
  for (const v of visits) {
    const cx = (v.c + 0.5) * cs, cy = (v.r + 0.5) * cs;
    const edge = (side) => [cx + DCOL[side] * cs / 2, cy + DROW[side] * cs / 2];
    let d;
    if (v.inSide == null && v.outSide == null) continue;
    if (v.inSide == null) {
      const [x, y] = edge(v.outSide);
      d = `M${cx},${cy}L${x},${y}`;
    } else if (v.outSide == null) {
      const [x, y] = edge(v.inSide);
      d = `M${x},${y}L${cx},${cy}`;
    } else {
      const [x1, y1] = edge(v.inSide);
      const [x2, y2] = edge(v.outSide);
      if ((v.inSide + 2) % 4 === v.outSide) {
        d = `M${x1},${y1}L${x2},${y2}`;
      } else {
        const p1 = [x1 + K * (cx - x1), y1 + K * (cy - y1)];
        const p2 = [x2 + K * (cx - x2), y2 + K * (cy - y2)];
        d = `M${x1},${y1}C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${x2},${y2}`;
      }
    }
    byColor[v.color] = (byColor[v.color] || '') + d;
  }
  return byColor;
}

// `snapIn` flashes the tube on when it first appears (the laser switching
// on after the player's first tap).
function TubeLayer({ visits, cs, boardPx, pulse, snapIn }) {
  const paths = useMemo(() => tubePaths(visits, cs), [visits, cs]);
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
  const snap = useRef(new Animated.Value(snapIn ? 0 : 1)).current;
  useEffect(() => {
    if (!snapIn) return;
    Animated.sequence([
      Animated.timing(snap, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 0.35, duration: 70, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [snapIn, snap]);
  const entries = Object.entries(paths);
  const stroke = (w, color, opacity, key) => entries.map(([name, d]) => (
    <Path key={key + name} d={d} fill="none" stroke={color || BEAM_COLORS[name]} strokeOpacity={opacity}
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  ));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: snap }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <Svg width={boardPx} height={boardPx}>
          {stroke(cs * 0.66, null, 0.1, 'g1')}
          {stroke(cs * 0.46, null, 0.22, 'g2')}
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={boardPx} height={boardPx}>
          {stroke(cs * 0.27, null, 1, 'b')}
          {stroke(cs * 0.1, '#E9FBFF', 0.55, 'h')}
        </Svg>
      </View>
    </Animated.View>
  );
}

// What's drawn before the laser is switched on: no beam, nothing lit.
const NO_BEAM = { visits: [], lit: new Set(), mineHit: null };

function BulbLayer({ grid, cs, lit, capDirs, pulse }) {
  const out = [];
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell || (cell.type !== 'source' && cell.type !== 'target')) return;
    const isSource = cell.type === 'source';
    out.push(
      <View key={`${r},${c}`} pointerEvents="none"
        style={{ position: 'absolute', left: c * cs, top: r * cs, width: cs, height: cs }}>
        <Bulb
          cs={cs}
          id={`${r}_${c}`}
          color={cell.color}
          lit={isSource || lit.has(`${r},${c}`)}
          capDir={isSource ? cell.dir : (capDirs[`${r},${c}`] ?? 0)}
          pulse={pulse}
        />
      </View>
    );
  }));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{out}</View>;
}

// ── Start screen decoration: a tiny solved board in the game's own style ──
const DEMO_GRID = (() => {
  const g = Array.from({ length: 4 }, () => Array(4).fill(null));
  g[3][0] = { type: 'source', dir: 0, color: 'blue' };
  g[0][0] = { type: 'mirror', o: '/', fixed: false };
  g[0][2] = { type: 'mirror', o: '\\', fixed: false };
  g[2][2] = { type: 'mirror', o: '\\', fixed: false };
  g[2][3] = { type: 'target', color: 'blue' };
  g[3][3] = { type: 'wall' };
  return g;
})();
const DEMO_TRACE = traceBeams(DEMO_GRID);
const DEMO_CAPS = { '2,3': 3 };

function TitleArt({ pulse }) {
  const cs = Math.floor(Math.min(SW - 80, 260) / 4);
  const px = cs * 4;
  return (
    <View style={[s.board, { padding: 6 }]}>
      <View style={{ width: px, height: px }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {DEMO_GRID.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map((cell, c) => (
                <Cell key={c} cell={cell} size={cs} lit={DEMO_TRACE.lit.has(`${r},${c}`)} pulse={pulse} />
              ))}
            </View>
          ))}
        </View>
        <TubeLayer visits={DEMO_TRACE.visits} cs={cs} boardPx={px} pulse={pulse} />
        <BulbLayer grid={DEMO_GRID} cs={cs} lit={DEMO_TRACE.lit} capDirs={DEMO_CAPS} pulse={pulse} />
      </View>
    </View>
  );
}

let globalUnlockedLevel = 1;

// Turns one mirror/splitter a quarter turn ('/' <-> '\').
function flip(g, r, c) {
  const next = g.map((row) => row.slice());
  next[r][c] = { ...g[r][c], o: g[r][c].o === '/' ? '\\' : '/' };
  return next;
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function LightPathScreen({ onBack }) {
  const [view, setView] = useState('start'); // 'start' | 'levels' | 'game'
  useBackHandler(() => {
    if (view === 'game') setView('levels');
    else if (view === 'levels') setView('start');
    else onBack();
  });

  const [maxUnlocked, setMaxUnlocked] = useState(globalUnlockedLevel);
  const [bestStars, setBestStars] = useState({}); // { [levelNum]: 1..3 }

  const [levelNum, setLevelNum] = useState(1);
  const [level, setLevel] = useState(null); // { size, solution, par }
  const [grid, setGrid] = useState(null);
  const [boardKey, setBoardKey] = useState(0); // remounts pieces on (re)start
  const [taps, setTaps] = useState(0);
  const [history, setHistory] = useState([]); // [r, c, 'on' | 'turn'] of each tap, for undo
  // "r,c" of mirrors the player has switched on. Only these (and locked
  // mirrors) pass the laser; it stops dead at any other mirror.
  const [active, setActive] = useState(() => new Set());
  const [usedHint, setUsedHint] = useState(false);
  const [hintCell, setHintCell] = useState(null);
  const [beamOn, setBeamOn] = useState(false);
  const [complete, setComplete] = useState(false);

  const pulse = usePulse();
  const prevLit = useRef(0);
  const prevMine = useRef(null);

  useEffect(() => {
    loadNumber(STORAGE_KEYS.LIGHTPATH_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlockedLevel) {
        globalUnlockedLevel = saved;
        setMaxUnlocked(saved);
      }
    });
    loadJSON(STORAGE_KEYS.LIGHTPATH_STARS, {}).then((saved) => setBestStars(saved || {}));
  }, []);

  const startLevel = useCallback((num) => {
    const lv = getLevel(num);
    if (!lv) return;
    setLevelNum(num);
    setLevel(lv);
    setGrid(cloneGrid(lv.grid));
    setBoardKey((k) => k + 1);
    setTaps(0);
    setHistory([]);
    setActive(new Set());
    setUsedHint(false);
    setHintCell(null);
    setComplete(false);
    setBeamOn(false);
    prevLit.current = 0;
    prevMine.current = null;
    setView('game');
  }, []);

  // The laser stays off (no beam drawn, nothing lit, can't be won) until
  // the player's first mirror tap, so the start of a level doesn't give the
  // path away.
  const fullTrace = useMemo(() => (grid ? traceBeams(grid, {
    isActive: (r, c, cell) => cell.fixed || active.has(`${r},${c}`),
    hideDeadEnds: true,
  }) : null), [grid, active]);
  const trace = fullTrace && !beamOn ? NO_BEAM : fullTrace;
  const totalTargets = useMemo(() => (grid ? countTargets(grid) : 0), [grid]);
  // Each crystal bulb's cap faces the side its beam arrives from in the
  // solved board, so the tube always plugs into the cap.
  const capDirs = useMemo(() => {
    const out = {};
    if (!level) return out;
    for (const v of traceBeams(level.solution).visits) {
      if (v.outSide == null && v.inSide != null) out[`${v.r},${v.c}`] = v.inSide;
    }
    return out;
  }, [level]);
  const solved = !!trace && !trace.mineHit && trace.lit.size === totalTargets && totalTargets > 0;

  // Feedback as the beams change: a chime for each newly lit crystal, a buzz
  // when a laser touches a bomb.
  useEffect(() => {
    if (!trace || complete) return;
    if (trace.mineHit && trace.mineHit !== prevMine.current) playMismatch();
    else if (trace.lit.size > prevLit.current && !solved) playMatch();
    prevLit.current = trace.lit.size;
    prevMine.current = trace.mineHit;
  }, [trace, solved, complete]);

  // Short pause on the finished board so the player sees every crystal glow
  // before the popup covers it.
  useEffect(() => {
    if (!solved || complete || view !== 'game') return;
    const t = setTimeout(() => {
      setComplete(true);
      playWin();
      const earned = starsFor(taps, level.par, usedHint);
      setBestStars((prev) => {
        if ((prev[levelNum] || 0) >= earned) return prev;
        const next = { ...prev, [levelNum]: earned };
        saveJSON(STORAGE_KEYS.LIGHTPATH_STARS, next);
        return next;
      });
      const nextUnlock = Math.min(LEVEL_COUNT, Math.max(globalUnlockedLevel, levelNum + 1));
      if (nextUnlock > globalUnlockedLevel) notifyLevelReached('lightpath', nextUnlock);
      maybeAskForRating('lightpath', Math.max(globalUnlockedLevel, nextUnlock) - 1);
      if (nextUnlock > globalUnlockedLevel || levelNum === LEVEL_COUNT) {
        globalUnlockedLevel = Math.max(globalUnlockedLevel, nextUnlock);
        setMaxUnlocked(globalUnlockedLevel);
        saveNumber(STORAGE_KEYS.LIGHTPATH_MAX_UNLOCKED, globalUnlockedLevel);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [solved, complete, view, taps, level, usedHint, levelNum]);

  const onCellPress = useCallback((r, c) => {
    if (complete || solved || !grid) return;
    const cell = grid[r][c];
    if (!cell || (cell.type !== 'mirror' && cell.type !== 'splitter')) return;
    if (cell.fixed) { playLocked(); return; }
    playClick();
    setBeamOn(true);
    // First tap switches the mirror on as it stands; later taps turn it.
    const key = `${r},${c}`;
    const kind = active.has(key) ? 'turn' : 'on';
    if (kind === 'on') setActive((a) => new Set(a).add(key));
    else setGrid((g) => flip(g, r, c));
    setTaps((t) => t + 1);
    setHistory((h) => [...h, [r, c, kind]]);
    if (hintCell && hintCell[0] === r && hintCell[1] === c) setHintCell(null);
  }, [complete, solved, grid, hintCell, active]);

  const undo = useCallback(() => {
    if (complete || solved || !history.length) return;
    playTap();
    const [r, c, kind] = history[history.length - 1];
    if (kind === 'on') {
      setActive((a) => { const next = new Set(a); next.delete(`${r},${c}`); return next; });
    } else {
      setGrid((g) => flip(g, r, c));
    }
    setTaps((t) => Math.max(0, t - 1));
    setHistory((h) => h.slice(0, -1));
  }, [complete, solved, history]);

  // Hint: fix one path mirror that's wrongly turned or not switched on yet,
  // and flash it. Caps the level at 2 stars.
  const hint = useCallback(() => {
    if (complete || solved || !grid || !level) return;
    const n = grid.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const want = level.solution[r][c];
        const have = grid[r][c];
        if (!want || !have || (want.type !== 'mirror' && want.type !== 'splitter') || have.fixed) continue;
        if (want.o !== have.o || !active.has(`${r},${c}`)) {
          playTap();
          setBeamOn(true);
          if (want.o !== have.o) setGrid((g) => flip(g, r, c));
          setActive((a) => new Set(a).add(`${r},${c}`));
          setUsedHint(true);
          setHintCell([r, c]);
          setHistory([]); // undoing past a hint would just re-break it
          return;
        }
      }
    }
  }, [complete, solved, grid, level, active]);

  const restart = useCallback(() => { playTap(); startLevel(levelNum); }, [levelNum, startLevel]);

  const solvedCount = Object.keys(bestStars).length;

  // ── Start ───────────────────────────────────────────────────────────────
  if (view === 'start') {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <BackButton onPress={() => { playTap(); onBack(); }} />
        </View>
        <View style={s.startContent}>
          <Text style={[s.title, { textShadowColor: MAGENTA }]}>LIGHT</Text>
          <Text style={[s.title, { color: CYAN, textShadowColor: CYAN, marginTop: -8 }]}>PATH</Text>
          <Text style={s.subtitle}>Turn the mirrors. Light every crystal.</Text>
          <View style={{ marginVertical: 28 }}><TitleArt pulse={pulse} /></View>
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(solvedCount / LEVEL_COUNT) * 100}%` }]} />
            </View>
            <Text style={s.progressTxt}>{solvedCount}/{LEVEL_COUNT}</Text>
          </View>
          <NeonButton label="PLAY" color={CYAN} onPress={() => { playTap(); setView('levels'); }} />
        </View>
      </View>
    );
  }

  // ── Levels ──────────────────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <LightPathLevelMap
          count={LEVEL_COUNT}
          maxUnlocked={maxUnlocked}
          bestStars={bestStars}
          onPressLevel={(num, state) => {
            if (state === 'locked') playLocked();
            else { playTap(); startLevel(num); }
          }}
          header={(
            <View style={[s.topBar, s.mapHeader]} pointerEvents="box-none">
              <BackButton onPress={() => { playTap(); setView('start'); }} />
              <View style={s.titlePill}><Text style={s.titlePillTxt}>Levels</Text></View>
              <View style={s.countPill}><Text style={s.countTxt}>{solvedCount}/{LEVEL_COUNT}</Text></View>
            </View>
          )}
        />
      </View>
    );
  }

  // ── Game ────────────────────────────────────────────────────────────────
  if (!grid || !level) return null;
  const n = grid.length;
  const cs = Math.floor(Math.min(64, (SW - 32) / n, (SH - 360) / n));
  const boardPx = cs * n;
  const tip = tipForLevel(levelNum) || (levelNum <= 3 ? tipForLevel(1) : null);
  const earned = starsFor(taps, level.par, usedHint);
  const isLast = levelNum >= LEVEL_COUNT;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />

      <View style={s.topBar}>
        <BackButton onPress={() => { playTap(); setView('levels'); }} />
        <View style={s.titlePill}><Text style={s.titlePillTxt}>Level {levelNum}</Text></View>
        <TouchableOpacity onPress={restart} hitSlop={HIT} style={s.roundBtn} activeOpacity={0.7}>
          <Text style={s.roundBtnTxt}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>TAPS</Text>
          <Text style={s.statValue}>{taps}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>PAR</Text>
          <Text style={s.statValue}>{level.par}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>CRYSTALS</Text>
          <Text style={s.statValue}>{trace.lit.size}/{totalTargets}</Text>
        </View>
      </View>

      <View style={s.tipWrap}>
        {trace.mineHit ? (
          <Text style={[s.tipTxt, { color: '#FF6B6B' }]}>💥 A laser is hitting a bomb!</Text>
        ) : tip ? (
          <Text style={s.tipTxt}>{tip}</Text>
        ) : !beamOn ? (
          <Text style={s.tipTxt}>👆 Tap any mirror to switch the laser on</Text>
        ) : null}
      </View>

      <View style={s.boardWrap}>
        <View style={[s.board, { width: boardPx + 12, height: boardPx + 12 }]}>
          <View style={{ width: boardPx, height: boardPx }}>
            {/* Tiles + tappable mirrors, then the light tube, then the bulbs on top.
                Tube and bulbs ignore touches so taps reach the tiles. */}
            <View key={boardKey} style={StyleSheet.absoluteFill}>
              {grid.map((row, r) => (
                <View key={r} style={{ flexDirection: 'row' }}>
                  {row.map((cell, c) => (
                    <Cell
                      key={c}
                      cell={cell}
                      size={cs}
                      lit={trace.lit.has(`${r},${c}`)}
                      active={active.has(`${r},${c}`)}
                      isMineHit={trace.mineHit === `${r},${c}`}
                      isHint={!!hintCell && hintCell[0] === r && hintCell[1] === c}
                      pulse={pulse}
                      onPress={() => onCellPress(r, c)}
                    />
                  ))}
                </View>
              ))}
            </View>
            {beamOn && (
              <TubeLayer key={`t${boardKey}`} snapIn visits={trace.visits} cs={cs} boardPx={boardPx} pulse={pulse} />
            )}
            <BulbLayer key={`b${boardKey}`} grid={grid} cs={cs} lit={trace.lit} capDirs={capDirs} pulse={pulse} />
          </View>
        </View>
      </View>

      <View style={s.controls}>
        <NeonButton small label="↶  UNDO" color={CYAN} onPress={undo} />
        <NeonButton small label="💡 HINT" color={GOLD} onPress={hint} />
      </View>

      {complete && (
        <LevelCompletePopup
          stars={earned}
          score={500 + earned * 250 + levelNum * 10}
          info={`Level ${levelNum} · ${taps} taps · par ${level.par}${usedHint ? ' · hint used' : ''}`}
          onNext={isLast ? null : () => { playTap(); startLevel(levelNum + 1); }}
          onReplay={restart}
          onHome={() => { playTap(); setView('levels'); showInterstitial(); }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06040F' },
  header: { paddingTop: 50, paddingHorizontal: 20 },

  // Start
  startContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 60 },
  title: {
    fontSize: 64, ...LEVEL_FONT, color: '#FFFFFF', letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  subtitle: { fontSize: 15, color: TEXT_DIM, fontWeight: '600', marginTop: 6 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, marginBottom: 28 },
  progressTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: CYAN },
  progressTxt: { fontSize: 13, ...LEVEL_FONT, color: TEXT_DIM, minWidth: 54, textAlign: 'right' },

  neonBtn: {
    paddingVertical: 14, paddingHorizontal: 54, borderRadius: 30, borderWidth: 2.5,
    backgroundColor: 'rgba(10,8,30,0.7)',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8,
  },
  neonBtnSmall: { paddingVertical: 11, paddingHorizontal: 22 },
  neonBtnTxt: { fontSize: 22, ...LEVEL_FONT, letterSpacing: 1.5 },

  // Top bar / pills
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
  },
  titlePill: {
    borderWidth: 2, borderColor: PANEL_BORDER, backgroundColor: PANEL,
    borderRadius: 18, paddingVertical: 5, paddingHorizontal: 20,
  },
  titlePillTxt: { fontSize: 20, ...LEVEL_FONT, color: TEXT },
  countPill: {
    minWidth: 60, alignItems: 'center', borderRadius: 14, paddingVertical: 4, paddingHorizontal: 8,
    backgroundColor: 'rgba(59,232,255,0.15)', borderWidth: 1.5, borderColor: CYAN,
  },
  countTxt: { fontSize: 13, ...LEVEL_FONT, color: CYAN },
  roundBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: MAGENTA, backgroundColor: 'rgba(255,79,216,0.12)',
  },
  roundBtnTxt: { fontSize: 24, color: MAGENTA, fontWeight: '900', marginTop: -2 },

  // Levels (road map header floats over the scenery)
  mapHeader: { position: 'absolute', top: 0, left: 0, right: 0 },

  // Game
  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginHorizontal: 20, marginTop: 4, paddingVertical: 9, borderRadius: 16,
    backgroundColor: PANEL, borderWidth: 1.5, borderColor: PANEL_BORDER,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: MAGENTA, fontWeight: '900', letterSpacing: 0.8 },
  statValue: { fontSize: 18, ...LEVEL_FONT, color: TEXT },
  statDivider: { width: 1.5, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' },
  tipWrap: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 24 },
  tipTxt: { color: TEXT_DIM, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  boardWrap: { alignItems: 'center' },
  board: {
    padding: 6, borderRadius: 18, backgroundColor: BOARD_BG,
    borderWidth: 1, borderColor: 'rgba(110,150,195,0.22)',
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 'auto', marginBottom: 16 },

});

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Dimensions, StatusBar, Animated, Pressable, Easing,
} from 'react-native';
import { Text } from '../components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Polygon, Rect, Circle, Path, Defs, RadialGradient, Stop, G, Ellipse } from 'react-native-svg';
import { playTap, playClick, playWin, playLocked, playMatch, playMismatch } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber, loadJSON, saveJSON } from '../utils/storage';
import { notifyLevelReached } from '../utils/notifications';
import { maybeAskForRating } from '../utils/rating';
import {
  LEVEL_COUNT, BEAM_COLORS, neonColorsFor, getLevel, traceBeams, countTargets,
  cloneGrid, starsFor, tipForLevel, DR as DROW, DC as DCOL,
} from '../utils/lightPath';
import BackButton from '../components/BackButton';
import LightPathLevelMap, { Planks } from '../components/LightPathLevelMap';
import LightPathLoading from '../components/LightPathLoading';
import LightPathComplete from '../components/LightPathComplete';
import { noteLevelComplete, runAfterLevelAd } from '../utils/interstitialAd';
import { LEVEL_FONT } from '../utils/fonts';
import { useBackHandler } from '../utils/useBackHandler';

const { width: SW, height: SH } = Dimensions.get('window');
const HIT = { top: 20, bottom: 20, left: 20, right: 20 };

// ── Theme: dark walnut board inside a wooden frame ────────────────────────
const BOARD_BG = '#2E1B0E';
const AMBER = '#FFC94A';
const GOLD = '#FFD23F';

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

// Chunky 3D button for the game screen: darker base under a glossy face.
function GameButton({ label, colors, base, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} hitSlop={HIT} disabled={disabled}>
      {({ pressed }) => (
        <View style={[s.gameBtnWrap, disabled && { opacity: 0.5 }]}>
          <View style={[s.gameBtnBase, { backgroundColor: base, top: pressed ? 2 : 5 }]} />
          <LinearGradient colors={colors} style={[s.gameBtnFace, { borderColor: base, transform: [{ translateY: pressed ? 3 : 0 }] }]}>
            <View style={s.gameBtnShine} />
            <Text style={[s.gameBtnTxt, { textShadowColor: base }]}>{label}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

// ── Board pieces ──────────────────────────────────────────────────────────
// The board is drawn as a grid of outlined rounded tiles on dark navy. The
// laser is a thick glowing neon tube that bends in smooth quarter-circles
// at each mirror. The emitter sits on a gold tile, lit crystals on green
// tiles, and walls are solid nailed wood blocks.
const TILE_LINE = 'rgba(240,200,150,0.28)';
const GOLD_FILL = 'rgba(255,190,60,0.28)';
const GREEN_FILL = 'rgba(110,190,70,0.35)';
const GREEN_LINE = '#9BE36A';
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
        <Line x1={a} y1={b} x2={b} y2={a} stroke="rgba(255,200,90,0.3)" strokeWidth={size * 0.16} strokeLinecap="round" />
        <Line x1={a} y1={b} x2={b} y2={a} stroke="#FFE3A8" strokeWidth={size * 0.05}
          strokeDasharray={`${size * 0.07},${size * 0.05}`} />
      </Svg>
    );
  }
  // Oval hand mirror (wooden frame, pale-blue glass, white shine streaks),
  // drawn upright around the centre and tilted 45° so its long side lies
  // along the '/' diagonal.
  const m = size / 2;
  const rx = size * 0.19, ry = size * 0.37;
  const fw = Math.max(2, size * 0.055); // frame thickness
  const gx = rx - fw, gy = ry - fw;
  return (
    <Svg width={size} height={size}>
      <G rotation={45} origin={`${m}, ${m}`}>
        <Ellipse cx={m + size * 0.025} cy={m + size * 0.03} rx={rx} ry={ry} fill="rgba(0,0,0,0.3)" />
        <Ellipse cx={m} cy={m} rx={rx} ry={ry}
          fill={fixed ? '#9C8670' : '#E9A04A'} stroke={fixed ? '#3E2F22' : '#5A3415'} strokeWidth={1.4} />
        <Ellipse cx={m} cy={m} rx={gx} ry={gy}
          fill={fixed ? '#B9C4C8' : '#DFF3FB'} stroke={fixed ? '#6E5A46' : '#B86E24'} strokeWidth={1} />
        <Line x1={m - gx * 0.55} y1={m + gy * 0.15} x2={m + gx * 0.45} y2={m - gy * 0.55}
          stroke="#FFFFFF" strokeOpacity={fixed ? 0.5 : 0.95} strokeWidth={gx * 0.36} strokeLinecap="round" />
        <Line x1={m - gx * 0.5} y1={m + gy * 0.55} x2={m + gx * 0.6} y2={m - gy * 0.1}
          stroke="#FFFFFF" strokeOpacity={fixed ? 0.4 : 0.8} strokeWidth={gx * 0.16} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

// A glowing bulb with its screw cap facing `capDir` (where the tube joins).
function Bulb({ cs, color, colors = BEAM_COLORS, lit, capDir, pulse, id }) {
  const c = colors[color];
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
            <Stop offset="0.45" stopColor="#FFF6E0" stopOpacity="1" />
            <Stop offset="1" stopColor={c} stopOpacity="1" />
          </RadialGradient>
        </Defs>
        {/* screw cap + neck */}
        <Rect x={m - cs * 0.075} y={by - br - cs * 0.1} width={cs * 0.15} height={cs * 0.11} rx={cs * 0.025}
          fill={lit ? '#FFF1D0' : 'rgba(220,195,160,0.6)'} />
        <Line x1={m - cs * 0.075} y1={by - br - cs * 0.055} x2={m + cs * 0.075} y2={by - br - cs * 0.055}
          stroke={lit ? c : 'rgba(60,35,15,0.6)'} strokeWidth={1.2} />
        <Circle cx={m} cy={by} r={br}
          fill={lit ? `url(#bulb${id})` : 'rgba(255,230,190,0.14)'}
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
              fill={cell.fixed ? 'rgba(20,10,3,0.28)' : active ? 'rgba(255,200,90,0.25)' : 'rgba(255,215,150,0.08)'}
              line={cell.fixed ? 'rgba(200,170,130,0.4)' : active ? AMBER : 'rgba(245,205,150,0.65)'}
              dots={cell.fixed ? 'rgba(220,190,150,0.7)' : null}
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
            <TileOutline cs={size} fill={active ? 'rgba(255,200,90,0.25)' : 'rgba(255,215,150,0.08)'} line={active ? AMBER : 'rgba(255,225,170,0.75)'} />
            <View style={StyleSheet.absoluteFill}>
              <RotatingPiece o={cell.o} size={size}><MirrorBar size={size} splitter /></RotatingPiece>
            </View>
          </>
        );
        break;
      case 'source':
        content = <TileOutline cs={size} fill={GOLD_FILL} line={AMBER} dots={AMBER} />;
        break;
      case 'target':
        content = lit
          ? <TileOutline cs={size} fill={GREEN_FILL} line={GREEN_LINE} dots={GREEN_LINE} />
          : <TileOutline cs={size} fill="rgba(20,10,3,0.3)" line="rgba(230,195,150,0.55)" dots="rgba(230,195,150,0.55)" />;
        break;
      case 'wall':
        content = <TileOutline cs={size} fill="#8A5A32" line="#2E1A0B" dots="#E0B878" />;
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

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Neon tube: three soft halos that breathe with `pulse`, a solid coloured
// body, a white-hot core, and small sparks of light flowing along the beam.
// `snapIn` flickers the tube on like a real neon sign when it first appears
// (the laser switching on after the player's first tap).
function TubeLayer({ visits, cs, boardPx, pulse, snapIn, colors = BEAM_COLORS }) {
  const paths = useMemo(() => tubePaths(visits, cs), [visits, cs]);
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const flow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(flow, {
      toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: false,
    }));
    loop.start();
    return () => loop.stop();
  }, [flow]);
  const dashOffset = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -cs] });
  const snap = useRef(new Animated.Value(snapIn ? 0 : 1)).current;
  useEffect(() => {
    if (!snapIn) return;
    Animated.sequence([
      Animated.timing(snap, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 0.2, duration: 60, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 0.9, duration: 60, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 0.45, duration: 50, useNativeDriver: true }),
      Animated.timing(snap, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  }, [snapIn, snap]);
  const entries = Object.entries(paths);
  const stroke = (w, color, opacity, key) => entries.map(([name, d]) => (
    <Path key={key + name} d={d} fill="none" stroke={color || colors[name]} strokeOpacity={opacity}
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
  ));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: snap }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <Svg width={boardPx} height={boardPx}>
          {stroke(cs * 0.95, null, 0.07, 'g1')}
          {stroke(cs * 0.66, null, 0.14, 'g2')}
          {stroke(cs * 0.42, null, 0.3, 'g3')}
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={boardPx} height={boardPx}>
          {stroke(cs * 0.24, null, 1, 'b')}
          {stroke(cs * 0.14, '#FFFFFF', 0.45, 'c1')}
          {stroke(cs * 0.07, '#FFFFFF', 0.95, 'c2')}
          {entries.map(([name, d]) => (
            <AnimatedPath key={`s${name}`} d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.9}
              strokeWidth={cs * 0.12} strokeLinecap="round"
              strokeDasharray={`${cs * 0.12},${cs * 0.88}`} strokeDashoffset={dashOffset} />
          ))}
        </Svg>
      </View>
    </Animated.View>
  );
}

// What's drawn before the laser is switched on: no beam, nothing lit.
const NO_BEAM = { visits: [], lit: new Set(), mineHit: null };

function BulbLayer({ grid, cs, lit, capDirs, pulse, colors }) {
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
          colors={colors}
          lit={isSource || lit.has(`${r},${c}`)}
          capDir={isSource ? cell.dir : (capDirs[`${r},${c}`] ?? 0)}
          pulse={pulse}
        />
      </View>
    );
  }));
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{out}</View>;
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
  const [view, setView] = useState('loading'); // 'loading' | 'levels' | 'game'
  useBackHandler(() => {
    if (view === 'game') setView('levels');
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
    runAfterLevelAd(() => {
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
    });
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
  // Each level glows in its own neon colour.
  const neon = useMemo(() => neonColorsFor(levelNum), [levelNum]);
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
      noteLevelComplete();
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
  const onLoaded = useCallback(() => setView('levels'), []);

  // ── Loading splash ──────────────────────────────────────────────────────
  if (view === 'loading') return <LightPathLoading onDone={onLoaded} />;

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
              <BackButton onPress={() => { playTap(); onBack(); }} />
              <View style={s.woodPill}><Text style={s.woodPillTxt}>Levels</Text></View>
              <View style={s.woodCount}><Text style={s.woodCountTxt}>★ {solvedCount}/{LEVEL_COUNT}</Text></View>
            </View>
          )}
        />
      </View>
    );
  }

  // ── Game ────────────────────────────────────────────────────────────────
  if (!grid || !level) return null;
  const n = grid.length;
  const cs = Math.floor(Math.min(64, (SW - 64) / n, (SH - 400) / n));
  const boardPx = cs * n;
  const tip = tipForLevel(levelNum) || (levelNum <= 3 ? tipForLevel(1) : null);
  const earned = starsFor(taps, level.par, usedHint);
  const isLast = levelNum >= LEVEL_COUNT;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <Planks />

      <View style={s.topBar}>
        <BackButton onPress={() => { playTap(); setView('levels'); }} />
        <View style={s.plaque}>
          <Text style={s.plaqueTxt}>LEVEL {levelNum}</Text>
        </View>
        <TouchableOpacity onPress={restart} hitSlop={HIT} style={s.woodRound} activeOpacity={0.7}>
          <Text style={s.woodRoundTxt}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>MOVES</Text>
          <Text style={s.statValue}>{taps}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[0, 1, 2].map((i) => <Star key={i} size={20} filled={i < earned} />)}
          </View>
          <Text style={s.parTxt}>PAR {level.par}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>CRYSTALS</Text>
          <Text style={s.statValue}>{trace.lit.size}/{totalTargets}</Text>
        </View>
      </View>

      <View style={s.tipWrap}>
        {(trace.mineHit || tip || !beamOn) && (
          <View style={[s.tipPill, trace.mineHit && s.tipPillBad]}>
            <Text style={s.tipTxt}>
              {trace.mineHit ? '💥 A laser is hitting a bomb!'
                : tip || '👆 Tap any mirror to switch the laser on'}
            </Text>
          </View>
        )}
      </View>

      <View style={s.boardWrap}>
        <View style={s.frame}>
          {[{ left: 6, top: 6 }, { right: 6, top: 6 }, { left: 6, bottom: 6 }, { right: 6, bottom: 6 }].map((p, i) => (
            <View key={i} style={[s.rivet, p]} />
          ))}
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
                <TubeLayer key={`t${boardKey}`} snapIn visits={trace.visits} cs={cs} boardPx={boardPx} pulse={pulse} colors={neon} />
              )}
              <BulbLayer key={`b${boardKey}`} grid={grid} cs={cs} lit={trace.lit} capDirs={capDirs} pulse={pulse} colors={neon} />
            </View>
          </View>
        </View>
      </View>

      <View style={s.controls}>
        <GameButton label="↶ UNDO" colors={['#6FC3FF', '#3A9BF0', '#2479D6']} base="#1A5BA8"
          onPress={undo} disabled={!history.length || complete || solved} />
        <GameButton label="💡 HINT" colors={['#FFD54A', '#FFB400', '#FF9800']} base="#B86400"
          onPress={hint} disabled={complete || solved} />
      </View>

      {complete && (
        <LightPathComplete
          levelNum={levelNum}
          stars={earned}
          totalStars={Object.values(bestStars).reduce((sum, v) => sum + v, 0)}
          maxStars={LEVEL_COUNT * 3}
          onNext={() => { if (isLast) setView('levels'); else startLevel(levelNum + 1); }}
          onReplay={restart}
          onHome={() => setView('levels')}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#B98858' },

  // Top bar / pills
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8,
  },

  // Levels (road map header floats over the scenery)
  mapHeader: { position: 'absolute', top: 0, left: 0, right: 0 },
  woodPill: {
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 22,
    backgroundColor: '#6B4426', borderWidth: 3, borderColor: '#F3D9A8',
  },
  woodPillTxt: { fontSize: 20, ...LEVEL_FONT, color: '#FFF4DC' },
  woodCount: {
    minWidth: 70, alignItems: 'center', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10,
    backgroundColor: '#6B4426', borderWidth: 2, borderColor: '#F3D9A8',
  },
  woodCountTxt: { fontSize: 14, ...LEVEL_FONT, color: '#FFD23F' },

  // Game (wooden theme, matching the level map)
  plaque: {
    borderRadius: 16, paddingVertical: 7, paddingHorizontal: 26,
    backgroundColor: '#6B4426', borderWidth: 3, borderColor: '#F3D9A8',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  plaqueTxt: { fontSize: 22, ...LEVEL_FONT, color: '#FFF4DC', letterSpacing: 1 },
  woodRound: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6B4426', borderWidth: 3, borderColor: '#F3D9A8',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  woodRoundTxt: { fontSize: 24, color: '#FFF4DC', fontWeight: '900', marginTop: -2 },
  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    marginHorizontal: 20, marginTop: 6, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#F1D6A0', borderWidth: 3, borderColor: '#C9A26A',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  statItem: { alignItems: 'center', minWidth: 80 },
  statLabel: { fontSize: 11, ...LEVEL_FONT, color: '#9A6A3C', letterSpacing: 0.8 },
  statValue: { fontSize: 22, ...LEVEL_FONT, color: '#5A3A1E' },
  parTxt: { fontSize: 11, ...LEVEL_FONT, color: '#9A6A3C', marginTop: 2, letterSpacing: 0.8 },
  statDivider: { width: 2, height: 30, borderRadius: 1, backgroundColor: 'rgba(122,82,48,0.3)' },
  tipWrap: { minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  tipPill: {
    borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14,
    backgroundColor: 'rgba(78,46,22,0.75)',
  },
  tipPillBad: { backgroundColor: 'rgba(160,30,30,0.85)' },
  tipTxt: { color: '#FFF4DC', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  boardWrap: { alignItems: 'center' },
  frame: {
    padding: 12, borderRadius: 24, backgroundColor: '#6B4426',
    borderWidth: 3, borderColor: '#F3D9A8',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  rivet: {
    position: 'absolute', width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FFD23F', borderWidth: 1, borderColor: '#A87A1E',
  },
  board: {
    padding: 6, borderRadius: 16, backgroundColor: BOARD_BG,
    borderWidth: 2, borderColor: '#3D2614',
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 'auto', marginBottom: 28 },
  gameBtnWrap: { width: 140, height: 58 },
  gameBtnBase: { position: 'absolute', left: 0, right: 0, height: 52, borderRadius: 18 },
  gameBtnFace: {
    height: 52, borderRadius: 18, borderWidth: 2.5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  gameBtnShine: {
    position: 'absolute', top: 4, left: 10, right: 10, height: 12, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  gameBtnTxt: {
    fontSize: 20, ...LEVEL_FONT, color: '#FFFFFF',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1,
  },

});

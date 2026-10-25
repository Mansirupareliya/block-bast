import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, StyleSheet, StatusBar, Animated, Pressable, ScrollView, AppState, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Rect, Circle, Path } from 'react-native-svg';
import { Text } from '../components/AppText';
import BackButton from '../components/BackButton';
import ColorConnectBoard from '../components/ColorConnectBoard';
import ColorConnectComplete from '../components/ColorConnectComplete';
import ColorConnectLoading from '../components/ColorConnectLoading';
import {
  makeLevel, tierFor, emptyPaths, beginDrag, extendDrag, applyDrag, tidy, isConnected,
  progressOf, validateBoard, applyHint,
} from '../utils/colorConnect';
import { LEVELS } from '../utils/colorConnectLevels';
import {
  playTap, playMatch, playWin, playLocked, isSfxEnabled, setSfxEnabled, subscribeSfx,
} from '../utils/audioManager';
import { hapticTap } from '../utils/haptics';
import { isMusicEnabled, setMusicEnabled, subscribeMusic } from '../utils/backgroundMusic';
import { STORAGE_KEYS, loadNumber, saveNumber, loadJSON, saveJSON } from '../utils/storage';
import { notifyLevelReached } from '../utils/notifications';
import { maybeAskForRating } from '../utils/rating';
import { showInterstitial, noteLevelComplete, runAfterLevelAd } from '../utils/interstitialAd';
import { LEVEL_FONT } from '../utils/fonts';
import { useBackHandler } from '../utils/useBackHandler';

const LEVEL_COUNT = LEVELS.length;
const { width: SW } = Dimensions.get('window');
const HIT = { top: 12, bottom: 12, left: 12, right: 12 };
const TIERS = [
  { from: 1, to: 10 }, { from: 11, to: 30 }, { from: 31, to: 60 }, { from: 61, to: LEVEL_COUNT },
];

const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const samePaths = (a, b) => a.length === b.length && a.every((p, k) => p.length === b[k].length && p.every((c, i) => c === b[k][i]));

// Survives leaving and re-entering the game during a session.
let globalUnlocked = 1;

// ── Shared look ───────────────────────────────────────────────────────────
// Teal gradient with a faint dotted/diagonal texture over it.
function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#2CC9BF', '#139AA0', '#0B6A78']} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="ccTex" width={28} height={28} patternUnits="userSpaceOnUse">
            <Circle cx={7} cy={7} r={2} fill="#FFFFFF" fillOpacity={0.09} />
            <Circle cx={21} cy={21} r={1.2} fill="#FFFFFF" fillOpacity={0.07} />
            <Path d="M0 28 L28 0" stroke="#000000" strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#ccTex)" />
      </Svg>
    </View>
  );
}

// RN Text has no stroke, so the dark outline is the same text stacked at
// small offsets behind the white face.
function OutlinedText({ children, size, color = '#FFFFFF', stroke = '#07444D', style }) {
  const w = Math.max(1.5, size * 0.06);
  const offsets = [[-w, 0], [w, 0], [0, -w], [0, w], [-w, -w], [w, -w], [-w, w], [w, w], [0, w * 2]];
  const base = { fontSize: size, ...LEVEL_FONT, textAlign: 'center', letterSpacing: 1 };
  return (
    <View style={style}>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, right: -dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

// Chunky candy button: darker base under a glossy gradient face.
function CandyButton({ label, colors, base, onPress, disabled, style, textSize = 20 }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={style}>
      {({ pressed }) => (
        <View style={[{ backgroundColor: base, borderRadius: 18, paddingBottom: pressed ? 2 : 5, marginTop: pressed ? 3 : 0 }, disabled && { opacity: 0.45 }]}>
          <LinearGradient colors={colors} style={s.candyFace}>
            <View style={s.candyShine} />
            <Text style={[s.candyTxt, { fontSize: textSize, textShadowColor: base }]}>{label}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

function RoundIconButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={HIT}>
      {({ pressed }) => (
        <View style={[s.roundBtn, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Text style={s.roundBtnTxt}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Toggle({ label, on, onChange }) {
  return (
    <Pressable onPress={() => { onChange(!on); playTap(); }} hitSlop={6} style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={[s.switch, on && s.switchOn]}>
        <View style={[s.knob, on && s.knobOn]} />
      </View>
    </Pressable>
  );
}

function useSetting(get, subscribe) {
  const [v, setV] = useState(get());
  useEffect(() => subscribe(setV), [subscribe]);
  return v;
}

// ── Level select ──────────────────────────────────────────────────────────
const LV_COLS = 5;
const LV_GAP = 10;
const LV_SIZE = Math.floor((Math.min(SW, 480) - 32 - LV_GAP * (LV_COLS - 1)) / LV_COLS);

function LevelTile({ num, state, perfect, onPress }) {
  const locked = state === 'locked';
  const current = state === 'current';
  const solved = state === 'solved';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <View style={[
        s.lvTile,
        solved && s.lvSolved,
        current && s.lvCurrent,
        locked && s.lvLocked,
      ]}>
        {locked
          ? <Text style={s.lvLock}>🔒</Text>
          : <Text style={[s.lvNum, current && { color: '#07444D' }]}>{num}</Text>}
        {solved && <Text style={s.lvBadge}>{perfect ? '★' : '✓'}</Text>}
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────
export default function ColorConnectScreen({ onBack }) {
  const [view, setView] = useState('loading'); // 'loading' | 'menu' | 'levels' | 'game'
  const [maxUnlocked, setMaxUnlocked] = useState(globalUnlocked);
  const [solved, setSolved] = useState({}); // { [levelNum]: 1 solved | 2 perfect }

  const [levelNum, setLevelNum] = useState(1);
  const [level, setLevel] = useState(null); // { n, dots, solution }
  const [paths, setPaths] = useState([]); // committed board
  const [board, setBoard] = useState([]); // what's drawn (board + live drag)
  const [history, setHistory] = useState([]); // earlier committed boards, for undo
  const [moves, setMoves] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [winning, setWinning] = useState(false); // board full, popup about to show
  const [complete, setComplete] = useState(false);
  const [activeColor, setActiveColor] = useState(null);
  const [headCell, setHeadCell] = useState(null);
  const [sparkles, setSparkles] = useState([]);
  const [boardArea, setBoardArea] = useState(null);

  const sfxOn = useSetting(isSfxEnabled, subscribeSfx);
  const musicOn = useSetting(isMusicEnabled, subscribeMusic);
  const winPulse = useRef(new Animated.Value(0)).current;

  useBackHandler(() => {
    if (view === 'game') { setPaused(false); setView('levels'); } else if (view === 'levels') setView('menu');
    else onBack();
  });

  useEffect(() => {
    loadNumber(STORAGE_KEYS.COLORCONNECT_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlocked) { globalUnlocked = saved; setMaxUnlocked(saved); }
    });
    loadJSON(STORAGE_KEYS.COLORCONNECT_SOLVED, {}).then((saved) => setSolved(saved || {}));
  }, []);

  // Everything the drag handlers need, read through a ref so the handlers
  // stay stable and the memoised board doesn't re-render on every tick.
  const g = useRef({});
  g.current = { level, paths, paused, winning, complete, levelNum, moves, usedHint };
  const drag = useRef(null); // { color, path } while a finger is down
  const base = useRef(null); // board when the finger went down
  const sparkleId = useRef(0);

  const sparkle = useCallback((color, cells) => {
    const items = cells.map((cell) => ({ id: ++sparkleId.current, cell, color }));
    setSparkles((sp) => [...sp, ...items]);
    setTimeout(() => setSparkles((sp) => sp.filter((x) => !items.includes(x))), 800);
  }, []);

  const startLevel = useCallback((num) => {
    runAfterLevelAd(() => {
      const lv = makeLevel(LEVELS[num - 1]);
      if (!lv) return;
      const empty = emptyPaths(lv.dots);
      drag.current = null;
      setLevelNum(num);
      setLevel(lv);
      setPaths(empty);
      setBoard(empty);
      setHistory([]);
      setMoves(0);
      setUsedHint(false);
      setElapsed(0);
      setPaused(false);
      setWinning(false);
      setComplete(false);
      setActiveColor(null);
      setHeadCell(null);
      setSparkles([]);
      winPulse.setValue(0);
      setView('game');
    });
  }, [winPulse]);

  // Board is full and every pair connected: celebrate, save, then show the
  // success screen.
  const finishLevel = useCallback((mv, hinted) => {
    const { levelNum: num, level: lv } = g.current;
    setWinning(true);
    playWin();
    Animated.sequence([
      Animated.timing(winPulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(winPulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(winPulse, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();
    lv.dots.forEach(([a, b], k) => sparkle(k, [a, b]));
    const perfect = !hinted && mv <= lv.dots.length;
    setSolved((prev) => {
      const grade = perfect ? 2 : 1;
      if ((prev[num] || 0) >= grade) return prev;
      const next = { ...prev, [num]: grade };
      saveJSON(STORAGE_KEYS.COLORCONNECT_SOLVED, next);
      return next;
    });
    const nextUnlock = Math.min(LEVEL_COUNT, num + 1);
    if (nextUnlock > globalUnlocked) {
      globalUnlocked = nextUnlock;
      setMaxUnlocked(nextUnlock);
      saveNumber(STORAGE_KEYS.COLORCONNECT_MAX_UNLOCKED, nextUnlock);
      notifyLevelReached('colorconnect', nextUnlock);
    }
    maybeAskForRating('colorconnect', Math.max(globalUnlocked - 1, num));
    noteLevelComplete();
    setTimeout(() => setComplete(true), 1000);
  }, [winPulse, sparkle]);

  // Commits a new board (from a drag or a hint), counting it as a move, and
  // checks for the win.
  const commit = useCallback((next, prev, hinted) => {
    const { level: lv, moves: mv, usedHint } = g.current;
    setPaths(next);
    setBoard(next);
    setHistory((h) => [...h, prev]);
    setMoves(mv + 1);
    if (validateBoard(lv.n, next, lv.dots).ok) finishLevel(mv + 1, usedHint || hinted);
  }, [finishLevel]);

  // ── Drawing ─────────────────────────────────────────────────────────────
  const onDown = useCallback((cell) => {
    const { level: lv, paths: cur, paused: p, winning: w, complete: c } = g.current;
    if (!lv || p || w || c) return;
    const d = beginDrag(cur, lv.dots, lv.n, cell);
    if (!d) return;
    hapticTap();
    drag.current = d;
    base.current = cur;
    setBoard(applyDrag(cur, d));
    setActiveColor(d.color);
    setHeadCell(d.path[d.path.length - 1]);
  }, []);

  const onEnter = useCallback((cell) => {
    const d = drag.current;
    const { level: lv } = g.current;
    if (!d || !lv) return;
    const path = extendDrag(d, lv.dots, lv.n, cell);
    if (path === d.path) return;
    const wasDone = isConnected(d.path, lv.dots[d.color]);
    drag.current = { ...d, path };
    setBoard(applyDrag(base.current, drag.current));
    setHeadCell(path[path.length - 1]);
    if (!wasDone && isConnected(path, lv.dots[d.color])) {
      playMatch();
      sparkle(d.color, lv.dots[d.color]);
    }
  }, [sparkle]);

  const onUp = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setActiveColor(null);
    setHeadCell(null);
    const prev = base.current;
    const next = tidy(applyDrag(prev, d));
    if (samePaths(next, prev)) { setBoard(prev); return; }
    commit(next, prev, false);
  }, [commit]);

  // ── Controls ────────────────────────────────────────────────────────────
  const busy = paused || winning || complete;

  const undo = useCallback(() => {
    if (busy || !history.length) return;
    playTap();
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPaths(prev);
    setBoard(prev);
  }, [busy, history]);

  const restart = useCallback(() => {
    playTap();
    setPaused(false);
    startLevel(levelNum);
  }, [levelNum, startLevel]);

  // Watch an ad, then one colour's line is drawn for you.
  const hintPending = useRef(false);
  const hint = useCallback(() => {
    if (busy || hintPending.current) return;
    playTap();
    hintPending.current = true;
    showInterstitial(() => {
      hintPending.current = false;
      const { level: lv, paths: cur, winning: w, complete: c } = g.current;
      if (!lv || w || c) return;
      const h = applyHint(cur, lv);
      if (!h) return;
      setUsedHint(true);
      playMatch();
      sparkle(h.color, lv.dots[h.color]);
      commit(h.paths, cur, true);
    });
  }, [busy, sparkle, commit]);

  // ── Timer + auto-pause ──────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'game' || busy) return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [view, busy]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && view === 'game' && !g.current.complete && !g.current.winning) setPaused(true);
    });
    return () => sub.remove();
  }, [view]);

  const progress = useMemo(
    () => (level ? progressOf(level.n, board, level.dots) : null),
    [level, board],
  );

  const solvedCount = Object.keys(solved).length;
  const continueLevel = Math.min(maxUnlocked, LEVEL_COUNT);

  const onLoaded = useCallback(() => setView('menu'), []);

  // ── Loading splash ──────────────────────────────────────────────────────
  if (view === 'loading') return <ColorConnectLoading onDone={onLoaded} />;

  // ── Menu ────────────────────────────────────────────────────────────────
  if (view === 'menu') {
    const preview = makeLevel(LEVELS[0]);
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <Backdrop />
        <View style={s.topBar}>
          <BackButton onPress={() => { playTap(); onBack(); }} />
          <View />
        </View>
        <ScrollView contentContainerStyle={s.menuBody} bounces={false}>
          <OutlinedText size={Math.min(52, SW * 0.13)}>COLOR</OutlinedText>
          <OutlinedText size={Math.min(52, SW * 0.13)} style={{ marginTop: -8 }}>CONNECT</OutlinedText>
          <Text style={s.tagline}>Link the dots · Fill every cell</Text>

          <View style={[s.boardFrame, { marginTop: 22 }]}>
            <ColorConnectBoard
              n={preview.n} dots={preview.dots} paths={preview.solution} size={Math.min(220, SW - 120)}
              disabled sparkles={[]} onDown={() => {}} onEnter={() => {}} onUp={() => {}}
            />
          </View>

          <CandyButton
            label={maxUnlocked > 1 ? `▶ CONTINUE · LEVEL ${continueLevel}` : '▶ START GAME'}
            colors={['#FFE36A', '#FFC21A']} base="#C78A00" textSize={22}
            onPress={() => { playTap(); startLevel(continueLevel); }}
            style={s.menuBtn}
          />
          <CandyButton
            label="LEVELS" colors={['#9FC2FF', '#5B8DEF']} base="#2E4E93"
            onPress={() => { playTap(); setView('levels'); }}
            style={s.menuBtn}
          />
          <View style={s.menuToggles}>
            <Toggle label="🔊 Sound" on={sfxOn} onChange={setSfxEnabled} />
            <Toggle label="🎵 Music" on={musicOn} onChange={setMusicEnabled} />
          </View>
          <Text style={s.menuProgress}>Solved {solvedCount}/{LEVEL_COUNT}</Text>
        </ScrollView>
      </View>
    );
  }

  // ── Level select ────────────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <Backdrop />
        <View style={s.topBar}>
          <BackButton onPress={() => { playTap(); setView('menu'); }} />
          <OutlinedText size={26}>LEVELS</OutlinedText>
          <View style={s.countPill}><Text style={s.countTxt}>{solvedCount}/{LEVEL_COUNT}</Text></View>
        </View>
        <ScrollView contentContainerStyle={s.levelsBody}>
          {TIERS.map(({ from, to }) => {
            const tier = tierFor(from);
            const nums = [];
            for (let i = from; i <= to; i++) nums.push(i);
            return (
              <View key={from} style={{ marginBottom: 18 }}>
                <View style={s.tierHead}>
                  <View style={[s.tierDot, { backgroundColor: tier.color }]} />
                  <Text style={s.tierName}>{tier.name}</Text>
                  <Text style={s.tierRange}>{from}–{to} · {LEVELS[from - 1].n}×{LEVELS[from - 1].n} to {LEVELS[to - 1].n}×{LEVELS[to - 1].n}</Text>
                </View>
                <View style={s.lvGrid}>
                  {nums.map((num) => {
                    const state = solved[num] ? 'solved' : num === continueLevel ? 'current' : num <= maxUnlocked ? 'open' : 'locked';
                    return (
                      <LevelTile
                        key={num} num={num} state={state} perfect={solved[num] === 2}
                        onPress={() => {
                          if (state === 'locked') playLocked();
                          else { playTap(); startLevel(num); }
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── Game ────────────────────────────────────────────────────────────────
  if (!level || !progress) return null;
  const tier = tierFor(levelNum);
  const left = progress.total - progress.filled;
  const allConnected = progress.connected === progress.pairs;
  let status;
  let statusStyle = null;
  if (winning || complete) status = '🎉 Every cell filled!';
  else if (allConnected && left > 0) {
    status = `All pairs connected, but ${left} empty cell${left > 1 ? 's' : ''} left. Fill every box!`;
    statusStyle = s.statusWarn;
  } else if (moves === 0) status = '👆 Drag between matching dots. Fill every cell!';
  else status = `${progress.connected}/${progress.pairs} pairs connected`;

  const size = boardArea
    ? Math.floor(Math.min(boardArea.w - 20, boardArea.h - 20, 520) / level.n) * level.n
    : 0;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <Backdrop />

      <View style={s.topBar}>
        <BackButton onPress={() => { playTap(); setView('levels'); }} />
        <View style={{ alignItems: 'center' }}>
          <OutlinedText size={26}>LEVEL {levelNum}</OutlinedText>
          <Text style={[s.tierTag, { color: tier.color }]}>{tier.name} · {level.n}×{level.n}</Text>
        </View>
        <RoundIconButton label="❚❚" onPress={() => { playTap(); if (!winning && !complete) setPaused(true); }} />
      </View>

      <View style={s.stats}>
        <View style={{ flex: 1.4 }}>
          <View style={s.fillRow}>
            <Text style={s.statLabel}>FILLED</Text>
            <Text style={s.fillValue}>{progress.filled}/{progress.total}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${(progress.filled / progress.total) * 100}%` }, left === 0 && { backgroundColor: '#7CF29A' }]} />
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>PAIRS</Text>
          <Text style={s.statValue}>{progress.connected}/{progress.pairs}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>MOVES</Text>
          <Text style={s.statValue}>{moves}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>TIME</Text>
          <Text style={s.statValue}>{fmtTime(elapsed)}</Text>
        </View>
      </View>

      <View style={s.statusWrap}>
        <View style={[s.statusPill, statusStyle]}>
          <Text style={s.statusTxt}>{status}</Text>
        </View>
      </View>

      <View style={s.boardArea} onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setBoardArea({ w, h });
      }}>
        {size > 0 && (
          <View style={s.boardFrame}>
            <ColorConnectBoard
              n={level.n} dots={level.dots} paths={board} size={size}
              disabled={busy} activeColor={activeColor} headCell={headCell}
              sparkles={sparkles} winPulse={winPulse}
              onDown={onDown} onEnter={onEnter} onUp={onUp}
            />
          </View>
        )}
      </View>

      <View style={s.controls}>
        <CandyButton label="↶ UNDO" colors={['#7FD0FF', '#3A9BF0']} base="#1A5BA8"
          onPress={undo} disabled={busy || !history.length} style={s.ctrlBtn} textSize={17} />
        <CandyButton label="↻ RESTART" colors={['#FF9B9B', '#F0506E']} base="#A8203E"
          onPress={restart} disabled={winning || complete} style={s.ctrlBtn} textSize={17} />
        <CandyButton label="💡 HINT" colors={['#FFE36A', '#FFB400']} base="#B86400"
          onPress={hint} disabled={busy} style={s.ctrlBtn} textSize={17} />
      </View>

      {paused && (
        <View style={s.overlay}>
          <View style={s.pauseCard}>
            <OutlinedText size={38}>PAUSED</OutlinedText>
            <Text style={s.pauseSub}>Level {levelNum} · {fmtTime(elapsed)}</Text>
            <CandyButton label="▶ RESUME" colors={['#FFE36A', '#FFC21A']} base="#C78A00"
              onPress={() => { playTap(); setPaused(false); }} style={s.pauseBtn} />
            <CandyButton label="↻ RESTART" colors={['#FF9B9B', '#F0506E']} base="#A8203E"
              onPress={restart} style={s.pauseBtn} />
            <CandyButton label="LEVELS" colors={['#9FC2FF', '#5B8DEF']} base="#2E4E93"
              onPress={() => { playTap(); setPaused(false); setView('levels'); }} style={s.pauseBtn} />
            <View style={{ alignSelf: 'stretch', marginTop: 16, gap: 10 }}>
              <Toggle label="🔊 Sound effects" on={sfxOn} onChange={setSfxEnabled} />
              <Toggle label="🎵 Music" on={musicOn} onChange={setMusicEnabled} />
            </View>
          </View>
        </View>
      )}

      {complete && (
        <ColorConnectComplete
          levelNum={levelNum}
          moves={moves}
          pairs={level.dots.length}
          time={fmtTime(elapsed)}
          perfect={!usedHint && moves <= level.dots.length}
          usedHint={usedHint}
          isLast={levelNum >= LEVEL_COUNT}
          onNext={() => { playTap(); if (levelNum >= LEVEL_COUNT) setView('levels'); else startLevel(levelNum + 1); }}
          onReplay={restart}
          onLevels={() => { playTap(); setView('levels'); }}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#139AA0' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8,
  },

  // Buttons
  candyFace: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  candyShine: { position: 'absolute', top: 4, left: 10, right: 10, height: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.35)' },
  candyTxt: { ...LEVEL_FONT, color: '#FFFFFF', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  roundBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0B5E68', borderWidth: 3, borderColor: '#BFF5EF',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  roundBtnTxt: { fontSize: 16, color: '#FFFFFF', fontWeight: '900', letterSpacing: -2 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.2)',
  },
  toggleLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginRight: 12 },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  switchOn: { backgroundColor: '#7CF29A' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  knobOn: { transform: [{ translateX: 20 }] },

  // Menu
  menuBody: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 30 },
  tagline: { fontSize: 15, fontWeight: '800', color: '#E4FFFB', marginTop: 6, letterSpacing: 0.5 },
  menuBtn: { alignSelf: 'stretch', marginTop: 16, maxWidth: 360, width: '100%' },
  menuToggles: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  menuProgress: { fontSize: 14, ...LEVEL_FONT, color: '#E4FFFB', marginTop: 16 },

  // Level select
  countPill: { minWidth: 70, alignItems: 'center', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#0B5E68', borderWidth: 2, borderColor: '#BFF5EF' },
  countTxt: { fontSize: 15, ...LEVEL_FONT, color: '#FFE36A' },
  levelsBody: { paddingHorizontal: 16, paddingBottom: 40, alignItems: 'center' },
  tierHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, width: LV_SIZE * LV_COLS + LV_GAP * (LV_COLS - 1) },
  tierDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  tierName: { fontSize: 18, ...LEVEL_FONT, color: '#FFFFFF', marginRight: 8 },
  tierRange: { fontSize: 12, fontWeight: '700', color: '#CFFAF5' },
  lvGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: LV_GAP, width: LV_SIZE * LV_COLS + LV_GAP * (LV_COLS - 1) },
  lvTile: {
    width: LV_SIZE, height: LV_SIZE, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0B5E68', borderWidth: 2, borderColor: 'rgba(191,245,239,0.6)',
  },
  lvSolved: { backgroundColor: '#1F8F6A', borderColor: '#7CF29A' },
  lvCurrent: { backgroundColor: '#FFE36A', borderColor: '#FFFFFF', borderWidth: 3 },
  lvLocked: { backgroundColor: 'rgba(5,50,58,0.55)', borderColor: 'rgba(191,245,239,0.2)' },
  lvNum: { fontSize: LV_SIZE * 0.38, ...LEVEL_FONT, color: '#FFFFFF' },
  lvLock: { fontSize: LV_SIZE * 0.32, opacity: 0.7 },
  lvBadge: { position: 'absolute', top: 2, right: 6, fontSize: 12, color: '#FFE36A', fontWeight: '900' },

  // Game
  tierTag: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  stats: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 4,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: 'rgba(5,50,58,0.55)', borderWidth: 2, borderColor: 'rgba(191,245,239,0.45)',
  },
  fillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fillValue: { fontSize: 18, ...LEVEL_FONT, color: '#FFFFFF' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: '#FFE36A' },
  statDivider: { width: 2, height: 30, borderRadius: 1, backgroundColor: 'rgba(191,245,239,0.3)', marginHorizontal: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, ...LEVEL_FONT, color: '#8FD9D1', letterSpacing: 0.8 },
  statValue: { fontSize: 17, ...LEVEL_FONT, color: '#FFFFFF' },
  statusWrap: { minHeight: 50, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  statusPill: { borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(5,50,58,0.6)' },
  statusWarn: { backgroundColor: 'rgba(200,110,0,0.9)' },
  statusTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  boardFrame: {
    padding: 6, borderRadius: 16, backgroundColor: '#07444D',
    borderWidth: 3, borderColor: '#BFF5EF',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  controls: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 },
  ctrlBtn: { flex: 1 },

  // Pause
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,30,36,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pauseCard: {
    width: '100%', maxWidth: 340, alignItems: 'center', borderRadius: 28, padding: 22,
    backgroundColor: '#0F4C55', borderWidth: 3, borderColor: '#5FE3D6',
  },
  pauseSub: { fontSize: 14, fontWeight: '700', color: '#BFF5EF', marginTop: 2, marginBottom: 6 },
  pauseBtn: { alignSelf: 'stretch', marginTop: 12 },
});

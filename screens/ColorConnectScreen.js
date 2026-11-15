import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Image, StyleSheet, StatusBar, Animated, Pressable, AppState, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/AppText';
import BackButton from '../components/BackButton';
import ColorConnectBoard from '../components/ColorConnectBoard';
import ColorConnectComplete from '../components/ColorConnectComplete';
import ColorConnectLoading from '../components/ColorConnectLoading';
import ColorConnectLevels from '../components/ColorConnectLevels';
import { CONNECT_FX_MS } from '../components/ColorConnectFX';
import {
  makeLevel, tierFor, emptyPaths, beginDrag, extendDrag, applyDrag, tidy, isConnected,
  progressOf, validateBoard, applyHint,
} from '../utils/colorConnect';
import { LEVELS } from '../utils/colorConnectLevels';
import { SvgXml } from 'react-native-svg';
import { FOREST_BG } from '../utils/colorConnectAssets';
import { UNDO_SVG, RESTART_SVG, HINT_SVG, ALARM_SVG } from '../utils/colorConnectIcons';
import {
  playTap, playMatch, playWin, playLocked, isSfxEnabled, setSfxEnabled, subscribeSfx,
} from '../utils/audioManager';
import { hapticTap } from '../utils/haptics';
import { isMusicEnabled, setMusicEnabled, subscribeMusic } from '../utils/backgroundMusic';
import { STORAGE_KEYS, loadNumber, saveNumber, loadJSON, saveJSON } from '../utils/storage';
import { notifyLevelReached } from '../utils/notifications';
import { maybeAskForRating } from '../utils/rating';
import { showInterstitial, noteLevelComplete, runAfterLevelAd, isAdShowing } from '../utils/interstitialAd';
import { LEVEL_FONT } from '../utils/fonts';
import { useBackHandler } from '../utils/useBackHandler';

const LEVEL_COUNT = LEVELS.length;
const { width: SW } = Dimensions.get('window');
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const samePaths = (a, b) => a.length === b.length && a.every((p, k) => p.length === b[k].length && p.every((c, i) => c === b[k][i]));

// Survives leaving and re-entering the game during a session.
let globalUnlocked = 1;

// ── Shared look ───────────────────────────────────────────────────────────
// Glowing forest art, sized by hand rather than with resizeMode (Android was
// showing it heavily zoomed in). The backdrop measures itself, then scales
// the picture by exactly the amount needed to cover that box: the image keeps
// its true proportions, is centred, and only the sliver that doesn't fit the
// phone's shape is trimmed, so the whole forest stays in view on every phone.
// A light dark wash at the top and bottom keeps the HUD and buttons readable.
const BG_W = 736;
const BG_H = 1600;
const Backdrop = React.memo(function Backdrop() {
  const [box, setBox] = useState(null);
  let img = null;
  if (box) {
    const scale = Math.max(box.w / BG_W, box.h / BG_H);
    const w = Math.ceil(BG_W * scale), h = Math.ceil(BG_H * scale);
    img = { position: 'absolute', width: w, height: h, left: (box.w - w) / 2, top: (box.h - h) / 2 };
  }
  return (
    <View
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#1A0B3D' }]}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {img && <Image source={FOREST_BG} resizeMode="stretch" fadeDuration={0} style={img} />}
      <LinearGradient
        colors={['rgba(12,6,40,0.55)', 'rgba(12,6,40,0.05)', 'rgba(12,6,40,0.05)', 'rgba(12,6,40,0.6)']}
        locations={[0, 0.25, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

// RN Text has no stroke, so the dark outline is the same text stacked at
// small offsets behind the white face.
const OutlinedText = React.memo(function OutlinedText({ children, size, color = '#FFFFFF', stroke = '#2A0E5C', style }) {
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
});

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

// Alarm art next to the timer; memoised so the SVG (with its blur filter)
// isn't rebuilt on every drag step or timer tick.
const AlarmIcon = React.memo(function AlarmIcon() {
  return <SvgXml xml={ALARM_SVG} width={40} height={40} style={s.timerIcon} />;
});

// Glossy round icon button (header actions).
const IconButton = React.memo(function IconButton({ xml, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6}>
      {({ pressed }) => (
        <View style={[s.iconBtn, pressed && { transform: [{ scale: 0.9 }] }, disabled && { opacity: 0.45 }]}>
          <SvgXml xml={xml} width="100%" height="100%" />
        </View>
      )}
    </Pressable>
  );
});

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

// ── Main screen ───────────────────────────────────────────────────────────
export default function ColorConnectScreen({ onBack }) {
  const [view, setView] = useState('loading'); // 'loading' | 'levels' | 'game'
  const [maxUnlocked, setMaxUnlocked] = useState(globalUnlocked);
  const [solved, setSolved] = useState({}); // { [levelNum]: stars 1–3 }

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
  const [connects, setConnects] = useState([]); // pair-connected celebrations playing
  const [boardArea, setBoardArea] = useState(null);

  const sfxOn = useSetting(isSfxEnabled, subscribeSfx);
  const musicOn = useSetting(isMusicEnabled, subscribeMusic);
  const winPulse = useRef(new Animated.Value(0)).current;

  useBackHandler(() => {
    if (view === 'game') { setPaused(false); setView('levels'); } else onBack();
  });

  useEffect(() => {
    loadNumber(STORAGE_KEYS.COLORCONNECT_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlocked) { globalUnlocked = saved; setMaxUnlocked(saved); }
    });
    Promise.all([
      loadJSON(STORAGE_KEYS.COLORCONNECT_STARS, {}),
      loadJSON(STORAGE_KEYS.COLORCONNECT_SOLVED, {}),
    ]).then(([stars, old]) => {
      // Levels solved before stars existed: perfect → 3, solved → 2.
      const merged = { ...(stars || {}) };
      Object.entries(old || {}).forEach(([num, grade]) => {
        if (!merged[num]) merged[num] = grade === 2 ? 3 : 2;
      });
      setSolved(merged);
    });
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

  // Full celebration when a pair gets connected (see ColorConnectFX).
  const celebrate = useCallback((color, path) => {
    const fx = { id: ++sparkleId.current, color, path };
    setConnects((cur) => [...cur.filter((x) => x.color !== color), fx]);
    setTimeout(() => setConnects((cur) => cur.filter((x) => x !== fx)), CONNECT_FX_MS);
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
      setConnects([]);
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
      // Same stars as the level-complete popup; keep the best ever.
      const stars = perfect ? 3 : hinted ? 1 : 2;
      if ((prev[num] || 0) >= stars) return prev;
      const next = { ...prev, [num]: stars };
      saveJSON(STORAGE_KEYS.COLORCONNECT_STARS, next);
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
      hapticTap();
      celebrate(d.color, path);
    }
  }, [celebrate]);

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
      celebrate(h.color, h.paths[h.color]);
      commit(h.paths, cur, true);
    });
  }, [busy, celebrate, commit]);

  // ── Timer + auto-pause ──────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'game' || busy) return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [view, busy]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      // An ad (e.g. from the hint button) also backgrounds the app; don't
      // pause for that, or the hint's line ends up hidden behind PAUSED.
      if (isAdShowing()) return;
      if (st !== 'active' && view === 'game' && !g.current.complete && !g.current.winning) setPaused(true);
    });
    return () => sub.remove();
  }, [view]);

  const progress = useMemo(
    () => (level ? progressOf(level.n, board, level.dots) : null),
    [level, board],
  );

  const continueLevel = Math.min(maxUnlocked, LEVEL_COUNT);

  // After the loading splash, go straight to the level list.
  const onLoaded = useCallback(() => setView('levels'), []);

  // ── Loading splash ──────────────────────────────────────────────────────
  if (view === 'loading') return <ColorConnectLoading onDone={onLoaded} />;

  // ── Level select ────────────────────────────────────────────────────────
  if (view === 'levels') {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
        <Backdrop />
        <ColorConnectLevels
          levelCount={LEVEL_COUNT}
          stars={solved}
          maxUnlocked={maxUnlocked}
          current={continueLevel}
          onPick={(num) => { playTap(); startLevel(num); }}
          onLocked={playLocked}
          onBack={() => { playTap(); onBack(); }}
        />
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
  } else if (moves === 0) {
    // The how-to-play tip is only for the first few levels.
    status = levelNum <= 5 ? '👆 Drag between matching dots. Fill every cell!' : null;
  } else status = `${progress.connected}/${progress.pairs} pairs connected`;

  const size = boardArea
    ? Math.floor((Math.min(boardArea.w - 20, boardArea.h - 20, 520) * 0.85) / level.n) * level.n
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
        {/* Same width as the back button so the title stays centred. */}
        <View style={{ width: 46 }} />
      </View>

      <View style={s.actions}>
        <IconButton xml={UNDO_SVG} onPress={undo} disabled={busy || !history.length} />
        <IconButton xml={RESTART_SVG} onPress={restart} disabled={winning || complete} />
        <IconButton xml={HINT_SVG} onPress={hint} disabled={busy} />
      </View>

      <View style={s.timerWrap}>
        <View style={s.timerPill}>
          <AlarmIcon />
          <OutlinedText size={28} color="#FFE36A" stroke="#3A1400" style={s.timerTxt}>{fmtTime(elapsed)}</OutlinedText>
        </View>
      </View>

      <View style={s.statusWrap}>
        {status && (
          <View style={[s.statusPill, statusStyle]}>
            <Text style={s.statusTxt}>{status}</Text>
          </View>
        )}
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
              sparkles={sparkles} winPulse={winPulse} connects={connects}
              onDown={onDown} onEnter={onEnter} onUp={onUp}
            />
          </View>
        )}
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
  root: { flex: 1, backgroundColor: '#1A0B3D' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8,
  },

  // Buttons
  candyFace: { borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  candyShine: { position: 'absolute', top: 4, left: 10, right: 10, height: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.35)' },
  candyTxt: { ...LEVEL_FONT, color: '#FFFFFF', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.2)',
  },
  toggleLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginRight: 12 },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  switchOn: { backgroundColor: '#7CF29A' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  knobOn: { transform: [{ translateX: 20 }] },

  // Game
  tierTag: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  statusWrap: { minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  statusPill: { borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(24,10,64,0.72)' },
  statusWarn: { backgroundColor: 'rgba(200,110,0,0.9)' },
  statusTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, paddingHorizontal: 6, paddingBottom: 16 },
  // No tray: the neon cells sit straight on the forest background.
  boardFrame: { padding: 6 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22, marginTop: 4 },
  iconBtn: { width: 64, height: 64 },
  timerWrap: { alignItems: 'center', marginTop: 10 },
  timerPill: { flexDirection: 'row', alignItems: 'center' },
  timerIcon: { marginRight: 2, marginTop: -4 },
  timerTxt: {},

  // Pause
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,6,38,0.78)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pauseCard: {
    width: '100%', maxWidth: 340, alignItems: 'center', borderRadius: 28, padding: 22,
    backgroundColor: '#24104F', borderWidth: 3, borderColor: '#B57BFF',
  },
  pauseSub: { fontSize: 14, fontWeight: '700', color: '#E2D2FF', marginTop: 2, marginBottom: 6 },
  pauseBtn: { alignSelf: 'stretch', marginTop: 12 },
});

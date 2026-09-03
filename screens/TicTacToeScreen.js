import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { checkWinner, getBestMove } from '../utils/tictactoeAI';

const { width: SW } = Dimensions.get('window');
const BOARD_W  = SW - 56;
const CELL_S   = BOARD_W / 3;

const DIFF_OPTIONS = [
  { key: 'easy',   label: 'Easy',   emoji: '🟢', colors: ['#43A047','#2E7D32'] },
  { key: 'medium', label: 'Medium', emoji: '🟡', colors: ['#F9A825','#E65100'] },
  { key: 'hard',   label: 'Hard',   emoji: '🔴', colors: ['#E53935','#880E4F'] },
];

export default function TicTacToeScreen({ onBack }) {
  const [board,        setBoard]        = useState(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [result,       setResult]       = useState(null);
  const [scores,       setScores]       = useState({ you: 0, com: 0, draw: 0 });
  const [difficulty,   setDifficulty]   = useState('medium');
  const [thinking,     setThinking]     = useState(false);
  const [showDiff,     setShowDiff]     = useState(false);
  const [roundNum,     setRoundNum]     = useState(1);

  const cellScales = useRef(Array(9).fill(null).map(() => new Animated.Value(0))).current;
  const winPulse   = useRef(new Animated.Value(0)).current;
  const resultSlide= useRef(new Animated.Value(60)).current;
  const resultOp   = useRef(new Animated.Value(0)).current;
  const boardEnter = useRef(new Animated.Value(0.85)).current;
  const headerY    = useRef(new Animated.Value(-20)).current;
  const headerO    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(boardEnter, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(headerY,   { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(headerO,   { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const animateCell = (idx) => {
    cellScales[idx].setValue(0);
    Animated.spring(cellScales[idx], { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  };

  const showResult = () => {
    resultSlide.setValue(50);
    resultOp.setValue(0);
    Animated.parallel([
      Animated.spring(resultSlide, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(resultOp,    { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    winPulse.setValue(0);
    Animated.loop(Animated.sequence([
      Animated.timing(winPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(winPulse, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]), { iterations: 6 }).start();
  };

  const applyResult = useCallback((res, prevScores) => {
    const s = { ...prevScores };
    if (res.winner === 'X')    s.you++;
    if (res.winner === 'O')    s.com++;
    if (res.winner === 'draw') s.draw++;
    setScores(s);
    setResult(res);
    showResult();
  }, []);

  const doComputerMove = useCallback((currentBoard, currentScores) => {
    setThinking(true);
    setTimeout(() => {
      const copy = [...currentBoard];
      const move = getBestMove(copy, difficulty);
      if (move === -1) { setThinking(false); return; }
      copy[move] = 'O';
      animateCell(move);
      setBoard(copy);
      setThinking(false);
      const res = checkWinner(copy);
      if (res) { applyResult(res, currentScores); }
      else     { setIsPlayerTurn(true); }
    }, 500 + Math.random() * 400);
  }, [difficulty, applyResult]);

  const handleCell = useCallback((idx) => {
    if (!isPlayerTurn || board[idx] || result || thinking) return;
    const copy = [...board];
    copy[idx] = 'X';
    animateCell(idx);
    setBoard(copy);
    const res = checkWinner(copy);
    if (res) { applyResult(res, scores); }
    else     { setIsPlayerTurn(false); doComputerMove(copy, scores); }
  }, [isPlayerTurn, board, result, thinking, scores, applyResult, doComputerMove]);

  const restart = () => {
    setBoard(Array(9).fill(null));
    setResult(null);
    setIsPlayerTurn(true);
    setThinking(false);
    setRoundNum(r => r + 1);
    cellScales.forEach(s => s.setValue(0));
    winPulse.setValue(0);
  };

  // ── Status ────────────────────────────────────────────────────────────────
  const statusConfig = (() => {
    if (result) {
      if (result.winner === 'X')    return { msg: 'You Won! 🎉',     color: '#4C9EFF', bg: 'rgba(76,158,255,0.12)' };
      if (result.winner === 'O')    return { msg: 'AI Won! 🤖',      color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' };
      return                               { msg: "It's a Draw 🤝",   color: '#FFD700', bg: 'rgba(255,215,0,0.12)' };
    }
    if (thinking) return { msg: 'AI is thinking... 🤔', color: '#FF8C00', bg: 'rgba(255,140,0,0.1)' };
    return             { msg: 'Your move  ✕',           color: '#4C9EFF', bg: 'rgba(76,158,255,0.1)' };
  })();

  // ── Cell render ───────────────────────────────────────────────────────────
  const renderCell = (idx) => {
    const val       = board[idx];
    const isWin     = result?.line?.includes(idx);
    const cellScale = cellScales[idx];
    const glowOp    = isWin ? winPulse : null;
    const isEmpty   = !val && !result && isPlayerTurn && !thinking;

    return (
      <TouchableOpacity
        key={idx}
        onPress={() => handleCell(idx)}
        activeOpacity={0.75}
        style={{ width: CELL_S, height: CELL_S, padding: 7 }}
      >
        <View style={[
          styles.cell,
          isWin && { backgroundColor: val === 'X' ? 'rgba(76,158,255,0.15)' : 'rgba(255,107,107,0.15)' },
        ]}>
          {/* Win glow border */}
          {isWin && glowOp && (
            <Animated.View style={[StyleSheet.absoluteFill, styles.winBorder, {
              borderColor: val === 'X' ? '#4C9EFF' : '#FF6B6B',
              opacity: glowOp,
            }]} />
          )}

          {/* X mark */}
          {val === 'X' && (
            <Animated.View style={{ transform: [{ scale: cellScale }] }}>
              <View style={styles.xWrap}>
                <View style={[styles.xBar, styles.xBar1, { backgroundColor: '#4C9EFF' }]} />
                <View style={[styles.xBar, styles.xBar2, { backgroundColor: '#4C9EFF' }]} />
              </View>
            </Animated.View>
          )}

          {/* O mark */}
          {val === 'O' && (
            <Animated.View style={{ transform: [{ scale: cellScale }] }}>
              <View style={[styles.oRing, { borderColor: '#FF6B6B' }]} />
            </Animated.View>
          )}

          {/* Tap hint on empty cells */}
          {isEmpty && (
            <View style={styles.tapHint}>
              <Text style={styles.tapHintPlus}>+</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const curDiff = DIFF_OPTIONS.find(d => d.key === difficulty);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080818' }]} />
      <View style={styles.topGlowRed} />

      <View style={{ height: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 50 }} />

      {/* ── Top bar ── */}
      <Animated.View style={[styles.topBar, { opacity: headerO, transform: [{ translateY: headerY }] }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <View style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Tic-Tac-Toe</Text>
          <Text style={styles.roundLabel}>Round {roundNum}</Text>
        </View>

        {/* Difficulty chip */}
        <TouchableOpacity onPress={() => setShowDiff(p => !p)} activeOpacity={0.8}>
          <LinearGradient colors={curDiff.colors} style={styles.diffChip} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.diffChipText}>{curDiff.emoji} {curDiff.label}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Difficulty dropdown */}
      {showDiff && (
        <View style={styles.dropdown}>
          {DIFF_OPTIONS.map(d => (
            <TouchableOpacity key={d.key} onPress={() => { setDifficulty(d.key); setShowDiff(false); restart(); }} activeOpacity={0.85}>
              <LinearGradient colors={d.colors} style={styles.dropRow} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.dropRowText}>{d.emoji} {d.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Scoreboard ── */}
      <View style={styles.scoreboard}>
        {/* You */}
        <View style={[styles.scoreCard, scores.you >= scores.com && { borderColor: 'rgba(76,158,255,0.4)' }]}>
          <Text style={styles.scoreAvatar}>👤</Text>
          <Text style={styles.scoreName}>YOU</Text>
          <Text style={styles.scoreMarkX}>✕</Text>
          <Text style={styles.scoreNum}>{scores.you}</Text>
        </View>

        {/* Draw */}
        <View style={styles.drawBox}>
          <Text style={styles.drawNum}>{scores.draw}</Text>
          <Text style={styles.drawLabel}>DRAW</Text>
        </View>

        {/* AI */}
        <View style={[styles.scoreCard, styles.scoreCardRight, scores.com > scores.you && { borderColor: 'rgba(255,107,107,0.4)' }]}>
          <Text style={styles.scoreAvatar}>🤖</Text>
          <Text style={styles.scoreName}>AI</Text>
          <Text style={styles.scoreMarkO}>◯</Text>
          <Text style={styles.scoreNum}>{scores.com}</Text>
        </View>
      </View>

      {/* ── Status bar ── */}
      <View style={[styles.statusBar, { backgroundColor: statusConfig.bg }]}>
        <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.msg}</Text>
      </View>

      {/* ── Board ── */}
      <Animated.View style={[styles.boardWrap, { transform: [{ scale: boardEnter }] }]}>
        <View style={styles.board}>
          {/* Grid lines */}
          <View style={[styles.line, styles.vLine1]} />
          <View style={[styles.line, styles.vLine2]} />
          <View style={[styles.line, styles.hLine1]} />
          <View style={[styles.line, styles.hLine2]} />

          {/* Cells */}
          {[0, 1, 2].map(row => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {[0, 1, 2].map(col => renderCell(row * 3 + col))}
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── Result overlay inside board area ── */}
      {result && (
        <Animated.View style={[styles.resultBanner, { opacity: resultOp, transform: [{ translateY: resultSlide }] }]}>
          <LinearGradient
            colors={result.winner === 'X' ? ['#1565C0','#0D47A1'] : result.winner === 'O' ? ['#B71C1C','#880E4F'] : ['#1A1A35','#0A0A20']}
            style={styles.resultCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={styles.resultEmoji}>
              {result.winner === 'X' ? '🏆' : result.winner === 'O' ? '🤖' : '🤝'}
            </Text>
            <Text style={styles.resultTitle}>
              {result.winner === 'X' ? 'You Won!' : result.winner === 'O' ? 'AI Wins!' : "Draw!"}
            </Text>
            <TouchableOpacity onPress={restart} style={styles.nextBtn} activeOpacity={0.85}>
              <LinearGradient colors={['#4C9EFF','#7C4DFF']} style={styles.nextBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.nextBtnText}>Next Round →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

      {/* ── Bottom ── */}
      <View style={styles.bottom}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: 'rgba(76,158,255,0.15)', borderColor: 'rgba(76,158,255,0.4)' }]}>
              <Text style={{ color: '#4C9EFF', fontWeight: 'bold', fontSize: 13 }}>✕</Text>
            </View>
            <Text style={styles.legendText}> You</Text>
          </View>
          <View style={styles.legendDot} />
          <View style={styles.legendItem}>
            <View style={[styles.legendMark, { backgroundColor: 'rgba(255,107,107,0.15)', borderColor: 'rgba(255,107,107,0.4)' }]}>
              <Text style={{ color: '#FF6B6B', fontWeight: 'bold', fontSize: 13 }}>◯</Text>
            </View>
            <Text style={styles.legendText}> AI</Text>
          </View>
          {!result && (
            <TouchableOpacity onPress={restart} style={styles.resetBtn} activeOpacity={0.7}>
              <Text style={styles.resetBtnText}>↺ Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const LINE_COLOR = 'rgba(255,255,255,0.12)';
const LINE_W     = 1.5;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  topGlowRed: {
    position: 'absolute', top: -100, right: -60,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#7B0000', opacity: 0.3,
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 16, marginBottom: 16,
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
  roundLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 1 },
  diffChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  diffChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 60 : 110,
    right: 16, zIndex: 999, borderRadius: 14, overflow: 'hidden',
    elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16,
    gap: 2,
  },
  dropRow: { paddingHorizontal: 18, paddingVertical: 12 },
  dropRowText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Scoreboard
  scoreboard: {
    flexDirection: 'row', alignItems: 'stretch',
    width: '100%', paddingHorizontal: 16, marginBottom: 12, gap: 8,
  },
  scoreCard: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: '#11112A',
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  scoreCardRight: {},
  scoreAvatar: { fontSize: 20, marginBottom: 2 },
  scoreName:   { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  scoreMarkX:  { color: '#4C9EFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  scoreMarkO:  { color: '#FF6B6B', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  scoreNum:    { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  drawBox:     { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  drawNum:     { color: '#FFD700', fontSize: 26, fontWeight: '800' },
  drawLabel:   { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },

  // Status
  statusBar: {
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statusText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  // Board
  boardWrap: {
    elevation: 20,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  board: {
    width: BOARD_W, height: BOARD_W,
    backgroundColor: '#0F0F25',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },

  // Grid lines
  line:   { position: 'absolute', backgroundColor: LINE_COLOR },
  vLine1: { left: CELL_S,     top: 0, width: LINE_W, height: BOARD_W },
  vLine2: { left: CELL_S * 2, top: 0, width: LINE_W, height: BOARD_W },
  hLine1: { top: CELL_S,     left: 0, height: LINE_W, width: BOARD_W },
  hLine2: { top: CELL_S * 2, left: 0, height: LINE_W, width: BOARD_W },

  // Cell
  cell: {
    flex: 1, margin: 2, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  winBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12, borderWidth: 2,
  },

  // X mark (two crossed bars)
  xWrap: { width: CELL_S * 0.44, height: CELL_S * 0.44, position: 'relative' },
  xBar: {
    position: 'absolute',
    width: CELL_S * 0.44,
    height: CELL_S * 0.1,
    borderRadius: CELL_S * 0.05,
    top: '45%',
    left: 0,
  },
  xBar1: { transform: [{ rotate: '45deg'  }] },
  xBar2: { transform: [{ rotate: '-45deg' }] },

  // O mark (ring)
  oRing: {
    width: CELL_S * 0.42, height: CELL_S * 0.42,
    borderRadius: CELL_S * 0.21,
    borderWidth: CELL_S * 0.08,
  },

  // Tap hint
  tapHint: { opacity: 0.18 },
  tapHintPlus: { color: '#FFFFFF', fontSize: 24, fontWeight: '200' },

  // Result banner
  resultBanner: {
    position: 'absolute', top: 0, left: 16, right: 16, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  resultCard: {
    borderRadius: 24, padding: 28,
    alignItems: 'center', width: '80%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    elevation: 20,
  },
  resultEmoji: { fontSize: 48, marginBottom: 8 },
  resultTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5 },
  nextBtn: { borderRadius: 24 },
  nextBtnGrad: { borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  nextBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 1 },

  // Bottom
  bottom: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendMark: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  legendText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  legendDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  resetBtn:   { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  resetBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
});

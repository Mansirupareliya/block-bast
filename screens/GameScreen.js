import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, StatusBar,
  Platform, Animated, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Board from '../components/Board';
import DraggablePiece from '../components/DraggablePiece';
import PieceView from '../components/PieceView';
import ScoreAnimation from '../components/ScoreAnimation';
import GameOverScreen from './GameOverScreen';
import {
  BOARD_SIZE, createEmptyBoard, getRandomPieces,
  canPlacePiece, placePiece, clearLines,
  calculateScore, countPieceCells, checkGameOver,
} from '../utils/gameLogic';

const { width: SW, height: SH } = Dimensions.get('window');
const CELL_SIZE    = Math.floor((SW - 32) / BOARD_SIZE);
const BOARD_OFFSET = 4;
const LIFT_Y       = 115;

export default function GameScreen({ onBack }) {
  const [board,        setBoard]        = useState(createEmptyBoard);
  const [pieces,       setPieces]       = useState(() => getRandomPieces(3));
  const [score,        setScore]        = useState(0);
  const [bestScore,    setBestScore]    = useState(0);
  const [combo,        setCombo]        = useState(0);
  const [ghostCells,   setGhostCells]   = useState([]);
  const [clearedCells, setClearedCells] = useState([]);
  const [scoreAnims,   setScoreAnims]   = useState([]);
  const [comboInfo,    setComboInfo]    = useState(null); // { text, count }
  const [isGameOver,   setIsGameOver]   = useState(false);
  const [dragging,     setDragging]     = useState(null);

  const scoreScale = useRef(new Animated.Value(1)).current;
  const comboScale = useRef(new Animated.Value(0)).current;
  const comboOp    = useRef(new Animated.Value(0)).current;
  const boardFlash = useRef(new Animated.Value(0)).current;

  const boardRef       = useRef(null);
  const containerRef   = useRef(null);
  const boardPagePos   = useRef({ x: 0, y: 0 });
  const containerPageY = useRef(0);
  const boardState     = useRef(board);
  const piecesState    = useRef(pieces);
  const comboRef       = useRef(combo);
  const scoreRef       = useRef(score);

  boardState.current = board;
  piecesState.current = pieces;
  comboRef.current   = combo;
  scoreRef.current   = score;

  const measureBoard = useCallback(() => {
    requestAnimationFrame(() => {
      boardRef.current?.measure((_x, _y, _w, _h, px, py) => { boardPagePos.current = { x: px, y: py }; });
      containerRef.current?.measure((_x, _y, _w, _h, _px, py) => { containerPageY.current = py; });
    });
  }, []);

  const getBoardCell = useCallback((pageX, pageY, shape) => {
    const { x: bx, y: by } = boardPagePos.current;
    const col = Math.round((pageX - (shape[0].length * CELL_SIZE) / 2 - bx - BOARD_OFFSET) / CELL_SIZE);
    const row = Math.round((pageY - LIFT_Y - (shape.length * CELL_SIZE) / 2 - by - BOARD_OFFSET) / CELL_SIZE);
    return { row, col };
  }, []);

  const calcGhost = useCallback((px, py, piece, board) => {
    const { row, col } = getBoardCell(px, py, piece.shape);
    if (!canPlacePiece(board, piece.shape, row, col)) return [];
    const cells = [];
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c]) cells.push({ r: row + r, c: col + c });
    return cells;
  }, [getBoardCell]);

  const handleDragStart = useCallback((idx, px, py) => {
    const piece = piecesState.current[idx];
    if (!piece) return;
    setDragging({ pieceIdx: idx, piece, pageX: px, pageY: py });
    setGhostCells(calcGhost(px, py, piece, boardState.current));
  }, [calcGhost]);

  const handleDragMove = useCallback((idx, px, py) => {
    const piece = piecesState.current[idx];
    if (!piece) return;
    setDragging(prev => prev ? { ...prev, pageX: px, pageY: py } : null);
    setGhostCells(calcGhost(px, py, piece, boardState.current));
  }, [calcGhost]);

  const handleDragEnd = useCallback((idx, px, py) => {
    setGhostCells([]);
    setDragging(null);
    const dragPiece = piecesState.current[idx];
    if (!dragPiece || px < 0) return;

    const { row, col } = getBoardCell(px, py, dragPiece.shape);
    const cur = boardState.current;
    if (!canPlacePiece(cur, dragPiece.shape, row, col)) return;

    const placed = placePiece(cur, dragPiece.shape, row, col, dragPiece.color);
    const { newBoard, clearedRows, clearedCols, linesCleared } = clearLines(placed);

    const newCombo = linesCleared > 0 ? comboRef.current + 1 : 0;
    const gained   = calculateScore(countPieceCells(dragPiece.shape), linesCleared, newCombo);
    const newScore = scoreRef.current + gained;

    setScore(newScore);
    setBestScore(prev => Math.max(prev, newScore));
    setCombo(newCombo);
    setBoard(newBoard);
    boardState.current = newBoard;

    // Score pulse
    Animated.sequence([
      Animated.spring(scoreScale, { toValue: 1.4, friction: 3, useNativeDriver: true }),
      Animated.spring(scoreScale, { toValue: 1,   friction: 5, useNativeDriver: true }),
    ]).start();

    // Floating score
    const ax = boardPagePos.current.x + (CELL_SIZE * BOARD_SIZE) / 2;
    const ay = boardPagePos.current.y - containerPageY.current + (CELL_SIZE * BOARD_SIZE) / 3;
    setScoreAnims(prev => [...prev, { id: Date.now(), score: gained, x: ax, y: ay }]);

    // Combo
    if (newCombo >= 2) {
      const labels = ['NICE!','GREAT!','AWESOME!','AMAZING!','INCREDIBLE!'];
      setComboInfo({ text: labels[Math.min(newCombo - 2, 4)], count: newCombo });
      comboScale.setValue(0); comboOp.setValue(0);
      Animated.parallel([
        Animated.spring(comboScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(comboOp,  { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(comboOp, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setComboInfo(null));
      }, 1100);
    }

    // Line clear flash
    if (linesCleared > 0) {
      const flash = [];
      clearedRows.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) flash.push({ r, c }); });
      clearedCols.forEach(cl => { for (let r = 0; r < BOARD_SIZE; r++) flash.push({ r, c: cl }); });
      setClearedCells(flash);
      boardFlash.setValue(1);
      Animated.timing(boardFlash, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      setTimeout(() => setClearedCells([]), 380);
    }

    const next = [...piecesState.current];
    next[idx] = null;
    const final = next.every(p => p === null) ? getRandomPieces(3) : next;
    setPieces(final);
    piecesState.current = final;

    if (checkGameOver(newBoard, final.filter(Boolean)))
      setTimeout(() => setIsGameOver(true), 500);
  }, [getBoardCell]);

  const handleRestart = useCallback(() => {
    const b = createEmptyBoard(), p = getRandomPieces(3);
    setBoard(b); boardState.current = b;
    setPieces(p); piecesState.current = p;
    setScore(0); setCombo(0);
    setGhostCells([]); setClearedCells([]);
    setScoreAnims([]); setComboInfo(null);
    setIsGameOver(false); setDragging(null);
  }, []);

  const overlayStyle = dragging ? {
    position: 'absolute',
    left: dragging.pageX - (dragging.piece.shape[0].length * CELL_SIZE) / 2,
    top:  dragging.pageY - containerPageY.current - LIFT_Y - (dragging.piece.shape.length * CELL_SIZE) / 2,
  } : null;

  const boardGlowOp = boardFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] });

  return (
    <View style={styles.root} ref={containerRef} onLayout={measureBoard} collapsable={false}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#080818' }]} />

      {/* Subtle top glow */}
      <View style={styles.topGlow} />

      <View style={{ height: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 6 : 50 }} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <View style={styles.backBtnInner}>
              <Text style={styles.backIcon}>‹</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Best score */}
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>👑</Text>
          <View>
            <Text style={styles.statLabel}>BEST</Text>
            <Text style={styles.statValue}>{bestScore.toLocaleString()}</Text>
          </View>
        </View>

        {/* Current score – centre */}
        <View style={styles.scoreMain}>
          <Text style={styles.scoreMainLabel}>SCORE</Text>
          <Animated.Text style={[styles.scoreMainValue, { transform: [{ scale: scoreScale }] }]}>
            {score.toLocaleString()}
          </Animated.Text>
        </View>

        {/* Combo counter */}
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>🔥</Text>
          <View>
            <Text style={styles.statLabel}>COMBO</Text>
            <Text style={styles.statValue}>×{combo}</Text>
          </View>
        </View>
      </View>

      {/* ── Combo banner ── */}
      <View style={styles.comboBannerWrap}>
        {comboInfo && (
          <Animated.View style={{ transform: [{ scale: comboScale }], opacity: comboOp }}>
            <LinearGradient colors={['#FF4444','#FF8C00','#FFD700']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.comboPill}>
              <Text style={styles.comboEmoji}>⚡</Text>
              <Text style={styles.comboLabel}>{comboInfo.text}</Text>
              <View style={styles.comboBadge}>
                <Text style={styles.comboBadgeText}>×{comboInfo.count}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </View>

      {/* ── Board ── */}
      <View style={styles.boardOuter}>
        {/* Board background with grid feel */}
        <View style={styles.boardBg}>
          <View ref={boardRef} collapsable={false} onLayout={measureBoard}>
            <Board board={board} ghostCells={ghostCells} highlightCells={clearedCells} cellSize={CELL_SIZE} />
          </View>
        </View>
        {/* Flash overlay on line clear */}
        <Animated.View style={[styles.flashOverlay, { opacity: boardGlowOp }]} pointerEvents="none" />
      </View>

      {/* Score animations */}
      {scoreAnims.map(a => (
        <ScoreAnimation key={a.id} score={a.score} x={a.x} y={a.y}
          onDone={() => setScoreAnims(prev => prev.filter(p => p.id !== a.id))} />
      ))}

      {/* ── Piece tray ── */}
      <View style={styles.tray}>
        <View style={styles.trayInner}>
          <View style={styles.trayHandle} />
          <View style={styles.piecesRow}>
            {pieces.map((piece, idx) => (
              <View key={idx} style={styles.pieceSlot}>
                <View style={[styles.slotBg, !piece && styles.slotEmpty]}>
                  {piece && (
                    <DraggablePiece
                      piece={piece} index={idx}
                      onDragStart={handleDragStart}
                      onDragMove={handleDragMove}
                      onDragEnd={handleDragEnd}
                      disabled={isGameOver}
                      isDragging={dragging?.pieceIdx === idx}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Drag overlay */}
      {dragging && (
        <View style={styles.dragOverlay} pointerEvents="none">
          <View style={overlayStyle}>
            <View style={[styles.dragShadow, {
              width:  dragging.piece.shape[0].length * CELL_SIZE,
              height: dragging.piece.shape.length * CELL_SIZE,
            }]} />
            <PieceView piece={dragging.piece} cellSize={CELL_SIZE} />
          </View>
        </View>
      )}

      {isGameOver && (
        <GameOverScreen score={score} bestScore={bestScore} onRestart={handleRestart} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, alignItems: 'center' },
  topGlow: {
    position: 'absolute', top: -80, left: SW / 2 - 140,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#1A1060', opacity: 0.7,
  },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', paddingHorizontal: 14, marginBottom: 6,
    justifyContent: 'space-between',
  },
  backBtn: { marginRight: 6 },
  backBtnInner: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#FFFFFF', fontSize: 24, lineHeight: 28 },

  statBox: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 70 },
  statIcon: { fontSize: 18 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  scoreMain: { alignItems: 'center' },
  scoreMainLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', letterSpacing: 2 },
  scoreMainValue: {
    color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: -0.5,
    textShadowColor: '#4C9EFF', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },

  // Combo
  comboBannerWrap: { height: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  comboPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8,
    gap: 6, elevation: 8,
    shadowColor: '#FF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8,
  },
  comboEmoji: { fontSize: 16 },
  comboLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  comboBadge: { backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  comboBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Board
  boardOuter: {
    borderRadius: 16,
    overflow: 'visible',
    elevation: 20,
    shadowColor: '#4C9EFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  boardBg: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(76,158,255,0.2)',
    overflow: 'hidden',
    backgroundColor: '#0D1B4B',
  },
  flashOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16, backgroundColor: '#FFD700',
    borderWidth: 3, borderColor: '#FFD700',
  },

  // Tray
  tray: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  trayInner: {
    width: '100%',
    backgroundColor: '#11112A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8, paddingBottom: 12, paddingHorizontal: 8,
  },
  trayHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 10,
  },
  piecesRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  pieceSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  slotBg: {
    minWidth: 76, minHeight: 84,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotEmpty: { borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.05)' },

  // Drag overlay
  dragOverlay: { position: 'absolute', top: 0, left: 0, width: SW, height: SH, zIndex: 9999 },
  dragShadow: { position: 'absolute', top: 8, left: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.3)' },
});

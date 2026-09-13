import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, StatusBar,
  Platform, Animated, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NEON } from '../utils/theme';
import Board from '../components/Board';
import GhostLayer from '../components/GhostLayer';
import DraggablePiece from '../components/DraggablePiece';
import PieceView from '../components/PieceView';
import ScoreAnimation from '../components/ScoreAnimation';
import GameOverScreen from './GameOverScreen';
import GameHeader, { STATUS_H } from '../components/GameHeader';
import {
  playClick, playTap, playSuccess, playFail,
} from '../utils/audioManager';
import {
  BOARD_SIZE, createEmptyBoard, getRandomPieces,
  canPlacePiece, placePiece, clearLines,
  calculateScore, countPieceCells, checkGameOver,
} from '../utils/gameLogic';

const { width: SW, height: SH } = Dimensions.get('window');
const CELL_SIZE    = Math.floor((SW - 32) / BOARD_SIZE);
const BOARD_OFFSET = 4;   // board padding(2) + borderWidth(2)
const PIECE_GAP    = 18;  // px gap between dragged-piece bottom and finger

// ── View-drawn trophy icon ────────────────────────────────────────────────
function TrophyIcon({ size = 22 }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Cup bowl */}
      <View style={{
        width: s * 0.64, height: s * 0.44,
        borderTopLeftRadius: s * 0.32, borderTopRightRadius: s * 0.32,
        borderBottomLeftRadius: s * 0.08, borderBottomRightRadius: s * 0.08,
        backgroundColor: '#FFD700',
        position: 'absolute', top: 0,
        borderWidth: 1.5, borderColor: '#FFB800',
      }} />
      {/* Handles left */}
      <View style={{
        position: 'absolute', left: 0, top: s * 0.06,
        width: s * 0.18, height: s * 0.28,
        borderTopLeftRadius: s * 0.14, borderBottomLeftRadius: s * 0.14,
        borderWidth: 2, borderColor: '#FFD700', borderRightWidth: 0,
      }} />
      {/* Handles right */}
      <View style={{
        position: 'absolute', right: 0, top: s * 0.06,
        width: s * 0.18, height: s * 0.28,
        borderTopRightRadius: s * 0.14, borderBottomRightRadius: s * 0.14,
        borderWidth: 2, borderColor: '#FFD700', borderLeftWidth: 0,
      }} />
      {/* Stem */}
      <View style={{
        position: 'absolute', bottom: s * 0.12, left: s * 0.38,
        width: s * 0.24, height: s * 0.22,
        backgroundColor: '#FFD700',
      }} />
      {/* Base */}
      <View style={{
        position: 'absolute', bottom: 0, left: s * 0.18,
        width: s * 0.64, height: s * 0.14,
        borderRadius: s * 0.04,
        backgroundColor: '#FFD700',
      }} />
    </View>
  );
}

// ── View-drawn crown icon ─────────────────────────────────────────────────
function CrownIcon({ size = 20 }) {
  const s = size;
  return (
    <View style={{ width: s, height: s * 0.7, justifyContent: 'flex-end' }}>
      {/* Base band */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: s * 0.3,
        backgroundColor: '#FFD700',
        borderRadius: s * 0.04,
        borderWidth: 1, borderColor: '#FFB800',
      }} />
      {/* Left spike */}
      <View style={{
        position: 'absolute', bottom: s * 0.28, left: s * 0.04,
        width: 0, height: 0,
        borderLeftWidth: s * 0.12, borderRightWidth: s * 0.12,
        borderBottomWidth: s * 0.38,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderBottomColor: '#FFD700',
      }} />
      {/* Center spike (taller) */}
      <View style={{
        position: 'absolute', bottom: s * 0.28, left: s * 0.38,
        width: 0, height: 0,
        borderLeftWidth: s * 0.12, borderRightWidth: s * 0.12,
        borderBottomWidth: s * 0.48,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderBottomColor: '#FFD700',
      }} />
      {/* Right spike */}
      <View style={{
        position: 'absolute', bottom: s * 0.28, right: s * 0.04,
        width: 0, height: 0,
        borderLeftWidth: s * 0.12, borderRightWidth: s * 0.12,
        borderBottomWidth: s * 0.38,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderBottomColor: '#FFD700',
      }} />
      {/* Crown gems */}
      <View style={{
        position: 'absolute', bottom: s * 0.06, left: s * 0.12,
        width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05,
        backgroundColor: '#FF4466',
      }} />
      <View style={{
        position: 'absolute', bottom: s * 0.06, left: s * 0.45,
        width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05,
        backgroundColor: '#4488FF',
      }} />
      <View style={{
        position: 'absolute', bottom: s * 0.06, right: s * 0.12,
        width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05,
        backgroundColor: '#44FF88',
      }} />
    </View>
  );
}

// ── View-drawn star icon ──────────────────────────────────────────────────
function StarIcon({ size = 24, filled = false }) {
  const s = size;
  // Simple 5-point star via a circle with an overlay — approximation
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Star body using rotated squares */}
      <View style={{
        width: s * 0.55, height: s * 0.55,
        backgroundColor: filled ? '#FFD700' : 'transparent',
        borderWidth: filled ? 0 : 2,
        borderColor: '#FFD700',
        transform: [{ rotate: '45deg' }],
        borderRadius: s * 0.06,
      }} />
      <View style={{
        position: 'absolute',
        width: s * 0.55, height: s * 0.55,
        backgroundColor: filled ? '#FFD700' : 'transparent',
        borderWidth: filled ? 0 : 2,
        borderColor: '#FFD700',
        borderRadius: s * 0.06,
      }} />
    </View>
  );
}

// ── Pause button icon ─────────────────────────────────────────────────────
function PauseIcon({ size = 16 }) {
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: size * 0.22 }}>
      <View style={{ width: size * 0.25, height: size * 0.7, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
      <View style={{ width: size * 0.25, height: size * 0.7, backgroundColor: '#FFFFFF', borderRadius: 2 }} />
    </View>
  );
}

export default function GameScreen({ onBack }) {
  const [board,        setBoard]        = useState(createEmptyBoard);
  const [pieces,       setPieces]       = useState(() => getRandomPieces(3));
  const [score,        setScore]        = useState(0);
  const [bestScore,    setBestScore]    = useState(0);
  const [combo,        setCombo]        = useState(0);
  const [ghostCells,   setGhostCells]   = useState([]);
  const [clearedCells, setClearedCells] = useState([]);
  const [scoreAnims,   setScoreAnims]   = useState([]);
  const [comboInfo,    setComboInfo]    = useState(null);
  const [isGameOver,   setIsGameOver]   = useState(false);
  const [dragging,     setDragging]     = useState(null);
  const [liked,        setLiked]        = useState(false);

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
  const dragPan        = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastGhost      = useRef({ row: -1, col: -1 });

  boardState.current  = board;
  piecesState.current = pieces;
  comboRef.current    = combo;
  scoreRef.current    = score;

  const measureBoard = useCallback(() => {
    requestAnimationFrame(() => {
      boardRef.current?.measure((_x, _y, _w, _h, px, py) => {
        boardPagePos.current = { x: px, y: py };
      });
      containerRef.current?.measure((_x, _y, _w, _h, _px, py) => {
        containerPageY.current = py;
      });
    });
  }, []);

  const getBoardCell = useCallback((pageX, pageY, shape) => {
    const { x: bx, y: by } = boardPagePos.current;
    const pieceW = shape[0].length * CELL_SIZE;
    const pieceH = shape.length    * CELL_SIZE;
    const col = Math.round((pageX - pieceW / 2 - bx - BOARD_OFFSET) / CELL_SIZE);
    const row = Math.round((pageY - pieceH - PIECE_GAP - by - BOARD_OFFSET) / CELL_SIZE);
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
    playTap();
    dragPan.setValue({ x: px, y: py });
    setDragging({ pieceIdx: idx, piece });

    lastGhost.current = { row: -1, col: -1 };
    setGhostCells(calcGhost(px, py, piece, boardState.current));
  }, [calcGhost, dragPan]);

  const handleDragMove = useCallback((idx, px, py) => {
    const piece = piecesState.current[idx];
    if (!piece) return;
    dragPan.setValue({ x: px, y: py });

    // Only update ghost cells if the grid position changed
    const { row, col } = getBoardCell(px, py, piece.shape);
    if (lastGhost.current.row !== row || lastGhost.current.col !== col) {
      lastGhost.current = { row, col };
      setGhostCells(calcGhost(px, py, piece, boardState.current));
    }
  }, [calcGhost, getBoardCell, dragPan]);

  const handleDragEnd = useCallback((idx, px, py) => {
    setGhostCells([]);
    setDragging(null);
    const dragPiece = piecesState.current[idx];
    if (!dragPiece || px < 0) return;

    const { row, col } = getBoardCell(px, py, dragPiece.shape);
    const cur = boardState.current;
    if (!canPlacePiece(cur, dragPiece.shape, row, col)) return;

    const placed = placePiece(cur, dragPiece.shape, row, col, dragPiece.color);
    playClick();
    const { newBoard, clearedRows, clearedCols, linesCleared } = clearLines(placed);

    const newCombo  = linesCleared > 0 ? comboRef.current + 1 : 0;
    const gained    = calculateScore(countPieceCells(dragPiece.shape), linesCleared, newCombo);
    const newScore  = scoreRef.current + gained;

    setScore(newScore);
    setBestScore(prev => Math.max(prev, newScore));
    setCombo(newCombo);
    setBoard(newBoard);
    boardState.current = newBoard;

    // Score pulse
    Animated.sequence([
      Animated.spring(scoreScale, { toValue: 1.35, friction: 3, useNativeDriver: true }),
      Animated.spring(scoreScale, { toValue: 1,    friction: 5, useNativeDriver: true }),
    ]).start();

    // Floating score badge
    const ax = boardPagePos.current.x + (CELL_SIZE * BOARD_SIZE) / 2;
    const ay = boardPagePos.current.y - containerPageY.current + (CELL_SIZE * BOARD_SIZE) / 3;
    setScoreAnims(prev => [...prev, { id: Date.now(), score: gained, x: ax, y: ay }]);

    // Combo banner
    if (newCombo >= 2) {
      const labels = ['NICE!','GREAT!','AWESOME!','AMAZING!','INCREDIBLE!'];
      setComboInfo({ text: labels[Math.min(newCombo - 2, 4)], count: newCombo });
      comboScale.setValue(0); comboOp.setValue(0);
      Animated.parallel([
        Animated.spring(comboScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(comboOp,  { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(comboOp, { toValue: 0, duration: 300, useNativeDriver: true })
          .start(() => setComboInfo(null));
      }, 1100);
    }

    // Line-clear flash
    if (linesCleared > 0) {
      playSuccess();
      const flash = [];
      clearedRows.forEach(r => { for (let c = 0; c < BOARD_SIZE; c++) flash.push({ r, c }); });
      clearedCols.forEach(cl => { for (let r = 0; r < BOARD_SIZE; r++) flash.push({ r, c: cl }); });
      setClearedCells(flash);
      boardFlash.setValue(1);
      Animated.timing(boardFlash, { toValue: 0, duration: 400, useNativeDriver: true }).start();
      setTimeout(() => setClearedCells([]), 380);
    }

    const next  = [...piecesState.current];
    next[idx]   = null;
    const final = next.every(p => p === null) ? getRandomPieces(3) : next;
    setPieces(final);
    piecesState.current = final;

    if (checkGameOver(newBoard, final.filter(Boolean))) {
      playFail();
      setTimeout(() => setIsGameOver(true), 500);
    }
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

  // Drag overlay follows the finger via `dragPan`, updated from
  // handleDragStart/handleDragMove as the piece is dragged.
  const getOverlayTransform = () => {
    if (!dragging) return [];
    const ox = (dragging.piece.shape[0].length * CELL_SIZE) / 2;
    const oy = containerPageY.current + (dragging.piece.shape.length * CELL_SIZE) + PIECE_GAP;
    return [
      { translateX: Animated.subtract(dragPan.x, ox) },
      { translateY: Animated.subtract(dragPan.y, oy) },
    ];
  };

  const boardGlowOp = boardFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] });

  return (
    <View style={styles.root} ref={containerRef} onLayout={measureBoard} collapsable={false}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      {/* ── Neon Arcade backdrop: near-black with glowing corner blobs ── */}
      <LinearGradient
        colors={['#14142E', '#0B0B1A', '#05050F']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowBlobCyan} />
      <View style={styles.glowBlobMagenta} />

      {/* Subtle top vignette for depth */}
      <View style={styles.topVignette} />

      {/* ── Header ── */}
      <GameHeader
        title="Block Blast"
        subtitle={`BEST: ${bestScore.toLocaleString()}`}
        accent="#FFD700"
        onBack={onBack}
        liked={liked}
        onLike={() => setLiked(l => !l)}
      />

      {/* ── Current score large display ── */}
      <Animated.Text style={[styles.bigScore, { transform: [{ scale: scoreScale }] }]}>
        {score.toLocaleString()}
      </Animated.Text>


      {/* ── Combo banner ── */}
      <View style={styles.comboBannerWrap}>
        {comboInfo && (
          <Animated.View style={{ transform: [{ scale: comboScale }], opacity: comboOp }}>
            <View style={styles.comboPill}>
              <Text style={styles.comboLabel}>Combo</Text>
              <Text style={styles.comboCount}>{comboInfo.count}</Text>
            </View>
          </Animated.View>
        )}
      </View>

      {/* ── Board ── */}
      <View style={styles.boardOuter}>
        <View style={styles.boardShadow}>
          <View ref={boardRef} collapsable={false} onLayout={measureBoard}>
            <Board
              board={board}
              highlightCells={clearedCells}
              cellSize={CELL_SIZE}
            />
            <GhostLayer ghostCells={ghostCells} cellSize={CELL_SIZE} dragKey={dragging} />
          </View>
        </View>
        <Animated.View
          style={[styles.flashOverlay, { opacity: boardGlowOp }]}
          pointerEvents="none"
        />
      </View>

      {/* ── Score badges ── */}
      {scoreAnims.map(a => (
        <ScoreAnimation
          key={a.id} score={a.score} x={a.x} y={a.y}
          onDone={() => setScoreAnims(prev => prev.filter(p => p.id !== a.id))}
        />
      ))}

      {/* ── Piece tray ── */}
      <View style={styles.tray}>
        <View style={styles.trayCard}>
          {/* Glass shine top line */}
          <View style={styles.trayShine} />
          <View style={styles.piecesRow}>
            {pieces.map((piece, idx) => (
              <View key={idx} style={styles.pieceSlot}>
                {piece ? (
                  <DraggablePiece
                    piece={piece}
                    index={idx}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    disabled={isGameOver}
                    isDragging={dragging?.pieceIdx === idx}
                  />
                ) : (
                  <View style={styles.emptySlot} />
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Drag overlay ── */}
      {dragging && (
        <View style={styles.dragOverlay} pointerEvents="none">
          <Animated.View style={{
            position: 'absolute',
            transform: getOverlayTransform(),
            // Floating shadow glow
            elevation: 24,
            shadowColor: NEON.cyan,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.85,
            shadowRadius: 20,
          }}>
            <PieceView piece={dragging.piece} cellSize={CELL_SIZE} />
          </Animated.View>
        </View>
      )}

      {/* ── Game over ── */}
      {isGameOver && (
        <GameOverScreen
          score={score}
          bestScore={bestScore}
          onRestart={handleRestart}
          onBack={onBack}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },

  topVignette: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 220,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  glowBlobCyan: {
    position: 'absolute', top: -80, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: NEON.cyan, opacity: 0.10,
  },
  glowBlobMagenta: {
    position: 'absolute', top: 120, right: -100,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: NEON.magenta, opacity: 0.08,
  },

  // ── Big score ──
  bigScore: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4,
    textShadowColor: NEON.cyan,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  // ── Combo banner ──
  comboBannerWrap: {
    height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  comboPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 24, paddingHorizontal: 28, paddingVertical: 8, gap: 10,
    backgroundColor: NEON.glassFill,
    borderWidth: 1.5,
    borderColor: NEON.magenta,
    elevation: 8,
    shadowColor: NEON.magenta, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 12,
  },
  comboLabel: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  comboCount: { color: NEON.cyan, fontSize: 24, fontWeight: '900', letterSpacing: -0.5,
    textShadowColor: NEON.cyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },

  // ── Board ──
  boardOuter: {
    elevation: 20,
    shadowColor: NEON.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    position: 'relative',
  },
  boardShadow: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: NEON.cyanDim,
  },
  flashOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 18, backgroundColor: NEON.cyan,
  },

  // ── Tray ──
  tray: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trayCard: {
    width: '100%',
    backgroundColor: NEON.glassFill,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: NEON.violetDim,
    paddingTop: 6,
    paddingBottom: 12,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  trayShine: {
    position: 'absolute',
    top: 0, left: 20, right: 20,
    height: 1.5,
    backgroundColor: NEON.violet,
    opacity: 0.4,
    borderRadius: 1,
  },
  piecesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 6,
  },
  pieceSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    width: 56, height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(139,44,255,0.06)',
    borderWidth: 1.5,
    borderColor: NEON.violetDim,
  },

  // ── Drag overlay ──
  dragOverlay: {
    position: 'absolute', top: 0, left: 0, width: SW, height: SH,
    zIndex: 9999,
  },
});

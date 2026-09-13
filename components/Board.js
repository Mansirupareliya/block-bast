import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { BOARD_SIZE } from '../utils/gameLogic';
import { NEON } from '../utils/theme';
import GemCell from './GemCell';

const CELL_BG   = NEON.bg2;
const CELL_LINE = 'rgba(0,240,255,0.08)';
const BOARD_BG  = NEON.bg1;

// ── Flash Cell (line clear) ───────────────────────────────────────────────
const FlashCell = memo(function FlashCell({ br }) {
  const fl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fl, { toValue: 1,   duration: 60,  useNativeDriver: false }),
      Animated.timing(fl, { toValue: 0.5, duration: 60,  useNativeDriver: false }),
      Animated.timing(fl, { toValue: 1,   duration: 60,  useNativeDriver: false }),
      Animated.timing(fl, { toValue: 0,   duration: 200, useNativeDriver: false }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, backgroundColor: '#FFFFFF', opacity: fl }}>
      <Animated.View style={{ position:'absolute', top:4, left:4, right:4, bottom:4, borderRadius: Math.max(2,br-3), backgroundColor: NEON.cyan, opacity: fl }} />
    </Animated.View>
  );
});

// ── Chunky Gem Bevel Block (matches reference art) ─────────────────────────
const BevelBlock = memo(function BevelBlock({ color, cs, br, isNew }) {
  const scaleAnim = useRef(new Animated.Value(isNew ? 0.3 : 1)).current;
  const opAnim    = useRef(new Animated.Value(isNew ? 0   : 1)).current;

  useEffect(() => {
    if (!isNew) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }),
      Animated.timing(opAnim,    { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  const g = 1.5; // grout gap between adjacent cubes
  const size = cs - g * 2;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: g, left: g, right: g, bottom: g,
      transform: [{ scale: scaleAnim }],
      opacity: opAnim,
    }}>
      <GemCell cs={size} color={color} />
    </Animated.View>
  );
});

// ── Board ─────────────────────────────────────────────────────────────────
// Memoized: the ghost/placement preview lives in a separate <GhostLayer>
// overlay (see GhostLayer.js) precisely so dragging a piece across the
// board never has to re-render these 64 cells — only the tiny ghost
// overlay updates as your finger crosses cell boundaries.
function Board({ board, highlightCells, cellSize }) {
  const cs = cellSize;
  const br = Math.max(7, Math.round(cs * 0.30));

  const prevBoardRef = useRef(board);
  const newCellsRef  = useRef({});

  // Detect freshly placed cells for spring-in animation
  const freshCells = {};
  if (board !== prevBoardRef.current) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] && !prevBoardRef.current?.[r]?.[c]) {
          freshCells[`${r}_${c}`] = true;
        }
      }
    }
    prevBoardRef.current = board;
    newCellsRef.current  = freshCells;
  } else {
    newCellsRef.current = {};
  }

  return (
    <View style={[styles.board, {
      width:  cs * BOARD_SIZE + 4,
      height: cs * BOARD_SIZE + 4,
    }]}>
      {board.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const isHighlight = highlightCells?.some(h => h.r === r && h.c === c);
            const isNew       = !!newCellsRef.current[`${r}_${c}`];

            return (
              <View key={c} style={[styles.cell, { width: cs, height: cs }]}>

                {/* ── Filled gem block ── */}
                {cell && !isHighlight && (
                  <BevelBlock color={cell} cs={cs} br={br} isNew={isNew} />
                )}

                {/* ── Line-clear flash (on top of gem) ── */}
                {isHighlight && (
                  <>
                    {cell && <BevelBlock color={cell} cs={cs} br={br} isNew={false} />}
                    <FlashCell br={br} />
                  </>
                )}

              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default memo(Board);

const styles = StyleSheet.create({
  board: {
    backgroundColor: BOARD_BG,
    borderRadius: 18,
    padding: 2,
    borderWidth: 2,
    borderColor: NEON.cyanDim,
  },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    borderColor: CELL_LINE,
    backgroundColor: CELL_BG,
    overflow: 'hidden',
  },
});

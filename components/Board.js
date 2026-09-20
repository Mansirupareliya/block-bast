import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { BOARD_SIZE } from '../utils/gameLogic';
import { THEME } from '../utils/blockBlastTheme';
import GemCell from './GemCell';

const CELL_BG   = THEME.cellBg;
const CELL_LINE = THEME.cellLine;
const BOARD_BG  = THEME.boardBg;

// ── Flash Cell (line clear) ───────────────────────────────────────────────
const FlashCell = memo(function FlashCell({ br }) {
  const fl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Opacity-only, so this can run fully on the UI thread. A multi-line
    // clear flashes up to 2x BOARD_SIZE of these at once — running them on
    // the JS thread (the old `useNativeDriver: false`) was the single
    // biggest source of stutter during a big clear.
    Animated.sequence([
      Animated.timing(fl, { toValue: 1,   duration: 60,  useNativeDriver: true }),
      Animated.timing(fl, { toValue: 0.5, duration: 60,  useNativeDriver: true }),
      Animated.timing(fl, { toValue: 1,   duration: 60,  useNativeDriver: true }),
      Animated.timing(fl, { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, backgroundColor: '#FFFFFF', opacity: fl }}>
      <Animated.View style={{ position:'absolute', top:4, left:4, right:4, bottom:4, borderRadius: Math.max(2,br-3), backgroundColor: THEME.gold, opacity: fl }} />
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
// Memoized so dragging a piece across the board doesn't re-render these
// 64 cells on every finger move (there's no placement-preview overlay
// anymore — removed per a later request — so this only re-renders on an
// actual board change: a piece placed, a line cleared, etc.).
function Board({ board, highlightCells, cellSize }) {
  const cs = cellSize;
  const br = Math.max(3, Math.round(cs * 0.1));

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
      // Outer box must fit the cs*BOARD_SIZE grid of fixed-width cells PLUS
      // this View's own padding(2) + borderWidth(4) on both sides — i.e.
      // 2*(2+4)=12. Keep this in sync with BOARD_OFFSET in GameScreen.js
      // (padding+borderWidth, same numbers) if either value here changes.
      width:  cs * BOARD_SIZE + 12,
      height: cs * BOARD_SIZE + 12,
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
    borderRadius: 20,
    padding: 2,
    borderWidth: 4,
    borderColor: THEME.boardBorder,
  },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    borderColor: CELL_LINE,
    backgroundColor: CELL_BG,
    overflow: 'hidden',
  },
});

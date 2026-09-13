import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { NEON } from '../utils/theme';

// 4px = Board.js's own `padding: 2` + `borderWidth: 2` — the inset from the
// board's outer edge to the top-left of cell (0,0). Kept in sync with the
// BOARD_OFFSET constant in GameScreen.js (same underlying geometry).
const BOARD_OFFSET = 4;

// ── Animated Ghost Cell — a single pulsing placement-preview cell ─────────
// Bright, clearly-visible cyan glow (not a subtle tint) with a soft outer
// bloom behind the crisp bordered box, so it reads instantly as "the piece
// will land here" rather than a faint smudge.
const GhostCell = memo(function GhostCell({ br }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const fOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] });
  const bOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const bloomOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });

  return (
    <View style={{ width: '100%', height: '100%' }} pointerEvents="none">
      {/* Soft outer bloom, bleeding past the cell into the board grout */}
      <Animated.View style={{
        position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
        borderRadius: br + 4, backgroundColor: NEON.cyan, opacity: bloomOp,
      }} />
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, backgroundColor: NEON.cyan, opacity: fOp }} />
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, borderWidth: 3, borderColor: NEON.cyan, opacity: bOp }} />
      <Animated.View style={{ position:'absolute', top:3, left:3, right:3, bottom:3, borderRadius: Math.max(2,br-3), borderWidth:1.5, borderColor:'rgba(255,255,255,0.95)', opacity: bOp }} />
    </View>
  );
});

// ── GhostLayer ────────────────────────────────────────────────────────────
// Renders the placement-preview cells as a small, isolated overlay on top
// of the board, positioned by plain arithmetic instead of going through
// Board's own per-cell render — the board's 64 (SVG-backed) cells never
// re-render while dragging, only this handful of ghost cells do.
//
// Cells are matched to stable slots *by index* (not by row/col) and glide
// to their new position with a short Animated.timing instead of being
// unmounted/remounted on every cell crossing — that remount-per-move was
// what made the old version look jumpy: each new cell restarted its pulse
// animation from scratch instead of continuing smoothly.
//
// `dragKey` should change (e.g. pass the `dragging` object) each time a new
// drag begins, so leftover positions from the previous drag aren't glided
// in from — they're dropped instantly instead.
function GhostLayer({ ghostCells, cellSize, dragKey }) {
  const posRefs      = useRef([]);
  const prevDragKey   = useRef(dragKey);

  if (dragKey !== prevDragKey.current) {
    posRefs.current = [];
    prevDragKey.current = dragKey;
  }

  const cells = ghostCells || [];

  // Synchronously ensure a stable Animated.ValueXY per slot, so the first
  // paint of a new ghost cell is already at the right spot (no fly-in).
  cells.forEach(({ r, c }, i) => {
    const x = BOARD_OFFSET + c * cellSize;
    const y = BOARD_OFFSET + r * cellSize;
    if (!posRefs.current[i]) {
      posRefs.current[i] = new Animated.ValueXY({ x, y });
    }
  });
  posRefs.current.length = cells.length;

  useEffect(() => {
    cells.forEach(({ r, c }, i) => {
      const x = BOARD_OFFSET + c * cellSize;
      const y = BOARD_OFFSET + r * cellSize;
      const pos = posRefs.current[i];
      if (!pos) return;
      Animated.timing(pos, {
        toValue: { x, y },
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostCells, cellSize]);

  if (cells.length === 0) return null;
  const br = Math.max(7, Math.round(cellSize * 0.30));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells.map((_, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: cellSize,
            height: cellSize,
            transform: posRefs.current[i].getTranslateTransform(),
          }}
        >
          <GhostCell br={br} />
        </Animated.View>
      ))}
    </View>
  );
}

export default memo(GhostLayer);

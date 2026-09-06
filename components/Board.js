import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { BOARD_SIZE } from '../utils/gameLogic';

// ── Classic Plastic Bevel Palette (Image 1 style) ────────────────────────
const BLOCK = {
  red:    { face:'#E83040', hi:'#FF8888', lo:'#7A1018', inner:'#F04050' },
  orange: { face:'#F07A00', hi:'#FFBB55', lo:'#7A3800', inner:'#FF9010' },
  yellow: { face:'#E8C200', hi:'#FFE84D', lo:'#7A5800', inner:'#FFD800' },
  green:  { face:'#30BB44', hi:'#70E87A', lo:'#0A5820', inner:'#40D055' },
  blue:   { face:'#2B80E0', hi:'#70BBFF', lo:'#0A3280', inner:'#3A90F0' },
  purple: { face:'#7744CC', hi:'#BB88FF', lo:'#300870', inner:'#8855DD' },
  cyan:   { face:'#00AACC', hi:'#55DDFF', lo:'#005566', inner:'#10C0E0' },
  pink:   { face:'#DD2288', hi:'#FF80CC', lo:'#6E0044', inner:'#EE3399' },
};
const FALLBACK = { face:'#5566AA', hi:'#8899CC', lo:'#223068', inner:'#6677BB' };

const CELL_BG   = '#1B2A5E';
const CELL_LINE = 'rgba(255,255,255,0.07)';
const BOARD_BG  = '#16224C';

// ── Animated Ghost Cell ───────────────────────────────────────────────────
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

  const borderOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const fillOp   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.22] });
  const innerOp  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const bOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const fOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.18] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, backgroundColor: 'rgba(100,200,255,1)', opacity: fOp }} />
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, borderWidth: 2.5, borderColor: 'rgba(80,200,255,1)', opacity: bOp }} />
      <Animated.View style={{ position:'absolute', top:3, left:3, right:3, bottom:3, borderRadius: Math.max(2,br-3), borderWidth:1.2, borderColor:'rgba(255,255,255,0.9)', opacity: bOp }} />
    </View>
  );
});

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
      <Animated.View style={{ position:'absolute', top:4, left:4, right:4, bottom:4, borderRadius: Math.max(2,br-3), backgroundColor:'#FFFB80', opacity: fl }} />
    </Animated.View>
  );
});

// ── Classic Chunky Bevel Block (Image 1 style) ────────────────────────────
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

  const b  = BLOCK[color] || FALLBACK;
  const bv = Math.max(3, Math.round(cs * 0.15));
  const g  = 2;

  return (
    <Animated.View style={{
      position: 'absolute',
      top: g, left: g, right: g, bottom: g,
      transform: [{ scale: scaleAnim }],
      opacity: opAnim,
    }}>
      {/* Dark shadow base (full cell) */}
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: br, backgroundColor: b.lo }} />

      {/* Main face — inset from bottom-right */}
      <View style={{ position:'absolute', top:0, left:0, right:bv, bottom:bv, borderRadius:br, backgroundColor:b.face }} />

      {/* Top highlight bevel */}
      <View style={{ position:'absolute', top:0, left:0, right:bv, height:bv, borderTopLeftRadius:br, borderTopRightRadius:Math.max(2,br-2), backgroundColor:b.hi }} />

      {/* Left highlight bevel */}
      <View style={{ position:'absolute', left:0, top:0, bottom:bv, width:bv, borderTopLeftRadius:br, borderBottomLeftRadius:Math.max(2,br-2), backgroundColor:b.hi }} />

      {/* Inner bright face */}
      <View style={{ position:'absolute', top:bv+1, left:bv+1, right:bv+2, bottom:bv+2, borderRadius:Math.max(2,br-bv), backgroundColor:b.inner }} />

      {/* Shine arc */}
      <View style={{ position:'absolute', top:bv+2, left:bv+3, right:bv+3, height:Math.max(4,Math.round(cs*0.18)), borderTopLeftRadius:Math.max(2,br-bv-1), borderTopRightRadius:Math.max(2,br-bv-1), backgroundColor:'rgba(255,255,255,0.28)' }} />

      {/* Specular dot */}
      <View style={{ position:'absolute', top:bv+3, left:bv+4, width:Math.max(4,Math.round(cs*0.20)), height:Math.max(3,Math.round(cs*0.13)), borderRadius:Math.max(2,Math.round(cs*0.07)), backgroundColor:'rgba(255,255,255,0.78)' }} />
    </Animated.View>
  );
});

// ── Board ─────────────────────────────────────────────────────────────────
export default function Board({ board, ghostCells, highlightCells, cellSize }) {
  const cs = cellSize;
  const br = Math.max(6, Math.round(cs * 0.24));

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
            const isGhost     = ghostCells?.some(g => g.r === r && g.c === c);
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

                {/* ── Ghost / placement preview (no dashed, pure glow) ── */}
                {isGhost && !cell && (
                  <GhostCell br={br} />
                )}

              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: BOARD_BG,
    borderRadius: 18,
    padding: 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    borderColor: CELL_LINE,
    backgroundColor: CELL_BG,
    overflow: 'hidden',
  },
});

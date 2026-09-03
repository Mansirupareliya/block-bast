import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BOARD_SIZE } from '../utils/gameLogic';

const CELL_COLORS = {
  red:    ['#FF6B6B', '#FF1744', '#C62828'],
  orange: ['#FFB347', '#FF8C00', '#E65100'],
  yellow: ['#FFE566', '#FFD700', '#F9A825'],
  green:  ['#69F0AE', '#00E676', '#1B5E20'],
  blue:   ['#64B5F6', '#2196F3', '#0D47A1'],
  purple: ['#CE93D8', '#AB47BC', '#4A148C'],
  cyan:   ['#80DEEA', '#00BCD4', '#006064'],
  pink:   ['#F48FB1', '#E91E63', '#880E4F'],
};

// borderWidth(2) + padding(2) = BOARD_OFFSET 4 used in GameScreen
export default function Board({ board, ghostCells, highlightCells, cellSize }) {
  const cs = cellSize;
  return (
    <View style={[styles.board, { width: cs * BOARD_SIZE + 4, height: cs * BOARD_SIZE + 4 }]}>
      {board.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const isGhost     = ghostCells     && ghostCells.some(g => g.r === r && g.c === c);
            const isHighlight = highlightCells && highlightCells.some(h => h.r === r && h.c === c);
            const cols = cell ? (CELL_COLORS[cell] || ['#B0BEC5','#78909C','#37474F']) : null;

            return (
              <View key={c} style={[styles.cell, { width: cs, height: cs }]}>

                {/* Filled block */}
                {cell && !isHighlight && (
                  <>
                    {/* base */}
                    <View style={[styles.base, { backgroundColor: cols[1] }]} />
                    {/* top face (lighter) */}
                    <View style={[styles.topFace, { backgroundColor: cols[0] }]} />
                    {/* bottom shadow (darker) */}
                    <View style={[styles.bottomShadow, { backgroundColor: cols[2] }]} />
                    {/* shine */}
                    <View style={styles.shine} />
                    {/* inner border glow */}
                    <View style={[styles.innerGlow, { borderColor: cols[0] + '55' }]} />
                  </>
                )}

                {/* Line-cleared flash */}
                {isHighlight && (
                  <>
                    <View style={styles.flashBase} />
                    <View style={styles.flashShine} />
                  </>
                )}

                {/* Ghost placement preview */}
                {isGhost && !cell && (
                  <View style={styles.ghost} />
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
    backgroundColor: '#0D1B4B',
    borderRadius: 12,
    padding: 2,
    borderWidth: 2,
    borderColor: '#1E3A8A',
  },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 0.5,
    borderColor: 'rgba(30,58,138,0.6)',
    backgroundColor: '#0D1B4B',
    overflow: 'hidden',
  },

  // filled block layers
  base: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 4,
  },
  topFace: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 4, borderRadius: 4,
  },
  bottomShadow: {
    position: 'absolute', bottom: 1, left: 1, right: 1, height: 4,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4, opacity: 0.9,
  },
  shine: {
    position: 'absolute', top: 2, left: 2, width: '50%', height: '38%',
    backgroundColor: 'rgba(255,255,255,0.42)', borderRadius: 3,
  },
  innerGlow: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 4, borderWidth: 1,
  },

  // flash
  flashBase: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 4, backgroundColor: '#FFF9C4',
  },
  flashShine: {
    position: 'absolute', top: 2, left: 2, width: '55%', height: '45%',
    borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)',
  },

  // ghost
  ghost: {
    position: 'absolute', top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
});

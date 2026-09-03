import React from 'react';
import { View } from 'react-native';

export const CELL_COLORS = {
  red:    ['#FF6B6B', '#FF1744', '#C62828'],
  orange: ['#FFB347', '#FF8C00', '#E65100'],
  yellow: ['#FFE566', '#FFD700', '#F9A825'],
  green:  ['#69F0AE', '#00E676', '#1B5E20'],
  blue:   ['#64B5F6', '#2196F3', '#0D47A1'],
  purple: ['#CE93D8', '#AB47BC', '#4A148C'],
  cyan:   ['#80DEEA', '#00BCD4', '#006064'],
  pink:   ['#F48FB1', '#E91E63', '#880E4F'],
};

export default function PieceView({ piece, cellSize, style }) {
  if (!piece) return null;
  const { shape, color } = piece;
  const cols = CELL_COLORS[color] || ['#B0BEC5','#78909C','#37474F'];
  const r = Math.max(3, Math.round(cellSize * 0.2));
  const sh = Math.max(2, Math.round(cellSize * 0.18));

  return (
    <View style={style}>
      {shape.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => (
            <View key={ci} style={{ width: cellSize, height: cellSize }}>
              {!!cell && (
                <>
                  <View style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: r, backgroundColor: cols[1] }} />
                  <View style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: sh, borderRadius: r, backgroundColor: cols[0] }} />
                  <View style={{ position: 'absolute', bottom: 1, left: 1, right: 1, height: sh, borderBottomLeftRadius: r, borderBottomRightRadius: r, backgroundColor: cols[2], opacity: 0.9 }} />
                  <View style={{ position: 'absolute', top: 2, left: 2, width: '50%', height: '38%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.44)' }} />
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

import React, { memo } from 'react';
import { View } from 'react-native';
import GemCell from './GemCell';

export default memo(function PieceView({ piece, cellSize, style }) {
  if (!piece) return null;
  const { shape, color } = piece;
  const g = 1.5; // grout gap, matches Board.js

  return (
    <View style={style}>
      {shape.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => (
            <View key={ci} style={{ width: cellSize, height: cellSize, overflow: 'hidden' }}>
              {!!cell && (
                <View style={{ position: 'absolute', top: g, left: g, right: g, bottom: g }}>
                  <GemCell cs={cellSize - g * 2} color={color} />
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

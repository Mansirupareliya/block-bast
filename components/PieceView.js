import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

// ── Classic Plastic Bevel Palette (must match Board.js) ────────────────────
export const BLOCK = {
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

// ── Single bevel cell (classic plastic style) ─────────────────────────────────
function BevelCell({ cs, b }) {
  const br = Math.max(4, Math.round(cs * 0.24));
  const bv = Math.max(3, Math.round(cs * 0.15));
  const g  = 2;

  return (
    <View style={{ position:'absolute', top:g, left:g, right:g, bottom:g }}>
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius:br, backgroundColor:b.lo }} />
      <View style={{ position:'absolute', top:0, left:0, right:bv, bottom:bv, borderRadius:br, backgroundColor:b.face }} />
      <View style={{ position:'absolute', top:0, left:0, right:bv, height:bv, borderTopLeftRadius:br, borderTopRightRadius:Math.max(2,br-2), backgroundColor:b.hi }} />
      <View style={{ position:'absolute', left:0, top:0, bottom:bv, width:bv, borderTopLeftRadius:br, borderBottomLeftRadius:Math.max(2,br-2), backgroundColor:b.hi }} />
      <View style={{ position:'absolute', top:bv+1, left:bv+1, right:bv+2, bottom:bv+2, borderRadius:Math.max(2,br-bv), backgroundColor:b.inner }} />
      <View style={{ position:'absolute', top:bv+2, left:bv+3, right:bv+3, height:Math.max(4,Math.round(cs*0.18)), borderTopLeftRadius:Math.max(2,br-bv-1), borderTopRightRadius:Math.max(2,br-bv-1), backgroundColor:'rgba(255,255,255,0.28)' }} />
      <View style={{ position:'absolute', top:bv+3, left:bv+4, width:Math.max(4,Math.round(cs*0.20)), height:Math.max(3,Math.round(cs*0.13)), borderRadius:Math.max(2,Math.round(cs*0.07)), backgroundColor:'rgba(255,255,255,0.78)' }} />
    </View>
  );
}

export default memo(function PieceView({ piece, cellSize, style }) {
  if (!piece) return null;
  const { shape, color } = piece;
  const b = BLOCK[color] || FALLBACK;

  return (
    <View style={style}>
      {shape.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((cell, ci) => (
            <View key={ci} style={{ width: cellSize, height: cellSize, overflow: 'hidden' }}>
              {!!cell && <BevelCell cs={cellSize} b={b} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});


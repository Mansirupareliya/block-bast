import React from 'react';
import { View } from 'react-native';

// ── Flat beveled block palette — matches the reference art: solid matte
// color faces (no diagonal gem-facet gradient, no neon glow), shared by
// Board.js and PieceView.js.
export const BLOCK = {
  red:    { face: '#C0413A', hi: '#DE7168', lo: '#7A211D' },
  orange: { face: '#D98A3D', hi: '#F0B06B', lo: '#8A4F1A' },
  yellow: { face: '#E0B23C', hi: '#F3D073', lo: '#8F6E18' },
  green:  { face: '#4C9A4C', hi: '#7FC57F', lo: '#2C5C2C' },
  blue:   { face: '#4C63B6', hi: '#8296D6', lo: '#2A3970' },
  purple: { face: '#9265AE', hi: '#BB98D0', lo: '#5C3A70' },
  cyan:   { face: '#4FAFCF', hi: '#87D3EA', lo: '#296C82' },
  pink:   { face: '#C24F8A', hi: '#E084B4', lo: '#7A2E57' },
};
export const FALLBACK = { face: '#6B7A99', hi: '#98A6C2', lo: '#404C66' };

// ── Flat beveled block — a solid color face with a light bevel edge on the
// top/left and a dark bevel edge on the bottom/right, giving a simple
// raised-button/pillow look (matches classic block-puzzle reference art)
// instead of the old faceted-jewel/neon-glow rendering. Plain Views only —
// no SVG needed for this style.
export default function GemCell({ cs, color, style }) {
  const b  = BLOCK[color] || FALLBACK;
  const br = Math.max(3, Math.round(cs * 0.1));
  const bw = Math.max(2, Math.round(cs * 0.12));

  return (
    <View
      style={[
        {
          width: cs, height: cs,
          borderRadius: br,
          backgroundColor: b.face,
          borderWidth: bw,
          borderTopColor: b.hi,
          borderLeftColor: b.hi,
          borderBottomColor: b.lo,
          borderRightColor: b.lo,
        },
        style,
      ]}
    />
  );
}

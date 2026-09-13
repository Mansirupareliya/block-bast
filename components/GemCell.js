import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, ClipPath, Rect, Polygon, Ellipse } from 'react-native-svg';
import { glow } from '../utils/theme';

// ── Neon jewel palette — shared by Board.js and PieceView.js ───────────
export const BLOCK = {
  red:    { face:'#FF1053', hi:'#FF6B81', lo:'#6B0027' },
  orange: { face:'#FF7A00', hi:'#FFB347', lo:'#7A3800' },
  yellow: { face:'#FFD500', hi:'#FFF066', lo:'#7A5800' },
  green:  { face:'#00E676', hi:'#6FFFA0', lo:'#0A5828' },
  blue:   { face:'#00B8FF', hi:'#6FD8FF', lo:'#073B7A' },
  purple: { face:'#8B2CFF', hi:'#C88BFF', lo:'#2E0A70' },
  cyan:   { face:'#00F0FF', hi:'#7FFFF3', lo:'#00565A' },
  pink:   { face:'#FF2EC4', hi:'#FF8FE0', lo:'#6E0058' },
};
export const FALLBACK = { face:'#5566AA', hi:'#8899CC', lo:'#223068' };

// ── Cushion-cut jewel: rounded square split on the diagonal into a lit
// facet (top-left) and a shadowed facet (bottom-right), plus a glossy
// highlight blob — mimics a faceted candy/gem cube rather than a flat
// gradient chip.
//
// The neon "glow" is drawn as a real bright SVG rim, not just a View
// shadow — Android mostly ignores `shadowColor` on elevation shadows, so a
// shadow-only glow reads as a faint grey smudge there. A rendered stroke
// looks identical (and vivid) on both platforms. The `glow()` shadow is
// kept as a bonus soft bloom for iOS, where it does work.
export default function GemCell({ cs, color, style }) {
  const b  = BLOCK[color] || FALLBACK;
  const br = Math.max(7, Math.round(cs * 0.30));

  return (
    <View style={[{ width: cs, height: cs }, glow(b.face, cs * 0.3, 0.9), style]}>
      <Svg width={cs} height={cs}>
        <Defs>
          <ClipPath id="clip">
            <Rect x={0} y={0} width={cs} height={cs} rx={br} ry={br} />
          </ClipPath>
          <LinearGradient id="top" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={b.hi} />
            <Stop offset="1" stopColor={b.face} />
          </LinearGradient>
          <LinearGradient id="bot" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={b.face} />
            <Stop offset="1" stopColor={b.lo} />
          </LinearGradient>
        </Defs>

        {/* Base fill (shows through as the rounded-corner backdrop) */}
        <Rect x={0} y={0} width={cs} height={cs} rx={br} ry={br} fill={b.lo} />

        {/* Top-left lit facet, cut on the diagonal */}
        <Polygon
          points={`0,0 ${cs},0 0,${cs}`}
          fill="url(#top)"
          clipPath="url(#clip)"
        />
        {/* Bottom-right shadow facet, cut on the diagonal */}
        <Polygon
          points={`${cs},0 ${cs},${cs} 0,${cs}`}
          fill="url(#bot)"
          clipPath="url(#clip)"
        />

        {/* Soft glossy highlight */}
        <Ellipse cx={cs * 0.32} cy={cs * 0.30} rx={cs * 0.20} ry={cs * 0.13} fill="#FFFFFF" opacity={0.35} clipPath="url(#clip)" />
        <Ellipse cx={cs * 0.26} cy={cs * 0.24} rx={cs * 0.09} ry={cs * 0.06} fill="#FFFFFF" opacity={0.75} clipPath="url(#clip)" />

        {/* Dark inner bezel for facet definition */}
        <Rect
          x={0.9} y={0.9} width={cs - 1.8} height={cs - 1.8}
          rx={Math.max(1, br - 1)} ry={Math.max(1, br - 1)}
          fill="none" stroke={b.lo} strokeOpacity={0.5} strokeWidth={1.2}
        />
        {/* Bright emissive rim — the actual "glow", rendered so it looks
            the same on Android as iOS instead of relying on shadowColor */}
        <Rect
          x={0} y={0} width={cs} height={cs}
          rx={br} ry={br}
          fill="none" stroke={b.hi} strokeOpacity={0.9} strokeWidth={cs * 0.05}
        />
      </Svg>
    </View>
  );
}

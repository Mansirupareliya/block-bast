// ── Neon Arcade theme ───────────────────────────────────────────────────
// Shared tokens so every screen reads as one cohesive, glowing
// cyberpunk-arcade look instead of each file inventing its own palette.
//
// Color language:
//   cyan    → primary interactive chrome (board, active tab, back button)
//   magenta → celebratory / urgent (combo, new record, liked heart)
//   violet  → secondary panels (tray, cards, badges)
//   gold    → score / trophies (kept distinct from the neon trio on purpose,
//             so treasure still reads as treasure against the glow)
export const NEON = {
  bg0: '#0B0B1A',   // app background (near-black)
  bg1: '#12122A',   // raised panel background (board, tray)
  bg2: '#181832',   // deeper inset background (empty board cell)
  glassFill:   'rgba(18,18,42,0.72)',
  glassBorder: 'rgba(139,44,255,0.35)',

  cyan:       '#00F0FF',
  cyanDim:    'rgba(0,240,255,0.65)',
  magenta:    '#FF2EC4',
  magentaDim: 'rgba(255,46,196,0.65)',
  violet:     '#8B2CFF',
  violetDim:  'rgba(139,44,255,0.6)',
  gold:       '#FFD700',

  textPrimary: '#FFFFFF',
  textDim:     'rgba(226,232,255,0.55)',
  textFaint:   'rgba(226,232,255,0.32)',
};

// Reusable colored glow — iOS only (shadowColor is ignored on Android
// elevation shadows, so there's nothing to gain there). Deliberately no
// `elevation` here: on Android, elevation also controls paint/stacking
// order at the OS compositor level — giving it to every board cell made
// nearby elevated gem cells render ON TOP of the ghost-preview overlay
// (which sits at elevation 0), hiding most of it. The real glow on
// Android comes from rendered strokes/borders instead (see GemCell.js).
export const glow = (color, radius = 10, opacity = 0.85) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

// A "glass" panel — frosted dark fill + a thin neon hairline border.
export const glassPanel = (borderColor = NEON.glassBorder) => ({
  backgroundColor: NEON.glassFill,
  borderWidth: 1.5,
  borderColor,
});

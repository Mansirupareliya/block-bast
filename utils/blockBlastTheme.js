// ── Block Blast: Bright Cartoon theme ───────────────────────────────────
// A separate palette from utils/theme.js (the dark "Neon Arcade" theme
// used by HomeScreen and other games) — Block Blast alone is being
// reskinned to a warm, playful, sunlit look, so its tokens live here
// rather than overwriting the shared NEON palette other screens depend on.
//
// Mirrors the cartoon language already used by the Matchmaker game
// (glossy gradient buttons, thick "candy" borders, warm cream panels) so
// both games feel like the same product family.
//
// Color language:
//   sky    → primary interactive chrome (back button, board glow)
//   coral  → celebratory / urgent (combo, new record, liked heart)
//   gold   → score / trophies / borders (the "candy shell" outline color)
//   cream  → panels, board, tray (the warm paper the game sits on)
export const THEME = {
  bgTop:    '#FFF3D6',  // backdrop gradient top
  bgMid:    '#FCE2A6',  // backdrop gradient middle
  bgBottom: '#F6CE7A',  // backdrop gradient bottom

  panel:       '#FFF6E4', // raised panel fill (tray card, score pill)
  panelBorder: '#B8722E',

  boardBg:     '#DCC29A', // board frame fill
  boardBorder: '#B8860B', // board frame border
  cellBg:      '#EFE0C4', // empty cell fill
  cellLine:    'rgba(122,74,24,0.14)',

  sky:      '#3FB6E8',
  skyDeep:  '#1E7FC2',
  coral:    '#FF5D8F',
  coralDim: 'rgba(255,93,143,0.5)',
  gold:     '#FFC93C',
  goldDeep: '#B9782E',
  brown:    '#7A4A18',

  textPrimary: '#5A3410',
  textDim:     'rgba(90,52,16,0.6)',
  textFaint:   'rgba(90,52,16,0.35)',
  textOnDark:  '#FFFFFF',
};

// Soft drop shadow — the cartoon-style analog of a glow, for a chunky
// "sitting above the page" look instead of a colored blur.
export const cartoonShadow = (color = '#000000', radius = 6, opacity = 0.22) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: Math.max(2, Math.round(radius / 2)),
});

// Custom fonts, loaded once in App.js before anything renders.
// QuickZap is used for every level number / "LEVEL N" label.
// NOTE: its license (assets/fonts/QuickZap-LICENSE.txt) is Freeware,
// Non-Commercial — buy a commercial license before shipping with ads.
export const FONT_FILES = {
  QuickZap: require('../assets/fonts/QuickZap.ttf'),
};

// Android picks a fallback system font when a custom family is combined
// with a fontWeight it doesn't have, so level-number styles drop fontWeight.
export const LEVEL_FONT = { fontFamily: 'QuickZap', fontWeight: 'normal' };

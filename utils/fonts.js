// Custom fonts, loaded once in App.js before anything renders.
// Lilita One is used for every level number / "LEVEL N" label.
// License: SIL Open Font License 1.1 (assets/fonts/LilitaOne-LICENSE.txt),
// free for commercial use, including apps with ads.
export const FONT_FILES = {
  LilitaOne: require('../assets/fonts/LilitaOne-Regular.ttf'),
};

// Android picks a fallback system font when a custom family is combined
// with a fontWeight it doesn't have, so level-number styles drop fontWeight.
export const LEVEL_FONT = { fontFamily: 'LilitaOne', fontWeight: 'normal' };

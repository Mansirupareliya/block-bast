let AudioModule = null;

try {
  // Try to require Audio dynamically so the app doesn't crash on startup
  // if the native module is missing in the user's dev client.
  AudioModule = require('expo-audio');
} catch (error) {
  console.warn('Audio module could not be loaded (Native module missing). Sounds disabled.', error);
}

// One-shot SFX (tap, click, success, fail): each call spins up its own
// short-lived player so overlapping taps (fast drag/drop) don't cut each
// other off, then frees the player once playback finishes.
//
// `rate` lets the same sample be reused for different-*feeling* effects
// (a quick fast "tick" vs a slower "thud") instead of just playing the
// identical clip again — useful when there's only one or two actual audio
// assets to work with. Playback rate is a method (`setPlaybackRate`), not
// an assignable property — `player.playbackRate = x` throws on-device
// ("has only a getter") even though the plain property looks writable in
// the type definitions.
const playSoundSafely = (assetPath, { volume = 1, rate = 1 } = {}) => {
  if (!AudioModule) return;
  try {
    const player = AudioModule.createAudioPlayer(assetPath);
    player.volume = volume;
    if (rate !== 1) {
      // Isolated so a rate-setting quirk on some platform/version still
      // lets the sound play normally instead of silently playing nothing.
      try { player.setPlaybackRate(rate, 'low'); } catch (rateError) {
        console.log('Could not set playback rate:', rateError);
      }
    }
    player.play();

    const cleanup = () => {
      try { player.remove(); } catch (error) { /* already removed */ }
    };
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        sub.remove();
        cleanup();
      }
    });
    // Safety net in case the native event never fires.
    setTimeout(cleanup, 3000);
  } catch (error) {
    console.log('Error playing sound:', error);
  }
};

export const playClick = () => {
  playSoundSafely(require('../assets/click.mp3'));
};

// Light tap sound for UI buttons / picking up a piece — same sample as
// playClick, kept as a distinct name so call sites read as intent.
export const playTap = () => {
  playSoundSafely(require('../assets/click.mp3'), { volume: 0.7 });
};

export const playSuccess = () => {
  playSoundSafely(require('../assets/win.mp3'));
};

export const playFail = () => {
  // Reuse click for fail if we don't have a distinct fail sound downloaded
  playSoundSafely(require('../assets/click.mp3'));
};

// ── Matchmaker-specific variants ─────────────────────────────────────────
// Same two samples, sped up/slowed down (and at different volumes) so
// each action in the memory-match game has a clearly distinct feel: a
// crisp, full-volume "tick" on flip; a light, quick "ding" on finding a
// pair; a fuller two-note fanfare on finishing the level; and a quieter,
// slowed-down "buzz" on a miss.
export const playFlip = () => {
  playSoundSafely(require('../assets/click.mp3'), { volume: 1, rate: 1.4 });
};

// A single pair match — light and quick, clearly separate from the bigger
// level-complete fanfare (playWin) even though both are built from win.mp3.
export const playMatch = () => {
  playSoundSafely(require('../assets/win.mp3'), { volume: 0.85, rate: 1.35 });
};

export const playMismatch = () => {
  playSoundSafely(require('../assets/click.mp3'), { volume: 0.55, rate: 0.6 });
};

// Level complete — a fuller two-note "ta-da" instead of a single chime,
// so finishing a level feels bigger than just matching one pair.
export const playWin = () => {
  playSoundSafely(require('../assets/win.mp3'), { volume: 1, rate: 0.85 });
  setTimeout(() => {
    playSoundSafely(require('../assets/win.mp3'), { volume: 1, rate: 1.2 });
  }, 160);
};

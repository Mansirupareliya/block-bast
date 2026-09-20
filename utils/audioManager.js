let AudioModule = null;

try {
  // Try to require Audio dynamically so the app doesn't crash on startup
  // if the native module is missing in the user's dev client.
  AudioModule = require('expo-audio');
} catch (error) {
  console.warn('Audio module could not be loaded (Native module missing). Sounds disabled.', error);
}

if (AudioModule) {
  // Explicit so SFX keep playing even with the ringer/silent switch on (iOS)
  // and never steal audio focus from anything else on the device.
  try {
    AudioModule.setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
  } catch (error) {
    console.log('Could not configure audio mode:', error);
  }
}

// One-shot SFX (tap, click, success, fail): rather than spinning up a new
// native AudioPlayer per call and tearing it down afterwards, each distinct
// asset gets a small persistent pool of players that are created once and
// reused for the lifetime of the app.
//
// Why: createAudioPlayer()/remove() churn was the actual bug behind "sound
// works once then goes silent forever". Teardown only happened once the
// `playbackStatusUpdate` listener reported `didJustFinish` (throttled to a
// default 500ms updateInterval, so short clips often missed it) or a 3s
// safety timeout fired — meaning many overlapping taps could pile up more
// live native players than the OS allows concurrently (especially on
// Android). Once that limit was hit, further createAudioPlayer()/play()
// calls started failing silently (caught below) and never recovered for
// the rest of the app session, including on every later screen/level.
// Reusing a fixed small set of players sidesteps that entirely.
const POOL_SIZE = 3;
const pools = new Map(); // assetPath (require() id) -> { players, index }

const getPool = (assetPath) => {
  let pool = pools.get(assetPath);
  if (pool) return pool;

  pool = { players: [], index: 0 };
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      pool.players.push(AudioModule.createAudioPlayer(assetPath));
    } catch (error) {
      console.log('Error creating audio player:', error);
    }
  }
  pools.set(assetPath, pool);
  return pool;
};

// `rate` lets the same sample be reused for different-*feeling* effects
// (a quick fast "tick" vs a slower "thud") instead of just playing the
// identical clip again — useful when there's only one or two actual audio
// assets to work with. Playback rate is a method (`setPlaybackRate`), not
// an assignable property — `player.playbackRate = x` throws on-device
// ("has only a getter") even though the plain property looks writable in
// the type definitions.
//
// Rate and volume are always (re)applied on every play, even when rate is
// the default 1 — since players are pooled/reused across call sites (e.g.
// click.mp3 backs playClick, playTap, playFail, playFlip and playMismatch,
// each at a different rate/volume), a reused player must not keep the
// previous caller's settings.
const playSoundSafely = (assetPath, { volume = 1, rate = 1 } = {}) => {
  if (!AudioModule) return;
  try {
    const pool = getPool(assetPath);
    if (!pool.players.length) return;

    const player = pool.players[pool.index];
    pool.index = (pool.index + 1) % pool.players.length;

    player.volume = volume;
    try {
      player.setPlaybackRate(rate, 'low');
    } catch (rateError) {
      // Isolated so a rate-setting quirk on some platform/version still
      // lets the sound play normally instead of silently playing nothing.
      console.log('Could not set playback rate:', rateError);
    }
    try {
      // Rewind before replaying — a pooled player left at end-of-track
      // from its previous play would otherwise play silence (or not
      // restart at all, depending on platform).
      const seekResult = player.seekTo(0);
      if (seekResult && typeof seekResult.catch === 'function') {
        seekResult.catch(() => {});
      }
    } catch (seekError) {
      console.log('Could not seek audio player:', seekError);
    }
    player.play();
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
// A dedicated camera-shutter-style "click" for flipping a card, so it reads
// as a distinct action from the generic UI tap/click sound used everywhere
// else in the app.
export const playFlip = () => {
  playSoundSafely(require('../assets/flip.wav'), { volume: 0.9 });
};

// A single pair match — a dedicated achievement-bell sample, clearly
// distinct from both the flip and the bigger level-complete fanfare
// (playWin, still win.mp3). playMismatch stays on click.mp3, slowed down
// for a dull "buzz".
export const playMatch = () => {
  playSoundSafely(require('../assets/match.wav'), { volume: 1 });
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

// Tapping a still-locked level tile — a short warning "denied" cue instead
// of just doing nothing, so the tap still feels acknowledged.
export const playLocked = () => {
  playSoundSafely(require('../assets/locked.wav'), { volume: 0.8 });
};

// ── Tic-Tac-Toe ───────────────────────────────────────────────────────────
// Placing an X or O — a soft typewriter-key click, distinct from the
// generic UI click/tap used everywhere else. Used for both the player's
// move and the AI's move.
export const playMark = () => {
  playSoundSafely(require('../assets/tictactoe_mark.wav'), { volume: 0.9 });
};

// A round won (X or O gets 3 in a row) — a dedicated win notification,
// distinct from the generic playSuccess() chime used elsewhere.
export const playTicTacToeWin = () => {
  playSoundSafely(require('../assets/tictactoe_win.wav'), { volume: 1 });
};

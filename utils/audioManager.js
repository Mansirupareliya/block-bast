let Audio = null;

try {
  // Try to require Audio dynamically so the app doesn't crash on startup 
  // if the native ExponentAV module is missing in the user's dev client.
  Audio = require('expo-av').Audio;
} catch (error) {
  console.warn('Audio module could not be loaded (Native module missing). Sounds disabled.', error);
}

const playSoundSafely = async (assetPath) => {
  if (!Audio) return;
  try {
    const { sound } = await Audio.Sound.createAsync(assetPath);
    await sound.playAsync();
    
    // Unload the sound from memory after it finishes playing to prevent leaks
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.log('Error playing sound:', error);
  }
};

export const playClick = () => {
  playSoundSafely(require('../assets/click.mp3'));
};

export const playSuccess = () => {
  playSoundSafely(require('../assets/win.mp3'));
};

export const playFail = () => {
  // Reuse click for fail if we don't have a distinct fail sound downloaded
  playSoundSafely(require('../assets/click.mp3'));
};

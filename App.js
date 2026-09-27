import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import HomeScreen        from './screens/HomeScreen';
import GameScreen        from './screens/GameScreen';
import TicTacToeScreen   from './screens/TicTacToeScreen';
import MemoryMatchScreen from './screens/MemoryMatchScreen';
import DogsBlocksScreen  from './screens/DogsBlocksScreen';
import BoxPusherScreen   from './screens/BoxPusherScreen';
import SettingsScreen    from './screens/SettingsScreen';
import AdBanner          from './components/AdBanner';
import { preloadInterstitial } from './utils/interstitialAd';
import { STORAGE_KEYS, loadJSON, saveJSON } from './utils/storage';
import { GAMES } from './utils/games';
import { loadStreak, recordPlay } from './utils/dailyStreak';
import { initMusic } from './utils/backgroundMusic';
import { useFonts } from 'expo-font';
import { FONT_FILES } from './utils/fonts';

// Every game gets a banner pinned under it. Home places its own banner and
// Matchmaker places one under its board, so they're not listed here.
const GAMES_WITH_BANNER = ['blockblast', 'tictactoe', 'dogsblocks', 'boxpusher'];

export default function App() {
  const [screen, setScreen] = useState('home');
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Favorited game ids, e.g. { blockblast: true }. Lives here (not in Home)
  // so it survives navigating between Home and Settings, and is persisted.
  const [likes, setLikes] = useState({});

  useEffect(() => {
    loadJSON(STORAGE_KEYS.FAVORITES, {}).then((saved) => setLikes(saved || {}));
  }, []);

  const toggleLike = (id) => {
    setLikes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveJSON(STORAGE_KEYS.FAVORITES, next);
      return next;
    });
  };

  useEffect(() => { loadStreak(); initMusic(); }, []);

  // Opening any game counts today toward the daily play streak.
  useEffect(() => {
    if (GAMES.some((g) => g.id === screen)) recordPlay();
  }, [screen]);

  useEffect(() => {
    mobileAds().initialize()
      .catch((e) => console.warn('[mobileAds] init failed:', e))
      .finally(preloadInterstitial);
  }, []);

  // Wait for the custom font (a split second) so level numbers never flash
  // in the system font; if it fails to load, carry on with the fallback.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        {screen === 'home'        && <HomeScreen        onSelect={setScreen} likes={likes} onToggleLike={toggleLike} />}
        {screen === 'blockblast'  && <GameScreen         onBack={() => setScreen('home')} />}
        {screen === 'tictactoe'   && <TicTacToeScreen    onBack={() => setScreen('home')} />}
        {screen === 'memorymatch' && <MemoryMatchScreen  onBack={() => setScreen('home')} />}
        {screen === 'dogsblocks'  && <DogsBlocksScreen   onBack={() => setScreen('home')} />}
        {screen === 'boxpusher'   && <BoxPusherScreen    onBack={() => setScreen('home')} />}
        {screen === 'settings'    && <SettingsScreen     onBack={() => setScreen('home')} onSelect={setScreen} likes={likes} onToggleLike={toggleLike} />}
      </View>
      {GAMES_WITH_BANNER.includes(screen) && <AdBanner />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

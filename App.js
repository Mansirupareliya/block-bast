import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import HomeScreen        from './screens/HomeScreen';
import GameScreen        from './screens/GameScreen';
import TicTacToeScreen   from './screens/TicTacToeScreen';
import MemoryMatchScreen from './screens/MemoryMatchScreen';

export default function App() {
  const [screen, setScreen] = useState('home');

  return (
    <GestureHandlerRootView style={styles.root}>
      {screen === 'home'        && <HomeScreen        onSelect={setScreen} />}
      {screen === 'blockblast'  && <GameScreen         onBack={() => setScreen('home')} />}
      {screen === 'tictactoe'   && <TicTacToeScreen    onBack={() => setScreen('home')} />}
      {screen === 'memorymatch' && <MemoryMatchScreen  onBack={() => setScreen('home')} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

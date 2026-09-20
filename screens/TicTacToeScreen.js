import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform, Image, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { checkWinner, getBestMove } from '../utils/tictactoeAI';
import { playTap, playMark, playTicTacToeWin } from '../utils/audioManager';

const { width: SW } = Dimensions.get('window');
const BOARD_W = SW - 64;
const CELL_S  = BOARD_W / 3;
const STATUS_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;

export default function TicTacToeScreen({ onBack }) {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'name_entry', 'playing'
  const [gameMode, setGameMode]   = useState('ai');   // 'ai', 'pvp'
  
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');

  const [board,        setBoard]        = useState(Array(9).fill(null));
  const [isXTurn,      setIsXTurn]      = useState(true);
  const [result,       setResult]       = useState(null);
  const [scores,       setScores]       = useState({ x: 0, o: 0, draw: 0 });
  const [thinking,     setThinking]     = useState(false);

  const cellScales = useRef(Array(9).fill(null).map(() => new Animated.Value(0))).current;
  const winPulse   = useRef(new Animated.Value(0)).current;

  const animateCell = (idx) => {
    cellScales[idx].setValue(0);
    Animated.spring(cellScales[idx], { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  };

  const showResult = () => {
    winPulse.setValue(0);
    Animated.loop(Animated.sequence([
      Animated.timing(winPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(winPulse, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]), { iterations: 6 }).start();
  };

  const applyResult = useCallback((res, prevScores) => {
    const s = { ...prevScores };
    if (res.winner === 'X')    s.x++;
    if (res.winner === 'O')    s.o++;
    if (res.winner === 'draw') s.draw++;
    setScores(s);
    setResult(res);
    showResult();
  }, []);

  const doComputerMove = useCallback((currentBoard, currentScores) => {
    setThinking(true);
    setTimeout(() => {
      const copy = [...currentBoard];
      const move = getBestMove(copy, 'medium');
      if (move === -1) { setThinking(false); return; }
      copy[move] = 'O';
      playMark();
      animateCell(move);
      setBoard(copy);
      setThinking(false);
      const res = checkWinner(copy);
      if (res) { 
        if (res.winner !== 'draw') playTicTacToeWin();
        applyResult(res, currentScores); 
      }
      else     { setIsXTurn(true); }
    }, 600 + Math.random() * 400);
  }, [applyResult]);

  const handleCell = useCallback((idx) => {
    // If cell taken, or game over, or AI is thinking, do nothing
    if (board[idx] || result || thinking) return;
    
    // In AI mode, if it's not player's turn, ignore
    if (gameMode === 'ai' && !isXTurn) return;

    const copy = [...board];
    const mark = isXTurn ? 'X' : 'O';
    copy[idx] = mark;
    playMark();
    animateCell(idx);
    setBoard(copy);
    
    const res = checkWinner(copy);
    if (res) { 
      if (res.winner !== 'draw') playTicTacToeWin();
      applyResult(res, scores); 
    } else { 
      const nextTurn = !isXTurn;
      setIsXTurn(nextTurn); 
      if (gameMode === 'ai' && !nextTurn) {
        doComputerMove(copy, scores);
      }
    }
  }, [isXTurn, board, result, thinking, scores, gameMode, applyResult, doComputerMove]);

  const restart = () => {
    setBoard(Array(9).fill(null));
    setResult(null);
    setIsXTurn(true);
    setThinking(false);
    cellScales.forEach(s => s.setValue(0));
    winPulse.setValue(0);
  };

  const startNameEntry = (mode) => {
    setGameMode(mode);
    if (mode === 'ai') {
      setP1Name('You');
      setP2Name('AI');
      setScores({ x: 0, o: 0, draw: 0 });
      setGameState('playing');
      restart();
    } else {
      setP1Name('Player 1');
      setP2Name('Player 2');
      setGameState('name_entry');
    }
  };

  const startGame = () => {
    setScores({ x: 0, o: 0, draw: 0 });
    setGameState('playing');
    restart();
  };

  // ── Render Menu ──────────────────────────────────────────────────────────
  if (gameState === 'menu') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Image source={require('../assets/jungle_bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={4} />
        <View style={styles.darkOverlay} />
        
        <View style={styles.menuBox}>
          <Text style={styles.menuTitle}>TIC TAC TOE</Text>
          <TouchableOpacity onPress={() => { playTap(); startNameEntry('ai'); }} style={styles.menuBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#4C9EFF','#0A55CC']} style={styles.menuBtnGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Text style={styles.menuBtnTxt}>Single Player (vs AI)</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { playTap(); startNameEntry('pvp'); }} style={styles.menuBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#FF6B6B','#AA0022']} style={styles.menuBtnGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Text style={styles.menuBtnTxt}>Play with Friend</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { playTap(); onBack(); }} style={{marginTop: 20}}>
            <Text style={{color: '#FFF', fontSize: 16, fontWeight: '700'}}>Back to Hub</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render Name Entry ────────────────────────────────────────────────────
  if (gameState === 'name_entry') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Image source={require('../assets/jungle_bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={4} />
        <View style={styles.darkOverlay} />
        
        <View style={styles.menuBox}>
          <Text style={styles.menuTitle}>Enter Names</Text>
          
          <Text style={styles.inputLabel}>Player 1 (X)</Text>
          <TextInput
            style={styles.input}
            value={p1Name}
            onChangeText={setP1Name}
            maxLength={12}
            placeholderTextColor="rgba(255,255,255,0.5)"
          />

          <Text style={styles.inputLabel}>Player 2 (O)</Text>
          <TextInput
            style={styles.input}
            value={p2Name}
            onChangeText={setP2Name}
            maxLength={12}
            placeholderTextColor="rgba(255,255,255,0.5)"
          />

          <TouchableOpacity onPress={() => { playTap(); startGame(); }} style={styles.menuBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#43A047','#2E7D32']} style={styles.menuBtnGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Text style={styles.menuBtnTxt}>Start Game</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { playTap(); setGameState('menu'); }} style={{marginTop: 20}}>
            <Text style={{color: '#FFF', fontSize: 16, fontWeight: '700'}}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render Game View ─────────────────────────────────────────────────────
  const renderCell = (idx) => {
    const val       = board[idx];
    const isWin     = result?.line?.includes(idx);
    const cellScale = cellScales[idx];
    const glowOp    = isWin ? winPulse : null;

    return (
      <TouchableOpacity
        key={idx}
        onPress={() => handleCell(idx)}
        activeOpacity={0.8}
        style={styles.cellBtn}
      >
        <View style={styles.cellInner}>
          {isWin && glowOp && (
            <Animated.View style={[StyleSheet.absoluteFill, styles.winBorder, { opacity: glowOp }]} />
          )}
          
          {val === 'X' && (
            <Animated.View style={{ transform: [{ scale: cellScale }] }}>
              <View style={styles.xWrap}>
                <View style={[styles.xBar, styles.xBar1]} />
                <View style={[styles.xBar, styles.xBar2]} />
              </View>
            </Animated.View>
          )}
          
          {val === 'O' && (
            <Animated.View style={{ transform: [{ scale: cellScale }] }}>
              <View style={styles.oRing} />
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background */}
      <Image source={require('../assets/jungle_bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={4} />
      <View style={styles.gameOverlay} />

      {/* Top Header Buttons */}
      <View style={[styles.topBar, { paddingTop: STATUS_H + 10 }]}>
        <TouchableOpacity onPress={() => { playTap(); setGameState('menu'); }} style={styles.iconBtn}>
          <Text style={styles.iconBtnTxt}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { playTap(); restart(); }} style={styles.iconBtn}>
          <Text style={[styles.iconBtnTxt, { fontSize: 22, marginTop: -2 }]}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Player Stats */}
      <View style={styles.statsRow}>
        {/* Player 1 (X) */}
        <View style={styles.playerCol}>
          <View style={[
            styles.playerCard, 
            { backgroundColor: 'rgba(255,255,255,0.1)' },
            isXTurn && !result && styles.activeCard
          ]}>
            <View style={styles.playerCardInner}>
              <View style={styles.playerInfoBox}>
                <Text style={styles.playerName} numberOfLines={1}>{p1Name}</Text>
                <Text style={styles.playerScore}>Win : {scores.x}</Text>
              </View>
              <Text style={styles.playerSymbolX}>X</Text>
            </View>
          </View>
          {isXTurn && !result && <Text style={styles.turnLabel}>Your Turn</Text>}
        </View>

        <View style={{ width: 16 }} />

        {/* Player 2 (O) */}
        <View style={styles.playerCol}>
          <View style={[
            styles.playerCard, 
            { backgroundColor: 'rgba(255,255,255,0.1)' },
            !isXTurn && !result && styles.activeCard
          ]}>
            <View style={styles.playerCardInner}>
              <View style={styles.playerInfoBox}>
                <Text style={styles.playerName} numberOfLines={1}>{p2Name}</Text>
                <Text style={styles.playerScore}>Win : {scores.o}</Text>
              </View>
              <Text style={styles.playerSymbolO}>O</Text>
            </View>
          </View>
          {!isXTurn && !result && <Text style={styles.turnLabel}>{gameMode === 'ai' ? 'AI Turn' : 'Your Turn'}</Text>}
        </View>
      </View>

      {/* Center Board */}
      <View style={styles.boardArea}>
        <View style={styles.boardBg}>
          <View style={[styles.line, styles.vLine1]} />
          <View style={[styles.line, styles.vLine2]} />
          <View style={[styles.line, styles.hLine1]} />
          <View style={[styles.line, styles.hLine2]} />
          
          {[0, 1, 2].map(row => (
            <View key={row} style={{ flexDirection: 'row' }}>
              {[0, 1, 2].map(col => renderCell(row * 3 + col))}
            </View>
          ))}
        </View>
      </View>

      {/* Result Overlay */}
      {result && (
        <View style={styles.resultBanner}>
          <Text style={styles.resultText}>
            {result.winner === 'X' ? `${p1Name} Wins!` : result.winner === 'O' ? `${p2Name} Wins!` : "It's a Draw!"}
          </Text>
          <TouchableOpacity onPress={() => { playTap(); restart(); }} style={styles.nextBtn}>
            <LinearGradient colors={['#43A047','#2E7D32']} style={styles.nextBtnGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
              <Text style={styles.nextBtnTxt}>Next Round</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const LINE_COLOR = 'rgba(255,255,255,0.15)';
const LINE_W     = 2;

const styles = StyleSheet.create({
  root: { flex: 1 },
  darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  gameOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  
  // ── Menu / Name Entry ──
  menuBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 30,
  },
  menuTitle: {
    color: '#FFF', fontSize: 36, fontWeight: '900', marginBottom: 40,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  menuBtn: { width: '100%', marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  menuBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  menuBtnTxt: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  
  inputLabel: { alignSelf: 'flex-start', color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 6, marginLeft: 4 },
  input: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)'
  },

  // ── Game UI ──
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 30,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnTxt: { color: '#FFF', fontSize: 30, lineHeight: 34, fontWeight: '700', marginLeft: -2 },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: 20,
    marginBottom: 40,
  },
  playerCol: { flex: 1, alignItems: 'center' },
  playerCard: {
    width: '100%', borderRadius: 16,
    borderWidth: 3, borderColor: 'transparent',
    overflow: 'hidden', padding: 8,
  },
  activeCard: {
    borderColor: '#00E676',
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
  },
  playerCardInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  playerInfoBox: { flex: 1 },
  playerName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  playerScore: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', marginTop: 2 },
  playerSymbolX: { color: '#29B6F6', fontSize: 24, fontWeight: '900', marginRight: 4 },
  playerSymbolO: { color: '#FFA726', fontSize: 24, fontWeight: '900', marginRight: 4 },
  turnLabel: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 8, textShadowColor: '#000', textShadowRadius: 4 },

  boardArea: {
    alignItems: 'center', justifyContent: 'center',
  },
  boardBg: {
    width: BOARD_W, height: BOARD_W,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 24,
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20,
    overflow: 'hidden',
  },

  line:   { position: 'absolute', backgroundColor: LINE_COLOR, borderRadius: 2 },
  vLine1: { left: CELL_S, top: 12, width: LINE_W, height: BOARD_W - 24 },
  vLine2: { left: CELL_S * 2, top: 12, width: LINE_W, height: BOARD_W - 24 },
  hLine1: { top: CELL_S, left: 12, height: LINE_W, width: BOARD_W - 24 },
  hLine2: { top: CELL_S * 2, left: 12, height: LINE_W, width: BOARD_W - 24 },

  cellBtn: { width: CELL_S, height: CELL_S, alignItems: 'center', justifyContent: 'center' },
  cellInner: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  
  winBorder: {
    position: 'absolute', top: 8, left: 8, right: 8, bottom: 8,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)',
  },

  xWrap: { width: CELL_S * 0.5, height: CELL_S * 0.5, position: 'relative' },
  xBar: {
    position: 'absolute',
    width: CELL_S * 0.65, height: CELL_S * 0.18,
    borderRadius: CELL_S * 0.09,
    backgroundColor: '#29B6F6',
    top: '41%', left: '-8%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 4,
  },
  xBar1: { transform: [{ rotate: '45deg'  }] },
  xBar2: { transform: [{ rotate: '-45deg' }] },
  
  oRing: {
    width: CELL_S * 0.55, height: CELL_S * 0.55,
    borderRadius: CELL_S * 0.275,
    borderWidth: CELL_S * 0.16, borderColor: '#FFA726',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 2, elevation: 4,
  },

  resultBanner: {
    position: 'absolute', bottom: 80, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 20,
    padding: 24, alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  resultText: { color: '#FFF', fontSize: 24, fontWeight: '900', marginBottom: 20 },
  nextBtn: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  nextBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  nextBtnTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});

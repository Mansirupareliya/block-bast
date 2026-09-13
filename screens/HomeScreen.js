import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform,
  ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap } from '../utils/audioManager';
import { NEON } from '../utils/theme';

const { width: SW } = Dimensions.get('window');

// ── Game catalogue ────────────────────────────────────────────────────────
const GAMES = [
  {
    id: 'blockblast',
    name: 'Block Blast',
    category: 'PUZZLE',
    accent: '#1E80F0',
    gradientColors: ['#60B8FF', '#1E80F0', '#0A55CC'],
    image: require('../assets/blockblast_logo.jpg'),
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    category: 'STRATEGY',
    accent: '#EE2244',
    gradientColors: ['#FF7070', '#EE2244', '#AA0022'],
    image: require('../assets/tictactoe_logo.jpg'),
  },
  {
    id: 'memorymatch',
    name: 'Matchmaker',
    category: 'MEMORY',
    accent: '#FFB800',
    gradientColors: ['#FFD52E', '#FFB800', '#F29900'],
    image: require('../assets/memorymatch_logo.jpg'),
  },
  {
    id: 'dogsblocks',
    name: 'Dogs Blocks',
    category: 'PUZZLE',
    accent: '#C68642',
    gradientColors: ['#F0C080', '#E8A045', '#C68642'],
    image: require('../assets/dogsblocks_logo.jpg'),
  },
];


// ── Game tile ─────────────────────────────────────────────────────────────
const COLS      = 2;
const TILE_GAP  = 16;
const TILE_W    = (SW - 32 - TILE_GAP * (COLS - 1)) / COLS;
const TILE_H    = TILE_W * 1.3;

function GameTile({ game, onPress, liked, onLike, enterAnim }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(pressScale, { toValue: 0.94, friction: 8, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(pressScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ width: TILE_W }, enterAnim]}>
      <TouchableOpacity
        onPress={() => { playTap(); onPress(game.id); }}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
      >
        <Animated.View style={[
          styles.tile,
          { borderColor: game.accent + '55', shadowColor: game.accent },
          { transform: [{ scale: pressScale }] },
        ]}>

          {/* Game image fills the art area */}
          <View style={styles.tileArt}>
            <Image
              source={game.image}
              style={styles.tileImage}
              resizeMode="cover"
            />
            {/* Heart button top-right */}
            <TouchableOpacity
              onPress={() => { playTap(); onLike(game.id); }}
              style={styles.heartBtn}
              activeOpacity={0.8}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <View style={[styles.heartPill, liked && { borderColor: NEON.magenta }]}>
                <Text style={[styles.heartIcon, { color: liked ? NEON.magenta : 'rgba(255,255,255,0.6)' }]}>
                  {liked ? '♥' : '♡'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* White info row */}
          <View style={styles.tileInfo}>
            <Text style={styles.tileName} numberOfLines={2}>{game.name}</Text>
            <View style={[styles.tileBadge, { backgroundColor: game.accent + '15' }]}>
              <Text style={[styles.tileCat, { color: game.accent }]}>{game.category}</Text>
            </View>
          </View>

        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── HomeScreen ────────────────────────────────────────────────────────────
export default function HomeScreen({ onSelect }) {
  const [tab,    setTab]    = useState('all');    // 'all' | 'favorites'
  const [likes,  setLikes]  = useState({});

  const headerY  = useRef(new Animated.Value(-20)).current;
  const headerO  = useRef(new Animated.Value(0)).current;
  const tileAnims = useRef(GAMES.map(() => ({
    y: new Animated.Value(30),
    o: new Animated.Value(0),
  }))).current;
  const dotBlink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(headerO, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.stagger(100, tileAnims.map(a =>
      Animated.parallel([
        Animated.spring(a.y, { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(a.o, { toValue: 1, duration: 380, useNativeDriver: true }),
      ])
    )).start();

    Animated.loop(Animated.sequence([
      Animated.timing(dotBlink, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      Animated.timing(dotBlink, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  const toggleLike = (id) => {
    setLikes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const displayed = tab === 'favorites'
    ? GAMES.filter(g => likes[g.id])
    : GAMES;

  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      {/* Neon Arcade backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: NEON.bg0 }]} />

      {/* Glowing ambient blobs */}
      <View style={styles.blobBlue} />
      <View style={styles.blobPurple} />

      {/* Status bar spacer */}
      <View style={{ height: statusH }} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerO, transform: [{ translateY: headerY }] }]}>


        {/* ── Tab bar: All Games / Favorites ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'all' && styles.tabActive]}
            onPress={() => { playTap(); setTab('all'); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTxt, tab === 'all' && styles.tabTxtActive]}>All Games</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, tab === 'favorites' && styles.tabActive]}
            onPress={() => { playTap(); setTab('favorites'); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTxt, tab === 'favorites' && styles.tabTxtActive]}>
              Favorites {Object.values(likes).filter(Boolean).length > 0
                ? `(${Object.values(likes).filter(Boolean).length})`
                : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Game grid ── */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {displayed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>♡</Text>
            <Text style={styles.emptyTitle}>No Favorites Yet</Text>
            <Text style={styles.emptySub}>Tap ♡ on any game to add it here</Text>
          </View>
        ) : (
          <View style={styles.gridRow}>
            {displayed.map((game, idx) => (
              <GameTile
                key={game.id}
                game={game}
                onPress={onSelect}
                liked={!!likes[game.id]}
                onLike={toggleLike}
                enterAnim={{
                  opacity: tileAnims[idx]?.o ?? 1,
                  transform: [{ translateY: tileAnims[idx]?.y ?? 0 }],
                }}
              />
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerTxt}>Tap any game to start playing</Text>
          <View style={styles.footerDot} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Glowing ambient blobs
  blobBlue: {
    position: 'absolute', top: -100, left: SW / 2 - 150,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: NEON.cyan, opacity: 0.10,
  },
  blobPurple: {
    position: 'absolute', top: -50, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: NEON.magenta, opacity: 0.09,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: NEON.glassFill,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: NEON.violetDim,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(0,240,255,0.12)',
    borderWidth: 1,
    borderColor: NEON.cyan,
    shadowColor: NEON.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 2,
  },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: NEON.textDim },
  tabTxtActive: { color: '#FFFFFF', fontWeight: '700' },

  // ── Game grid ──
  grid:    { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },

  // ── Game tile ──
  tile: {
    width: TILE_W,
    backgroundColor: NEON.glassFill,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    elevation: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    marginBottom: 0,
  },
  tileArt: {
    height: TILE_H * 0.62,
    overflow: 'hidden',
    backgroundColor: NEON.bg2,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute', top: 7, right: 7,
  },
  heartPill: {
    width: 28, height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,15,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heartIcon: {
    fontSize: 15,
    lineHeight: 18,
  },
  tileInfo: {
    padding: 9,
    backgroundColor: 'transparent',
  },
  tileName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.1,
    marginBottom: 5,
  },
  tileBadge: {
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tileCat: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // ── Empty state ──
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyIcon:  { fontSize: 52, color: NEON.violetDim, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: NEON.textDim, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: NEON.textFaint, textAlign: 'center' },

  // ── Footer ──
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, gap: 10,
  },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: NEON.violetDim },
  footerTxt: { color: NEON.textFaint, fontSize: 12, letterSpacing: 0.4 },
});

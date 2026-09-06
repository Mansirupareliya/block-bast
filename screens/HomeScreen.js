import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform,
  ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
        onPress={() => onPress(game.id)}
        onPressIn={onIn}
        onPressOut={onOut}
        activeOpacity={1}
      >
        <Animated.View style={[styles.tile, { transform: [{ scale: pressScale }] }]}>

          {/* Game image fills the art area */}
          <View style={styles.tileArt}>
            <Image
              source={game.image}
              style={styles.tileImage}
              resizeMode="cover"
            />
            {/* Heart button top-right */}
            <TouchableOpacity
              onPress={() => onLike(game.id)}
              style={styles.heartBtn}
              activeOpacity={0.8}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <View style={[styles.heartPill, { backgroundColor: liked ? '#FF446622' : 'rgba(255,255,255,0.85)' }]}>
                <Text style={[styles.heartIcon, { color: liked ? '#FF4466' : '#AAAAAA' }]}>
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
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      {/* White background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F7F9FF' }]} />

      {/* Subtle soft blobs */}
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
            onPress={() => setTab('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTxt, tab === 'all' && styles.tabTxtActive]}>All Games</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, tab === 'favorites' && styles.tabActive]}
            onPress={() => setTab('favorites')}
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

  // Background blobs
  blobBlue: {
    position: 'absolute', top: -100, left: SW / 2 - 150,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: '#DBEAFE', opacity: 0.7,
  },
  blobPurple: {
    position: 'absolute', top: -50, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: '#EDE9FE', opacity: 0.6,
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  liveBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4C9EFF', marginRight: 6 },
  liveTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 2.5, color: '#9CA3AF' },

  headline: { fontSize: 32, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },
  accentWord: {
    color: '#4C9EFF',
    textShadowColor: 'rgba(76,158,255,0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },

  // Trophy button
  trophyBtn: {
    marginTop: 4,
    borderRadius: 16, overflow: 'hidden',
    elevation: 4,
    shadowColor: '#FFB800', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6,
  },
  trophyGrad: {
    width: 48, height: 48,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  cupBowl: {
    position: 'absolute', top: 8, left: 10, right: 10, height: 16,
    backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 8,
  },
  cupStem: {
    position: 'absolute', top: 24, left: 20, right: 20, height: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  cupBase: {
    position: 'absolute', bottom: 8, left: 10, right: 10, height: 5,
    backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 3,
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ECEEF5',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTxtActive: { color: '#111827', fontWeight: '700' },

  // ── Game grid ──
  grid:    { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP },

  // ── Game tile ──
  tile: {
    width: TILE_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    marginBottom: 0,
  },
  tileArt: {
    height: TILE_H * 0.62,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  heartIcon: {
    fontSize: 15,
    lineHeight: 18,
  },
  tileInfo: {
    padding: 9,
    backgroundColor: '#FFFFFF',
  },
  tileName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
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
  emptyIcon:  { fontSize: 52, color: '#E5E7EB', marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  emptySub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },

  // ── Footer ──
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, gap: 10,
  },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)' },
  footerTxt: { color: '#9CA3AF', fontSize: 12, letterSpacing: 0.4 },
});

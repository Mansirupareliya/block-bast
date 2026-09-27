import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet,
  StatusBar, Platform, KeyboardAvoidingView, ScrollView, Image, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap } from '../utils/audioManager';
import { getPlayerName, setPlayerName, sanitizeName, MAX_NAME_LENGTH } from '../utils/playerIdentity';
import { STORAGE_KEYS, loadNumber } from '../utils/storage';
import { submitProgress } from '../utils/leaderboardService';
import { GAMES } from '../utils/games';
import BackButton from '../components/BackButton';

// ── Cartoon game palette ──────────────────────────────────────────────────
const C = {
  bgTop: '#3A22B8', bgMid: '#24187A', bgBottom: '#120C45',
  cream: '#FFF6E4', creamEdge: '#E2C99A', brown: '#7A4A18', brownDim: '#A07A4E',
  stroke: '#2A1060',
  green: '#4CD964', greenDark: '#249A3A',
  pink: '#FF4FA3', pinkDark: '#C21F72',
  orange: '#FFA62B', orangeDark: '#C9700A',
  yellow: '#FFD23F',
};

// RN Text has no stroke, so the outline is faked by stacking the same
// string in the outline color at small offsets behind the colored text.
function BubbleText({ children, size = 28, color = C.yellow, stroke = C.stroke }) {
  const d = Math.max(1.5, size / 14);
  const offsets = [[-d, -d], [d, -d], [-d, d], [d, d], [0, d * 1.6]];
  const base = { fontSize: size, fontWeight: '900', textAlign: 'center', letterSpacing: 1 };
  return (
    <View>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, right: -dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

// Chunky 3D candy button: a darker "base" peeks out underneath the face and
// the face sinks into it while pressed.
function ChunkyButton({ face, base, onPress, disabled, radius = 22, style, children }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed }) => (
        <View style={[
          { backgroundColor: base, borderRadius: radius, paddingBottom: pressed ? 2 : 7, marginTop: pressed ? 5 : 0 },
          disabled && { opacity: 0.45 },
        ]}>
          <View style={{ backgroundColor: face, borderRadius: radius, overflow: 'hidden' }}>
            <View style={[styles.gloss, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
            {children}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// Soft blurred-looking blocks drifting in the background, like the logo art.
const BG_BLOCKS = [
  { top: '8%', left: -24, size: 90, color: '#FFB800', rot: '-18deg' },
  { top: '30%', right: -30, size: 110, color: '#2ECC71', rot: '22deg' },
  { top: '58%', left: -34, size: 100, color: '#FF4FA3', rot: '12deg' },
  { top: '80%', right: -20, size: 80, color: '#1E80F0', rot: '-10deg' },
];

export default function SettingsScreen({ onBack, onSelect, likes = {}, onToggleLike }) {
  const [view, setView] = useState('menu'); // 'menu' | 'name' | 'favorites'
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPlayerName().then(setName);
  }, []);

  // Android hardware back: sub-page → menu → hub.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'menu') setView('menu'); else onBack();
      return true;
    });
    return () => sub.remove();
  }, [view, onBack]);

  const canSave = sanitizeName(name).length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    playTap();
    const clean = await setPlayerName(name);
    setName(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);

    // Best-effort: for every game this player has already made progress in,
    // push the renamed row to that game's leaderboard right away instead of
    // waiting for their next win. Silently ignored per-game if the
    // leaderboard isn't configured or the player hasn't played it yet.
    const [matchmakerLevel, matchmakerScore, blockblastScore] = await Promise.all([
      loadNumber(STORAGE_KEYS.MATCHMAKER_MAX_UNLOCKED, 1),
      loadNumber(STORAGE_KEYS.MATCHMAKER_BEST_SCORE, 0),
      loadNumber(STORAGE_KEYS.BLOCKBLAST_BEST_SCORE, 0),
    ]);
    if (matchmakerLevel > 1 || matchmakerScore > 0) {
      submitProgress('matchmakerLeaderboard', { name: clean, maxLevel: matchmakerLevel, bestScore: matchmakerScore }).catch(() => {});
    }
    if (blockblastScore > 0) {
      submitProgress('blockblastLeaderboard', { name: clean, bestScore: blockblastScore }).catch(() => {});
    }
  };

  const playable = GAMES.filter((g) => !g.disabled);
  const favorites = playable.filter((g) => likes[g.id]);
  const others = playable.filter((g) => !likes[g.id]);

  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54;
  const title = view === 'name' ? 'EDIT NAME' : view === 'favorites' ? 'FAVORITES' : 'SETTINGS';

  const goBack = () => { playTap(); if (view !== 'menu') setView('menu'); else onBack(); };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <LinearGradient colors={[C.bgTop, C.bgMid, C.bgBottom]} style={StyleSheet.absoluteFill} />
      {BG_BLOCKS.map((b, i) => (
        <View
          key={i}
          style={[styles.bgBlock, {
            top: b.top, left: b.left, right: b.right,
            width: b.size, height: b.size, backgroundColor: b.color,
            transform: [{ rotate: b.rot }],
          }]}
        />
      ))}
      <View style={{ height: statusH }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <BackButton onPress={goBack} />
        <View style={styles.titleWrap}>
          {view === 'menu' && (
            <Image source={require('../assets/settings_gear.png')} style={styles.titleGear} resizeMode="contain" />
          )}
          <BubbleText size={28}>{title}</BubbleText>
        </View>
        <View style={{ width: 52 }} />
      </View>

      {/* ── Menu: two big options ── */}
      {view === 'menu' && (
        <View style={styles.menu}>
          <ChunkyButton face={C.green} base={C.greenDark} onPress={() => { playTap(); setView('name'); }}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}><Text style={styles.optionEmoji}>✏️</Text></View>
              <View style={{ flex: 1 }}>
                <BubbleText size={22} color="#FFFFFF" stroke={C.greenDark}>EDIT NAME</BubbleText>
                <Text style={styles.optionSub} numberOfLines={1}>{name || ' '}</Text>
              </View>
              <Text style={styles.optionChevron}>›</Text>
            </View>
          </ChunkyButton>

          <View style={{ height: 22 }} />

          <ChunkyButton face={C.pink} base={C.pinkDark} onPress={() => { playTap(); setView('favorites'); }}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}><Text style={styles.optionEmoji}>❤️</Text></View>
              <View style={{ flex: 1 }}>
                <BubbleText size={22} color="#FFFFFF" stroke={C.pinkDark}>FAVORITES</BubbleText>
                <Text style={styles.optionSub}>
                  {favorites.length === 0 ? 'No favorites yet' : `${favorites.length} game${favorites.length > 1 ? 's' : ''}`}
                </Text>
              </View>
              <Text style={styles.optionChevron}>›</Text>
            </View>
          </ChunkyButton>
        </View>
      )}

      {/* ── Edit name ── */}
      {view === 'name' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.page}>
            <View style={styles.card}>
              <Text style={styles.cardEmoji}>🎮</Text>
              <Text style={styles.cardTitle}>Your Player Name</Text>
              <Text style={styles.cardSub}>Shown on the leaderboards to every player.</Text>

              <View style={styles.inputWrap}>
                <TextInput
                  value={name}
                  onChangeText={(t) => setName(t.slice(0, MAX_NAME_LENGTH))}
                  placeholder="Your name"
                  placeholderTextColor={C.brownDim}
                  style={styles.input}
                  maxLength={MAX_NAME_LENGTH}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
                <Text style={styles.counter}>{name.length}/{MAX_NAME_LENGTH}</Text>
              </View>

              <ChunkyButton face={C.green} base={C.greenDark} onPress={handleSave} disabled={!canSave} style={{ alignSelf: 'stretch' }}>
                <View style={styles.saveInner}>
                  <BubbleText size={20} color="#FFFFFF" stroke={C.greenDark}>{saved ? 'SAVED ✓' : 'SAVE'}</BubbleText>
                </View>
              </ChunkyButton>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Favorites ── */}
      {view === 'favorites' && (
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {favorites.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyHeart}>💔</Text>
                <Text style={styles.cardTitle}>No Favorites Yet</Text>
                <Text style={styles.cardSub}>Tap ♡ on a game below or in the hub to add it here.</Text>
              </View>
            ) : (
              favorites.map((g, i) => (
                <View key={g.id} style={[styles.gameRow, i > 0 && styles.gameRowDivider]}>
                  <Image source={g.image} style={styles.thumb} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gameName}>{g.name}</Text>
                    <Text style={[styles.gameCat, { color: g.accent }]}>{g.category}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { playTap(); onToggleLike?.(g.id); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.heartBtn}
                  >
                    <Text style={styles.heartOn}>♥</Text>
                  </TouchableOpacity>
                  <ChunkyButton face={C.green} base={C.greenDark} radius={14} onPress={() => { playTap(); onSelect?.(g.id); }}>
                    <View style={styles.playInner}><Text style={styles.playTxt}>PLAY</Text></View>
                  </ChunkyButton>
                </View>
              ))
            )}
          </View>

          {others.length > 0 && (
            <>
              <View style={styles.sectionTitle}>
                <BubbleText size={18} color="#FFFFFF">ADD MORE</BubbleText>
              </View>
              <View style={styles.card}>
                {others.map((g, i) => (
                  <TouchableOpacity
                    key={g.id}
                    activeOpacity={0.8}
                    onPress={() => { playTap(); onToggleLike?.(g.id); }}
                    style={[styles.gameRow, i > 0 && styles.gameRowDivider]}
                  >
                    <Image source={g.image} style={styles.thumb} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gameName}>{g.name}</Text>
                      <Text style={[styles.gameCat, { color: g.accent }]}>{g.category}</Text>
                    </View>
                    <Text style={styles.heartOff}>♡</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgBottom },
  bgBlock: { position: 'absolute', borderRadius: 22, opacity: 0.16 },
  gloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  backInner: { width: 52, height: 46, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', marginTop: -4 },
  titleWrap: { flexDirection: 'row', alignItems: 'center' },
  titleGear: { width: 34, height: 38, marginRight: 8 },

  // ── Menu ──
  menu: { paddingHorizontal: 22, paddingTop: 40 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 18 },
  optionIcon: {
    width: 56, height: 56, borderRadius: 28, marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionEmoji: { fontSize: 26 },
  optionSub: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 4 },
  optionChevron: { fontSize: 38, fontWeight: '900', color: '#FFFFFF', marginLeft: 8, marginTop: -4 },

  // ── Pages ──
  page: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  card: {
    backgroundColor: C.cream, borderRadius: 26,
    borderWidth: 4, borderColor: C.creamEdge,
    padding: 18, alignItems: 'stretch',
  },
  cardEmoji: { fontSize: 44, textAlign: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: C.brown, textAlign: 'center' },
  cardSub: { fontSize: 13, fontWeight: '600', color: C.brownDim, textAlign: 'center', marginTop: 4, marginBottom: 18 },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 3, borderColor: C.creamEdge,
    paddingHorizontal: 14, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 17, color: C.brown, fontWeight: '800' },
  counter: { fontSize: 12, fontWeight: '700', color: C.brownDim, marginLeft: 8 },
  saveInner: { paddingVertical: 14, alignItems: 'center' },

  // ── Favorites ──
  empty: { alignItems: 'center', paddingVertical: 10 },
  emptyHeart: { fontSize: 48, marginBottom: 8 },
  sectionTitle: { alignItems: 'center', marginTop: 26, marginBottom: 12 },
  gameRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  gameRowDivider: { borderTopWidth: 2, borderTopColor: 'rgba(122,74,24,0.12)' },
  thumb: { width: 60, height: 60, borderRadius: 14, marginRight: 12, borderWidth: 2, borderColor: C.creamEdge },
  gameName: { fontSize: 16, fontWeight: '900', color: C.brown },
  gameCat: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  heartBtn: { paddingHorizontal: 10 },
  heartOn: { fontSize: 26, color: C.pink },
  heartOff: { fontSize: 28, color: C.pink, paddingHorizontal: 8 },
  playInner: { paddingVertical: 9, paddingHorizontal: 14 },
  playTxt: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
});

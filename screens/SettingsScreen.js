import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, Dimensions,
  StatusBar, Platform, KeyboardAvoidingView, ScrollView, Image, BackHandler, Share,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { playTap } from '../utils/audioManager';
import { getPlayerName, setPlayerName, sanitizeName, getDeviceId, MAX_NAME_LENGTH } from '../utils/playerIdentity';
import { STORAGE_KEYS, loadNumber } from '../utils/storage';
import { submitProgress } from '../utils/leaderboardService';
import { GAMES } from '../utils/games';
import { LEVEL_FONT } from '../utils/fonts';
import { BADGES, badgeForStreak, liveStreak, subscribeStreak, syncStreak } from '../utils/dailyStreak';
import { isMusicEnabled, setMusicEnabled, subscribeMusic } from '../utils/backgroundMusic';
import { isVibrationEnabled, setVibrationEnabled, subscribeVibration } from '../utils/haptics';

const APP_VERSION = require('../app.json').expo.version;
const { width: SW, height: SH } = Dimensions.get('window');
const PANEL_W = Math.min(SW - 32, 420);

// ── Wood-and-cream popup palette ──────────────────────────────────────────
const C = {
  wood: '#C08A52', woodDark: '#8A5A2E', woodDeep: '#6B4222',
  cream: '#FBF1DC', creamCard: '#F4E3C3', creamEdge: '#E2C99A',
  field: '#EBDCBC', brown: '#6B4222', brownDim: '#A07A4E',
  green: '#5DCB3E', greenDark: '#2F9A26', greenLight: '#8BE36A',
  grey: '#B9B2A5', greyDark: '#8A8378',
  pink: '#FF4FA3',
  avatarEdge: '#9CC3F0',
};

// ── Icons (simple line glyphs, drawn white on the green buttons) ──────────
function Icon({ name, size = 22, color = '#FFFFFF' }) {
  const p = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'music' && (<>
        <Path d="M9 18V5l12-2v13" {...p} />
        <Circle cx="6" cy="18" r="3" {...p} fill={color} />
        <Circle cx="18" cy="16" r="3" {...p} fill={color} />
      </>)}
      {name === 'vibrate' && (<>
        <Rect x="7" y="3" width="10" height="18" rx="2" {...p} />
        <Line x1="3" y1="8" x2="3" y2="16" {...p} />
        <Line x1="21" y1="8" x2="21" y2="16" {...p} />
      </>)}
      {name === 'edit' && <Path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" {...p} />}
      {name === 'copy' && (<>
        <Rect x="9" y="9" width="13" height="13" rx="2" {...p} />
        <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...p} />
      </>)}
      {name === 'heart' && (
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" {...p} fill={color} />
      )}
      {name === 'close' && (<>
        <Line x1="6" y1="6" x2="18" y2="18" {...p} strokeWidth={3.4} />
        <Line x1="18" y1="6" x2="6" y2="18" {...p} strokeWidth={3.4} />
      </>)}
      {name === 'back' && <Path d="M15 18l-6-6 6-6" {...p} strokeWidth={3.4} />}
      {name === 'slash' && <Line x1="3" y1="3" x2="21" y2="21" {...p} strokeWidth={2.8} />}
    </Svg>
  );
}

// Chunky 3D candy button: a darker "base" peeks out underneath the face and
// the face sinks into it while pressed.
function ChunkyButton({ face = C.green, base = C.greenDark, onPress, disabled, radius = 22, style, children }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style} hitSlop={4}>
      {({ pressed }) => (
        <View style={[
          { backgroundColor: base, borderRadius: radius, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 },
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

// Small square green button (edit / copy next to the profile fields).
function SquareButton({ icon, onPress }) {
  return (
    <ChunkyButton radius={12} onPress={() => { playTap(); onPress(); }}>
      <View style={styles.squareInner}><Icon name={icon} size={18} /></View>
    </ChunkyButton>
  );
}

// Round on/off button for the music/vibration row — green when on, grey with a slash
// through the icon when off.
function RoundToggle({ icon, label, on, onToggle }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <ChunkyButton
        radius={28}
        face={on ? C.green : C.grey}
        base={on ? C.greenDark : C.greyDark}
        onPress={() => { onToggle(!on); playTap(); }}
      >
        <View style={styles.roundInner}>
          <Icon name={icon} size={24} />
          {!on && <View style={StyleSheet.absoluteFill}><View style={styles.slashWrap}><Icon name="slash" size={34} /></View></View>}
        </View>
      </ChunkyButton>
      <Text style={styles.roundLabel}>{label}</Text>
    </View>
  );
}

function useSetting(get, subscribe) {
  const [v, setV] = useState(get());
  useEffect(() => subscribe(setV), []);
  return v;
}

export default function SettingsScreen({ onBack, onSelect, likes = {}, onToggleLike }) {
  const [view, setView] = useState('menu'); // 'menu' | 'name' | 'favorites'
  const [name, setName] = useState('');
  const [draft, setDraft] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [streakState, setStreakState] = useState(null);
  const [saved, setSaved] = useState(false);

  const musicOn = useSetting(isMusicEnabled, subscribeMusic);
  const vibrateOn = useSetting(isVibrationEnabled, subscribeVibration);

  useEffect(() => {
    getPlayerName().then((n) => { setName(n); setDraft(n); });
    getDeviceId().then(setDeviceId);
    return subscribeStreak(setStreakState);
  }, []);

  // Android hardware back: sub-page → menu → hub.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view !== 'menu') setView('menu'); else onBack();
      return true;
    });
    return () => sub.remove();
  }, [view, onBack]);

  const shortId = deviceId.replace(/^dev_/, '').slice(0, 8).toUpperCase();
  const badge = badgeForStreak(streakState ? liveStreak(streakState) : 0) ?? BADGES[0];

  const canSave = sanitizeName(draft).length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    playTap();
    const clean = await setPlayerName(draft);
    setName(clean);
    setDraft(clean);
    setSaved(true);
    setTimeout(() => { setSaved(false); setView('menu'); }, 900);

    // Best-effort: for every game this player has already made progress in,
    // push the renamed row to that game's leaderboard right away instead of
    // waiting for their next win. Silently ignored per-game if the
    // leaderboard isn't configured or the player hasn't played it yet.
    syncStreak();
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

  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
  const title = view === 'name' ? 'Edit Name' : view === 'favorites' ? 'Favorites' : 'Settings';

  const close = () => { playTap(); onBack(); };
  const toMenu = () => { playTap(); setDraft(name); setView('menu'); };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <Image source={require('../assets/home_bg.jpg')} style={styles.bgImage} resizeMode="cover" blurRadius={3} />
      <View style={[styles.bgImage, { backgroundColor: 'rgba(8,14,30,0.55)' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.center, { paddingTop: statusH + 30 }]}
      >
        {/* ── Wooden popup panel ── */}
        <View style={styles.panelOuter}>
          <View style={styles.panelInner}>

            {/* Back (sub-pages) / close */}
            {view !== 'menu' && (
              <TouchableOpacity onPress={toMenu} style={styles.backBtn} hitSlop={12}>
                <Icon name="back" size={26} color={C.woodDark} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={close} style={styles.closeBtn} hitSlop={12}>
              <Icon name="close" size={26} color={C.woodDark} />
            </TouchableOpacity>

            {/* ── Menu ── */}
            {view === 'menu' && (
              <>
                {/* Profile card */}
                <View style={styles.profileCard}>
                  <View style={styles.avatar}>
                    <Image source={badge.image} style={styles.avatarImg} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={styles.fieldRow}>
                      <View style={styles.field}>
                        <Text style={styles.fieldTxt} numberOfLines={1}>{name || ' '}</Text>
                      </View>
                      <SquareButton icon="edit" onPress={() => setView('name')} />
                    </View>
                    <View style={styles.fieldRow}>
                      <View style={styles.field}>
                        <Text style={styles.fieldTxt} numberOfLines={1}>ID:{shortId}</Text>
                      </View>
                      <SquareButton icon="copy" onPress={() => Share.share({ message: shortId }).catch(() => {})} />
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Favorites */}
                <ChunkyButton onPress={() => { playTap(); setView('favorites'); }} style={{ alignSelf: 'stretch', marginHorizontal: 8 }}>
                  <View style={styles.bigInner}>
                    <View style={styles.bigIcon}><Icon name="heart" size={20} color={C.pink} /></View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={styles.bigTxt}>Favorites</Text>
                      <Text style={styles.bigSub}>
                        {favorites.length === 0 ? 'No favorites yet' : `${favorites.length} game${favorites.length > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                    <View style={{ width: 36 }} />
                  </View>
                </ChunkyButton>

                {/* Sound / vibration toggles */}
                <View style={styles.toggleRow}>
                  <RoundToggle icon="music" label="Music" on={musicOn} onToggle={setMusicEnabled} />
                  <RoundToggle icon="vibrate" label="Vibration" on={vibrateOn} onToggle={setVibrationEnabled} />
                </View>

                <Text style={styles.version}>{APP_VERSION}</Text>
              </>
            )}

            {/* ── Edit name ── */}
            {view === 'name' && (
              <View style={{ paddingTop: 8 }}>
                <Text style={styles.cardSub}>Shown on the leaderboards to every player.</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={draft}
                    onChangeText={(t) => setDraft(t.slice(0, MAX_NAME_LENGTH))}
                    placeholder="Your name"
                    placeholderTextColor={C.brownDim}
                    style={styles.input}
                    maxLength={MAX_NAME_LENGTH}
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                  <Text style={styles.counter}>{draft.length}/{MAX_NAME_LENGTH}</Text>
                </View>
                <ChunkyButton onPress={handleSave} disabled={!canSave} style={{ alignSelf: 'stretch' }}>
                  <View style={styles.saveInner}>
                    <Text style={styles.bigTxt}>{saved ? 'Saved ✓' : 'Save'}</Text>
                  </View>
                </ChunkyButton>
              </View>
            )}

            {/* ── Favorites ── */}
            {view === 'favorites' && (
              <ScrollView style={{ maxHeight: SH * 0.55 }} showsVerticalScrollIndicator={false}>
                <View style={styles.listCard}>
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
                        <ChunkyButton radius={14} onPress={() => { playTap(); onSelect?.(g.id); }}>
                          <View style={styles.playInner}><Text style={styles.playTxt}>PLAY</Text></View>
                        </ChunkyButton>
                      </View>
                    ))
                  )}
                </View>

                {others.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Add More</Text>
                    <View style={styles.listCard}>
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

          {/* Title tab straddling the top edge */}
          <View style={styles.titleTab} pointerEvents="none">
            <Text style={styles.titleTxt}>{title}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1A33' },
  // Explicit size: absoluteFill alone let Android draw the image at its own
  // pixel size (zoomed in and blurry) instead of fitting the screen.
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
  gloss: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // ── Panel ──
  panelOuter: {
    width: PANEL_W,
    backgroundColor: C.wood, borderRadius: 30,
    borderWidth: 3, borderColor: C.woodDeep,
    padding: 9,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 14,
  },
  panelInner: {
    backgroundColor: C.cream, borderRadius: 22,
    paddingTop: 44, paddingBottom: 16, paddingHorizontal: 14,
  },
  titleTab: {
    position: 'absolute', top: -24, alignSelf: 'center',
    minWidth: PANEL_W * 0.58, alignItems: 'center',
    backgroundColor: C.woodDark, borderRadius: 22,
    borderWidth: 3, borderColor: C.woodDeep,
    paddingVertical: 9, paddingHorizontal: 24,
  },
  titleTxt: {
    fontSize: 24, ...LEVEL_FONT, color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2,
  },
  closeBtn: { position: 'absolute', top: 12, right: 14, zIndex: 2 },
  backBtn: { position: 'absolute', top: 12, left: 12, zIndex: 2 },

  // ── Profile card ──
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.creamCard, borderRadius: 20,
    borderWidth: 3, borderColor: C.creamEdge,
    padding: 12,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 18,
    backgroundColor: '#DCEBFB', borderWidth: 4, borderColor: C.avatarEdge,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 64, height: 64 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1, backgroundColor: C.field, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  fieldTxt: { fontSize: 14, fontWeight: '900', color: C.brown },
  squareInner: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },

  divider: { height: 2, backgroundColor: C.creamEdge, marginVertical: 18, marginHorizontal: 4, borderRadius: 1 },

  // ── Big button ──
  bigInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  bigIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  bigTxt: {
    fontSize: 22, ...LEVEL_FONT, color: '#FFFFFF',
    textShadowColor: C.greenDark, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1,
  },
  bigSub: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.92)', marginTop: 2 },

  // ── Toggles ──
  toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 22 },
  roundInner: { width: 56, height: 50, alignItems: 'center', justifyContent: 'center' },
  slashWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { fontSize: 11, fontWeight: '900', color: C.brownDim, marginTop: 5 },
  version: { fontSize: 12, fontWeight: '800', color: C.brownDim, textAlign: 'center', marginTop: 16 },

  // ── Edit name ──
  cardTitle: { fontSize: 20, fontWeight: '900', color: C.brown, textAlign: 'center' },
  cardSub: { fontSize: 13, fontWeight: '600', color: C.brownDim, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 3, borderColor: C.creamEdge,
    paddingHorizontal: 14, marginBottom: 20,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 17, color: C.brown, fontWeight: '800' },
  counter: { fontSize: 12, fontWeight: '700', color: C.brownDim, marginLeft: 8 },
  saveInner: { paddingVertical: 12, alignItems: 'center' },

  // ── Favorites ──
  listCard: {
    backgroundColor: C.creamCard, borderRadius: 18,
    borderWidth: 3, borderColor: C.creamEdge,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 14 },
  emptyHeart: { fontSize: 44, marginBottom: 6 },
  sectionTitle: { fontSize: 18, ...LEVEL_FONT, color: C.woodDark, textAlign: 'center', marginTop: 16, marginBottom: 8 },
  gameRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  gameRowDivider: { borderTopWidth: 2, borderTopColor: 'rgba(122,74,24,0.12)' },
  thumb: { width: 52, height: 52, borderRadius: 12, marginRight: 10, borderWidth: 2, borderColor: C.creamEdge },
  gameName: { fontSize: 15, fontWeight: '900', color: C.brown },
  gameCat: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  heartBtn: { paddingHorizontal: 8 },
  heartOn: { fontSize: 24, color: C.pink },
  heartOff: { fontSize: 26, color: C.pink, paddingHorizontal: 8 },
  playInner: { paddingVertical: 8, paddingHorizontal: 12 },
  playTxt: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
});

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, StatusBar, Platform,
  ScrollView, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap } from '../utils/audioManager';
import { NEON } from '../utils/theme';
import AdBanner from '../components/AdBanner';
import { GAMES } from '../utils/games';
import StreakBadge from '../components/StreakBadge';

const { width: SW } = Dimensions.get('window');

// ── Game tile ─────────────────────────────────────────────────────────────
const COLS      = 2;
const TILE_GAP  = 16;
const TILE_W    = (SW - 32 - TILE_GAP * (COLS - 1)) / COLS;
const TILE_H    = TILE_W * 1.3;
const CARD_H    = TILE_W * 1.19; // height of full-card artworks (see GameTile)

// Small faux-3D "bubble" wordmark for tiles that don't have dedicated art —
// same layered-text-offset trick used for Box Pusher's in-game logo, sized
// down to fit a tile's art area as a little title badge.
function MiniBubbleText({ children }) {
  const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const base = { fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 };
  return (
    <View style={{ position: 'absolute', bottom: 10, left: 6, right: 6 }}>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, top: dy, width: '100%', color: '#1B3A6B' }]}>{children}</Text>
      ))}
      <Text style={[base, { color: '#FFFFFF' }]}>{children}</Text>
    </View>
  );
}

// RN Text has no text-stroke, so the outline is faked by stacking the same
// string in the outline color at small offsets behind the real, colored
// text on top — a standard trick for cartoon-game lettering.
function BadgeBubbleText({ children, size, color = '#FFD23F', stroke = '#1B3A6B' }) {
  const offsets = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
  const base = { fontSize: size, fontWeight: '900', textAlign: 'center' };
  return (
    <View>
      {offsets.map(([dx, dy], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: dx, top: dy, color: stroke }]}>{children}</Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </View>
  );
}

// ── Box Pusher medallion logo ──────────────────────────────────────────────
// An original badge-style logo in the same spirit as classic mobile-puzzle
// game logos (circular wood-ring medallion, a banner with the bold title,
// a subtitle plaque, and a mascot peeking over the top) — but built from
// this app's own colors, mascot, and Views/gradients, not copied artwork.
function BoxPusherLogo({ size }) {
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.84, height: s * 0.84, borderRadius: s * 0.42,
        backgroundColor: '#2E9E5B', borderWidth: Math.max(3, s * 0.045), borderColor: '#B9782E',
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: s * 0.05,
      }}>
        <Text style={{ fontSize: s * 0.16, marginBottom: s * 0.03 }}>📦📦📦</Text>
        <View style={{
          width: '92%', paddingVertical: s * 0.045, marginBottom: s * 0.035,
          backgroundColor: '#5B8DEF', borderWidth: 2, borderColor: '#2E4E93', borderRadius: 5,
          alignItems: 'center',
        }}>
          <BadgeBubbleText size={s * 0.13}>BOX PUSHER</BadgeBubbleText>
        </View>
      </View>
      <Text style={{ position: 'absolute', top: -s * 0.05, right: s * 0.04, fontSize: s * 0.32 }}>🐼</Text>
    </View>
  );
}

function GameTile({ game, onPress, liked, onLike, enterAnim }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(pressScale, { toValue: 0.94, friction: 8, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(pressScale, { toValue: 1,    friction: 6, useNativeDriver: true }).start();

  const disabled = !!game.disabled;

  // Games with a full card artwork (frame + title baked in) show only that
  // image — no info row — with the heart tucked into the frame's corner.
  if (game.cardImage) {
    // Same height for every card so cards in a row line up; width follows
    // each artwork's own aspect, capped at the tile width.
    const imgH = Math.min(CARD_H, TILE_W / game.cardAspect);
    const imgW = imgH * game.cardAspect;
    const imgTop = (TILE_H - imgH) / 2;
    const imgLeft = (TILE_W - imgW) / 2;
    return (
      <Animated.View style={[{ width: TILE_W }, enterAnim]}>
        <TouchableOpacity
          onPress={() => { playTap(); onPress(game.id); }}
          onPressIn={onIn}
          onPressOut={onOut}
          activeOpacity={1}
        >
          <Animated.View style={{ width: TILE_W, height: TILE_H, transform: [{ scale: pressScale }] }}>
            <Image source={game.cardImage} style={{ position: 'absolute', top: imgTop, left: imgLeft, width: imgW, height: imgH }} />
            <TouchableOpacity
              onPress={() => { playTap(); onLike(game.id); }}
              style={[styles.heartBtn, { top: imgTop + imgH * 0.09, right: imgLeft + imgW * 0.11 }]}
              activeOpacity={0.8}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <View style={[styles.heartPill, liked && { borderColor: NEON.magenta }]}>
                <Text style={[styles.heartIcon, { color: liked ? NEON.magenta : 'rgba(255,255,255,0.6)' }]}>
                  {liked ? '♥' : '♡'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ width: TILE_W }, enterAnim]}>
      <TouchableOpacity
        onPress={() => { if (!disabled) { playTap(); onPress(game.id); } }}
        onPressIn={disabled ? undefined : onIn}
        onPressOut={disabled ? undefined : onOut}
        activeOpacity={disabled ? 1 : 1}
        disabled={disabled}
      >
        <Animated.View style={[
          styles.tile,
          { borderColor: game.accent + '55' },
          { transform: [{ scale: pressScale }] },
          disabled && styles.tileDisabled,
        ]}>

          {/* Game image fills the art area — falls back to a gradient +
              emoji tile for games shipped without dedicated art */}
          <View style={styles.tileArt}>
            {game.image ? (
              <Image
                source={game.image}
                style={styles.tileImage}
                resizeMode="cover"
              />
            ) : game.logoType === 'medallion' ? (
              <LinearGradient colors={game.gradientColors} style={[styles.tileImage, styles.tileEmojiWrap]}>
                <BoxPusherLogo size={TILE_W * 0.86} />
              </LinearGradient>
            ) : (
              <LinearGradient colors={game.gradientColors} style={[styles.tileImage, styles.tileEmojiWrap]}>
                {game.emoji && <View style={styles.tileEmojiGlow} />}
                {game.emoji && <Text style={styles.tileEmoji}>{game.emoji}</Text>}
                {game.logoLabel && <MiniBubbleText>{game.logoLabel}</MiniBubbleText>}
              </LinearGradient>
            )}
            {disabled && (
              <View style={styles.comingSoonWrap}>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonTxt}>COMING SOON</Text>
                </View>
              </View>
            )}
            {/* Heart button top-right */}
            {!disabled && (
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
            )}
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
export default function HomeScreen({ onSelect, likes, onToggleLike }) {

  const headerY  = useRef(new Animated.Value(-20)).current;
  const headerO  = useRef(new Animated.Value(0)).current;
  const tileAnims = useRef(GAMES.map(() => ({
    y: new Animated.Value(30),
    o: new Animated.Value(0),
  }))).current;
  const dotBlink = useRef(new Animated.Value(1)).current;
  const titleGlow = useRef(new Animated.Value(0)).current;

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

    // Slow breathing pulse on the logo.
    Animated.loop(Animated.sequence([
      Animated.timing(titleGlow, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(titleGlow, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ])).start();
  }, []);

  const logoScale = titleGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      {/* Forest night backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B1A33' }]} />
      <Image source={require('../assets/home_bg.jpg')} style={styles.bgImage} resizeMode="cover" />

      {/* Status bar spacer */}
      <View style={{ height: statusH }} />

      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerO, transform: [{ translateY: headerY }] }]}>

        {/* ── App wordmark ── */}
        <View style={styles.brandRow}>
          <Animated.Image
            source={require('../assets/puzzlegame_logo.png')}
            style={[styles.brandLogo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />

          <StreakBadge style={styles.streakBadge} />

          <TouchableOpacity
            onPress={() => { playTap(); onSelect('settings'); }}
            style={styles.settingsBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image source={require('../assets/settings_gear.png')} style={styles.settingsIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>

      </Animated.View>

      {/* ── Game grid ── */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.gridRow}>
            {GAMES.map((game, idx) => (
              <GameTile
                key={game.id}
                game={game}
                onPress={onSelect}
                liked={!!likes[game.id]}
                onLike={onToggleLike}
                enterAnim={{
                  opacity: tileAnims[idx]?.o ?? 1,
                  transform: [{ translateY: tileAnims[idx]?.y ?? 0 }],
                }}
              />
            ))}
          </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDot} />
          <Text style={styles.footerTxt}>Tap any game to start playing</Text>
          <View style={styles.footerDot} />
        </View>
      </ScrollView>

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Explicit size: absoluteFill alone let Android draw the image at its own
  // pixel size (zoomed in and blurry) instead of fitting the screen.
  bgImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },

  // ── App wordmark ──
  brandRow: { marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  // Logo art is 700x467 (1.5:1).
  brandLogo: { width: 165, height: 110 },
  settingsBtn: {
    position: 'absolute', right: 0, top: 30,
    width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { width: 44, height: 50 },
  streakBadge: { position: 'absolute', left: 0, top: 14 },


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
    marginBottom: 0,
  },
  tileDisabled: {
    opacity: 0.5,
  },
  comingSoonWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10,
  },
  comingSoonTxt: {
    color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1,
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
  tileEmojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmojiGlow: {
    position: 'absolute',
    width: TILE_W * 0.5, height: TILE_W * 0.5, borderRadius: TILE_W * 0.25,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tileEmoji: {
    fontSize: TILE_W * 0.4,
    textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
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

  // ── Footer ──
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, gap: 10,
  },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: NEON.violetDim },
  footerTxt: { color: NEON.textFaint, fontSize: 12, letterSpacing: 0.4 },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { playTap, playSuccess } from '../utils/audioManager';
import { THEME } from '../utils/blockBlastTheme';

const { width: SW } = Dimensions.get('window');

// ── Confetti burst (new-record celebration) ───────────────────────────────
// A handful of small colored chips flying outward from the center and
// fading as they go — fires once on mount, purely Animated/Views (no
// image assets or a particle library).
const CONFETTI_COLORS = [THEME.sky, THEME.coral, THEME.gold, '#7FD858', '#B685E8'];

function ConfettiPiece({ angle, dist, delay, color, shape }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1, duration: 900, delay, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, []);
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + (angle * 180) / Math.PI}deg`] });
  return (
    <Animated.View style={{
      position: 'absolute', top: '50%', left: '50%',
      width: 8, height: 8, borderRadius: shape === 'circle' ? 4 : 2,
      backgroundColor: color, opacity,
      transform: [{ translateX }, { translateY }, { rotate }],
    }} />
  );
}

function Confetti({ count = 20 }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
      dist: 90 + Math.random() * 60,
      delay: Math.random() * 150,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: i % 2 === 0 ? 'circle' : 'square',
    }))
  ).current;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </View>
  );
}

// View-drawn star for Game Over rating
function Star({ anim, filled, size = 48 }) {
  const s = size;
  return (
    <Animated.View style={{
      width: s, height: s,
      transform: [{ scale: anim }],
      alignItems: 'center', justifyContent: 'center',
      marginHorizontal: 6,
    }}>
      {/* Outer star ring */}
      <View style={[{
        width: s * 0.78, height: s * 0.78,
        borderRadius: s * 0.39,
        backgroundColor: filled ? '#FFD700' : 'rgba(122,74,24,0.10)',
        borderWidth: 2,
        borderColor: filled ? '#FFAA00' : 'rgba(122,74,24,0.18)',
        alignItems: 'center', justifyContent: 'center',
      }]}>
        {/* Inner gem shape */}
        <View style={{
          width: s * 0.36, height: s * 0.36,
          transform: [{ rotate: '45deg' }],
          backgroundColor: filled ? '#FFFAAA' : 'rgba(122,74,24,0.08)',
          borderRadius: s * 0.05,
        }} />
        {/* Shine on filled star */}
        {filled && (
          <View style={{
            position: 'absolute', top: '15%', left: '20%',
            width: '35%', height: '25%',
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.55)',
          }} />
        )}
      </View>
    </Animated.View>
  );
}

export default function GameOverScreen({ score, bestScore, onRestart, onBack }) {
  const cardScale   = useRef(new Animated.Value(0.4)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardRotate  = useRef(new Animated.Value(1)).current; // 1 = flipped away, 0 = flat-on
  const overlayOp   = useRef(new Animated.Value(0)).current;
  const starScales  = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const btnScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isNewRecord = score > 0 && score >= bestScore;
  const stars       = score >= 3000 ? 3 : score >= 1200 ? 2 : score >= 400 ? 1 : 0;

  useEffect(() => {
    // Celebratory chime when the run set a new best score.
    if (isNewRecord) playSuccess();

    Animated.parallel([
      Animated.timing(overlayOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.parallel([
          Animated.spring(cardScale,   { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
          Animated.spring(cardRotate,  { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.stagger(130, starScales.map((s, i) =>
          i < stars
            ? Animated.spring(s, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })
            : Animated.timing(s, { toValue: 0.6, duration: 200, useNativeDriver: true })
        )),
      ]),
    ]).start();

    // Pulsing glow on score
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);

  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.94, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const cardRotateY = cardRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '70deg'] });

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOp }]}>
      {isNewRecord && <Confetti />}
      <Animated.View style={[styles.card, {
        opacity: cardOpacity,
        transform: [{ perspective: 900 }, { rotateY: cardRotateY }, { scale: cardScale }],
      }]}>
        {/* Warm cream card background */}
        <LinearGradient
          colors={['#FFF6E4', '#F5E6D3']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          {/* Decorative background blobs */}
          <View style={styles.blobTL} />
          <View style={styles.blobBR} />

          <Text style={styles.trophyModel}>🏆</Text>

          {/* Title */}
          {isNewRecord ? (
            <View style={styles.newRecordWrap}>
              <LinearGradient
                colors={[THEME.coral, THEME.gold]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.newRecordBadge}
              >
                <Text style={styles.newRecordText}>NEW RECORD!</Text>
              </LinearGradient>
            </View>
          ) : (
            <Text style={styles.title}>GAME OVER</Text>
          )}

          {/* Gem stars rating */}
          <View style={styles.starsRow}>
            {starScales.map((anim, i) => (
              <Star key={i} anim={anim} filled={i < stars} size={52} />
            ))}
          </View>

          {/* Score display */}
          <Text style={styles.scoreLabel}>YOUR SCORE</Text>
          <Animated.View style={[styles.scoreGlow, { opacity: glowOpacity }]}>
            <LinearGradient
              colors={['#FFD700', '#FF9500', '#FF6D00']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.scorePill}
            >
              {/* Shine overlay */}
              <View style={styles.scorePillShine} />
              <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
            </LinearGradient>
          </Animated.View>

          {/* Best score row */}
          <View style={styles.bestRow}>
            <LinearGradient
              colors={['rgba(255,201,60,0.35)', 'rgba(255,201,60,0.18)']}
              style={styles.bestPill}
            >
              <View style={styles.bestCrownWrap}>
                {/* Mini crown */}
                <View style={styles.miniCrownBase} />
                <View style={styles.miniCrownSpike1} />
                <View style={styles.miniCrownSpike2} />
                <View style={styles.miniCrownSpike3} />
              </View>
              <Text style={styles.bestLabel}>BEST  </Text>
              <Text style={styles.bestValue}>{Math.max(score, bestScore).toLocaleString()}</Text>
            </LinearGradient>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Play again */}
          <Animated.View style={{ transform: [{ scale: btnScale }], width: '100%' }}>
            <TouchableOpacity
              onPress={() => { playTap(); onRestart?.(); }}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={1}
            >
              <LinearGradient
                colors={['#7FD858', '#4FAF4F', '#2E7D32']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.btn}
              >
                <View style={styles.btnShine} />
                <Text style={styles.btnText}>PLAY AGAIN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Back to home */}
          {onBack && (
            <TouchableOpacity onPress={() => { playTap(); onBack(); }} style={styles.homeBtn} activeOpacity={0.7}>
              <Text style={styles.homeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(58,28,10,0.6)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  card: {
    width: SW * 0.84,
    borderRadius: 28, overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(122,74,24,0.25)',
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20,
  },
  gradient: { padding: 28, alignItems: 'center', overflow: 'hidden' },

  trophyModel: { fontSize: 90, marginBottom: 4, textAlign: 'center' },

  blobTL: {
    position: 'absolute', top: -50, left: -50,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: THEME.gold, opacity: 0.18,
  },
  blobBR: {
    position: 'absolute', bottom: -40, right: -40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: THEME.coral, opacity: 0.14,
  },

  newRecordWrap: { marginBottom: 14 },
  newRecordBadge: {
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8,
    borderWidth: 2, borderColor: THEME.brown,
    elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  newRecordText: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  title: {
    color: THEME.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: 4,
    marginBottom: 14,
  },

  starsRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },

  scoreLabel: { color: THEME.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 2.5, marginBottom: 8 },
  scoreGlow: {
    borderRadius: 18, marginBottom: 16,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 16,
    elevation: 12,
  },
  scorePill: {
    borderRadius: 18, paddingHorizontal: 36, paddingVertical: 12,
    minWidth: 150, alignItems: 'center', overflow: 'hidden',
    // Beveled edge — light top/left, dark bottom/right — the same "3D
    // block" language as the game's own gem tiles (GemCell.js), so the
    // score reads as one more block rather than a generic pill.
    borderWidth: 4,
    borderTopColor: 'rgba(255,255,255,0.5)', borderLeftColor: 'rgba(255,255,255,0.5)',
    borderBottomColor: 'rgba(0,0,0,0.35)', borderRightColor: 'rgba(0,0,0,0.35)',
  },
  scorePillShine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  scoreValue: {
    color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },

  bestRow: { marginBottom: 20, width: '100%', alignItems: 'center' },
  bestPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'rgba(184,114,46,0.35)',
    gap: 8,
  },
  bestCrownWrap: { width: 16, height: 14, position: 'relative' },
  miniCrownBase: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
    backgroundColor: '#FFD700', borderRadius: 2,
  },
  miniCrownSpike1: {
    position: 'absolute', bottom: 4, left: 0,
    width: 0, height: 0,
    borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFD700',
  },
  miniCrownSpike2: {
    position: 'absolute', bottom: 4, left: 5,
    width: 0, height: 0,
    borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFD700',
  },
  miniCrownSpike3: {
    position: 'absolute', bottom: 4, right: 0,
    width: 0, height: 0,
    borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFD700',
  },
  bestLabel: { color: THEME.textDim, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  bestValue: { color: THEME.goldDeep, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  divider: {
    width: '80%', height: 1,
    backgroundColor: 'rgba(122,74,24,0.15)',
    marginBottom: 20,
  },

  btn: {
    borderRadius: 32, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 3, borderColor: '#1E5A20',
    elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
    overflow: 'hidden',
  },
  btnShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },
  btnText: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  homeBtn: { marginTop: 14, paddingVertical: 4 },
  homeBtnText: { color: THEME.textFaint, fontSize: 13, letterSpacing: 0.5 },
});

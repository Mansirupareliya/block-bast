import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW } = Dimensions.get('window');

export default function GameOverScreen({ score, bestScore, onRestart }) {
  const cardScale   = useRef(new Animated.Value(0.4)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const starScales  = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const btnScale    = useRef(new Animated.Value(1)).current;

  const isNewRecord = score > 0 && score >= bestScore;
  const stars       = score >= 3000 ? 3 : score >= 1200 ? 2 : score >= 400 ? 1 : 0;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(cardScale,   { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.stagger(120, starScales.map((s, i) =>
        i < stars
          ? Animated.spring(s, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true })
          : Animated.timing(s, { toValue: 0.6, duration: 200, useNativeDriver: true })
      )),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(btnScale, { toValue: 0.93, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
        <LinearGradient colors={['#2D1B69', '#1A0A4E', '#0D0730']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

          {/* Decorative top circles */}
          <View style={styles.topDecorLeft}  />
          <View style={styles.topDecorRight} />

          {/* Title */}
          {isNewRecord
            ? <Text style={styles.newRecord}>🏆 NEW RECORD!</Text>
            : <Text style={styles.title}>GAME OVER</Text>
          }

          {/* Stars */}
          <View style={styles.starsRow}>
            {starScales.map((anim, i) => (
              <Animated.Text key={i} style={[styles.star, i < stars ? styles.starOn : styles.starOff, { transform: [{ scale: anim }] }]}>
                ★
              </Animated.Text>
            ))}
          </View>

          {/* Score */}
          <Text style={styles.scoreLabel}>YOUR SCORE</Text>
          <LinearGradient colors={['#FFD700', '#FF8C00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scorePill}>
            <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
          </LinearGradient>

          {/* Best */}
          <View style={styles.bestRow}>
            <Text style={styles.bestIcon}>👑</Text>
            <Text style={styles.bestLabel}>Best  </Text>
            <Text style={styles.bestValue}>{Math.max(score, bestScore).toLocaleString()}</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Button */}
          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              onPress={onRestart}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              activeOpacity={1}
            >
              <LinearGradient colors={['#FFD700', '#FF8C00', '#FF6D00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btn}>
                <Text style={styles.btnText}>▶  PLAY AGAIN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10000,
  },
  card: {
    width: SW * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.35)',
    elevation: 24,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  gradient: {
    padding: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // decorative circles
  topDecorLeft: {
    position: 'absolute', top: -40, left: -40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  topDecorRight: {
    position: 'absolute', top: -20, right: -30,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(171,71,188,0.1)',
  },

  // title
  newRecord: {
    color: '#FFD700', fontSize: 24, fontWeight: 'bold', letterSpacing: 1,
    textShadowColor: '#FF8C00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
    marginBottom: 14,
  },
  title: {
    color: '#E0E0FF', fontSize: 26, fontWeight: 'bold', letterSpacing: 3,
    marginBottom: 14,
  },

  // stars
  starsRow: { flexDirection: 'row', marginBottom: 18 },
  star: { fontSize: 42, marginHorizontal: 5 },
  starOn: {
    color: '#FFD700',
    textShadowColor: '#FF8C00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  starOff: { color: '#2D2060' },

  // score
  scoreLabel: { color: '#9E9ECA', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  scorePill: {
    borderRadius: 16, paddingHorizontal: 28, paddingVertical: 10, marginBottom: 16,
    minWidth: 140, alignItems: 'center',
  },
  scoreValue: {
    color: '#1A0A4E', fontSize: 40, fontWeight: 'bold', letterSpacing: 1,
  },

  // best
  bestRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  bestIcon: { fontSize: 16, marginRight: 4 },
  bestLabel: { color: '#9E9ECA', fontSize: 14 },
  bestValue: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

  // divider
  divider: { width: '80%', height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },

  // button
  btn: {
    borderRadius: 30, paddingHorizontal: 44, paddingVertical: 15,
    elevation: 8,
    shadowColor: '#FF8C00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10,
  },
  btnText: { color: '#1A0A4E', fontSize: 18, fontWeight: 'bold', letterSpacing: 1.5 },
});

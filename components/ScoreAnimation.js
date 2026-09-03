import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';

export default function ScoreAnimation({ score, x, y, onDone }) {
  const opacity   = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale     = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, friction: 4, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 900, delay: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -70, duration: 1100, useNativeDriver: true }),
        Animated.timing(scale,      { toValue: 0.9, duration: 1100, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, []);

  return (
    <Animated.View style={[styles.wrap, { left: x - 40, top: y - 16, opacity, transform: [{ translateY }, { scale }] }]}>
      <View style={styles.badge}>
        <Text style={styles.plus}>+</Text>
        <Text style={styles.num}>{score}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 9998,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  plus: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  num: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});

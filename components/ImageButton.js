import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

// A tappable picture (back arrow, restart, ...) with a little squish when
// pressed. `size` is the height; width follows the art's `aspect`.
// Callers play their own tap sound.
export default function ImageButton({ source, aspect = 1, onPress, size = 46, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, friction: 6, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.88)}
      onPressOut={() => to(1)}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={style}
    >
      <Animated.Image
        source={source}
        style={{ width: size * aspect, height: size, transform: [{ scale }] }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

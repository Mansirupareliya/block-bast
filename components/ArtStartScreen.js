import React, { useState } from 'react';
import { View, Image, Pressable, StatusBar, StyleSheet } from 'react-native';

// A game's start page drawn as one full artwork, shown whole on every phone
// (never zoomed or cropped). The art is drawn at "contain" size over a
// "cover"-sized copy of itself (`bg`) that fills any leftover space; `fg`
// is the same art with its top/bottom edges pre-faded so it melts into that
// filler. The PLAY button is part of the art, so its tap area is mapped from
// art pixels (`playRect`) through the same scale.
//
//   art       { w, h }        size of the artwork in pixels
//   playRect  { x, y, w, h }  the drawn PLAY button, in art pixels
//   fillBlur  blur for the filler copy (use for sharp, detailed art)
//   children  overlay drawn on top (back button, trophy, ...)
export default function ArtStartScreen({ bg, fg, art, playRect, onPlay, fillBlur = 0, backgroundColor = '#000', children }) {
  const [box, setBox] = useState(null);

  let artStyle = null;
  let playStyle = null;
  if (box) {
    const scale = Math.min(box.width / art.w, box.height / art.h);
    const w = art.w * scale;
    const h = art.h * scale;
    artStyle = { position: 'absolute', width: w, height: h, left: (box.width - w) / 2, top: (box.height - h) / 2 };
    playStyle = {
      left: artStyle.left + playRect.x * scale,
      top: artStyle.top + playRect.y * scale,
      width: playRect.w * scale,
      height: playRect.h * scale,
      borderRadius: (playRect.h * scale) / 2,
    };
  }

  return (
    <View style={[styles.root, { backgroundColor }]} onLayout={(e) => setBox(e.nativeEvent.layout)}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <Image source={bg} style={styles.fill} resizeMode="cover" blurRadius={fillBlur} />
      {artStyle && <Image source={fg} style={artStyle} />}

      {playStyle && (
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [
            styles.hotspot, playStyle,
            pressed && { backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ scale: 0.96 }] },
          ]}
        />
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Explicit size: absoluteFill alone lets Android draw the image at its own
  // pixel size (zoomed in and blurry) instead of fitting the screen.
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  hotspot: { position: 'absolute' },
});

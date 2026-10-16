import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';

// Centers its content in the space it's given and, when the content is
// taller (or wider) than that space — short phones, big display zoom, a
// banner ad eating the bottom — scales it down uniformly so nothing is cut
// off under the status bar or the ad. On roomy screens it renders at 1:1.
export default function FitBox({ style, contentStyle, children }) {
  const [box, setBox] = useState(null);
  const [content, setContent] = useState(null);

  const scale = box && content
    ? Math.min(1, box.height / content.height, box.width / content.width)
    : 1;

  return (
    <View style={[styles.box, style]}>
      <View
        style={styles.measure}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
      >
        <View
          style={[styles.content, contentStyle, { transform: [{ scale }] }, !content && styles.hidden]}
          onLayout={(e) => setContent(e.nativeEvent.layout)}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignSelf: 'stretch' },
  measure: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  content: { flexShrink: 0, alignItems: 'center' },
  // Avoid a one-frame flash at full size before the first measurement.
  hidden: { opacity: 0 },
});

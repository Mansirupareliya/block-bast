import React, { useRef } from 'react';
import { View, PanResponder, Dimensions, Animated } from 'react-native';
import PieceView from './PieceView';

const { width: SW } = Dimensions.get('window');
const SLOT_W = (SW - 60) / 3;
const SLOT_H = 90;

export default function DraggablePiece({
  piece, index, onDragStart, onDragMove, onDragEnd, disabled, isDragging,
}) {
  let cellSize = 24;
  if (piece) {
    const cols = piece.shape[0].length;
    const rows = piece.shape.length;
    const maxC = Math.min(26, Math.floor(SLOT_W / Math.max(1, cols)));
    const maxR = Math.min(26, Math.floor(SLOT_H / Math.max(1, rows)));
    cellSize = Math.min(maxC, maxR);
  }

  // Scale spring for lift effect in tray (before the overlay takes over)
  const liftScale = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder:  () => !disabled,
      onPanResponderGrant: (e) => {
        Animated.spring(liftScale, {
          toValue: 1.18, friction: 4, tension: 220, useNativeDriver: true,
        }).start();
        onDragStart?.(index, e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) =>
        onDragMove?.(index, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: (e) => {
        Animated.spring(liftScale, {
          toValue: 1, friction: 5, tension: 200, useNativeDriver: true,
        }).start();
        onDragEnd?.(index, e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderTerminate: () => {
        Animated.spring(liftScale, {
          toValue: 1, friction: 5, tension: 200, useNativeDriver: true,
        }).start();
        onDragEnd?.(index, -1, -1);
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        opacity: isDragging ? 0 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: cellSize * 4,
        minHeight: cellSize * 4,
        padding: 6,
        transform: [{ scale: liftScale }],
      }}
      {...panResponder.panHandlers}
    >
      {piece && <PieceView piece={piece} cellSize={cellSize} />}
    </Animated.View>
  );
}


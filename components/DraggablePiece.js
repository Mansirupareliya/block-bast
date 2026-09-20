import React, { useEffect, useRef } from 'react';
import { PanResponder, Dimensions, Animated, Easing } from 'react-native';
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

  // Fades the tray slot out the instant it's picked up (and back in if the
  // drag is cancelled) instead of the old hard opacity:0/1 cut, so the
  // handoff to the drag overlay reads as one continuous piece rather than
  // a flicker.
  const dragFade = useRef(new Animated.Value(isDragging ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(dragFade, {
      toValue: isDragging ? 0 : 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [isDragging, dragFade]);

  // Entrance pop — this component only mounts fresh when a slot goes from
  // empty back to holding a piece (GameScreen swaps between DraggablePiece
  // and a plain empty-slot View), so a plain mount effect is exactly "a new
  // piece just landed in the tray" and needs no extra tracking.
  const enterScale   = useRef(new Animated.Value(0.3)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(enterScale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
      Animated.timing(enterOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

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
        opacity: Animated.multiply(dragFade, enterOpacity),
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: cellSize * 4,
        minHeight: cellSize * 4,
        padding: 6,
        transform: [{ scale: Animated.multiply(liftScale, enterScale) }],
      }}
      {...panResponder.panHandlers}
    >
      {piece && <PieceView piece={piece} cellSize={cellSize} />}
    </Animated.View>
  );
}

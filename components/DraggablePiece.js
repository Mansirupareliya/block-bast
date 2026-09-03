import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';
import PieceView from './PieceView';

const MINI_CELL = 22;

export default function DraggablePiece({
  piece, index, onDragStart, onDragMove, onDragEnd, disabled, isDragging,
}) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder:  () => !disabled,
      onPanResponderGrant:    (e) => onDragStart?.(index, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove:     (e) => onDragMove?.(index,  e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease:  (e) => onDragEnd?.(index,   e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminate:()  => onDragEnd?.(index,   -1, -1),
    })
  ).current;

  if (!piece) {
    return <View style={{ width: MINI_CELL * 5, height: MINI_CELL * 5 }} />;
  }

  return (
    <View
      style={{ opacity: isDragging ? 0.25 : 1, alignItems: 'center', justifyContent: 'center', padding: 6 }}
      {...panResponder.panHandlers}
    >
      <PieceView piece={piece} cellSize={MINI_CELL} />
    </View>
  );
}

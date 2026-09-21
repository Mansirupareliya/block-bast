import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, ScrollView,
  PanResponder, Animated, Image
} from 'react-native';
import { playTap, playClick, playSuccess } from '../utils/audioManager';
import { STORAGE_KEYS, loadNumber, saveNumber } from '../utils/storage';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Dog emojis & colors ───────────────────────────────────────────────────
const DOGS   = ['🐶','🐕','🦮','🐩','🐕‍🦺','🐾'];
const COLORS = ['#E8A045','#D4845A','#C4A882','#E8C170','#B87B4A','#F0C080','#A0522D','#CD853F'];

// ── Build level from solution grid ────────────────────────────────────────
// This generates a board with solid walls and a dashed "hole" to fill.
function buildLevel(solution) {
  const G = solution.length;
  let ids = [...new Set(solution.flat())].sort((a, b) => a - b);
  
  // Decide how many pieces to convert to walls to create non-square holes
  let dropCount = 0;
  if (ids.length === 3) dropCount = 1;
  else if (ids.length >= 4 && ids.length <= 5) dropCount = 1;
  else if (ids.length >= 6 && ids.length <= 8) dropCount = 2;
  else if (ids.length > 8) dropCount = 3;

  // Keep the first N pieces as playable, rest become walls
  const playableIds = ids.slice(0, ids.length - dropCount);
  
  const emptyCells = [];
  const pieces = playableIds.map((id, pi) => {
    const abs = [];
    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        if (solution[r][c] === id) {
          abs.push([r, c]);
        }
      }
    }
    abs.sort(([r1, c1], [r2, c2]) => r1 - r2 || c1 - c2);
    const minR = abs[0][0];
    const minC = Math.min(...abs.map(([, c]) => c));
    
    // Add padded coordinates to emptyCells
    abs.forEach(([r, c]) => emptyCells.push([r + 1, c + 1]));

    return {
      cells: abs.map(([r, c]) => [r - minR, c - minC]),
      dog: DOGS[pi % DOGS.length],
      color: COLORS[pi % COLORS.length],
      id: pi + 1,
    };
  });
  
  // Padded grid adds a 1-cell dirt boundary around the entire puzzle
  const paddedGridSize = G + 2;
  return { gridSize: paddedGridSize, pieces, emptyCells };
}

// ── 50 Level solution grids ───────────────────────────────────────────────
const LEVEL_DATA = [
  // 3×3 (Levels 1–5)
  buildLevel([[0,0,0],[1,1,1],[2,2,2]]),
  buildLevel([[0,1,2],[0,1,2],[0,1,2]]),
  buildLevel([[0,0,1],[0,1,1],[2,2,2]]),
  buildLevel([[0,0,0],[1,0,2],[1,1,2]]),
  buildLevel([[0,0,1],[0,0,1],[2,1,1]]),
  // 4×4 (Levels 6–15)
  buildLevel([[0,0,0,0],[1,1,1,1],[2,2,2,2],[3,3,3,3]]),
  buildLevel([[0,1,2,3],[0,1,2,3],[0,1,2,3],[0,1,2,3]]),
  buildLevel([[0,0,1,1],[0,0,1,1],[2,2,3,3],[2,2,3,3]]),
  buildLevel([[0,0,0,0],[0,0,0,0],[1,1,1,1],[1,1,1,1]]),
  buildLevel([[0,0,1,1],[0,0,1,1],[0,0,1,1],[0,0,1,1]]),
  buildLevel([[0,0,0,1],[0,2,3,1],[2,2,3,1],[4,4,3,1]]),
  buildLevel([[0,1,1,1],[0,0,2,1],[3,0,2,2],[3,3,3,2]]),
  buildLevel([[0,0,1,2],[0,3,1,2],[3,3,1,2],[4,4,4,2]]),
  buildLevel([[0,0,1,1],[0,2,2,1],[3,2,4,4],[3,3,3,4]]),
  buildLevel([[0,1,2,2],[0,1,1,3],[0,4,1,3],[0,4,4,3]]),
  // 5×5 (Levels 16–30)
  buildLevel([[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[4,4,4,4,4]]),
  buildLevel([[0,1,2,3,4],[0,1,2,3,4],[0,1,2,3,4],[0,1,2,3,4],[0,1,2,3,4]]),
  buildLevel([[0,0,0,0,1],[0,2,3,1,1],[2,2,3,3,1],[4,2,5,3,6],[4,4,5,5,6]]),
  buildLevel([[0,0,1,1,2],[0,3,1,2,2],[3,3,4,2,5],[3,6,4,5,5],[6,6,4,4,5]]),
  buildLevel([[0,0,0,1,2],[0,3,1,1,2],[3,3,1,4,2],[3,5,6,4,2],[5,5,6,4,4]]),
  buildLevel([[0,1,1,2,2],[0,1,3,3,2],[0,4,3,5,2],[0,4,5,5,6],[0,4,4,6,6]]),
  buildLevel([[0,0,1,2,2],[0,3,1,1,2],[0,3,4,1,5],[3,3,4,5,5],[6,6,4,4,5]]),
  buildLevel([[0,0,1,1,2],[0,3,3,1,2],[4,3,5,1,2],[4,3,5,6,2],[4,4,5,6,6]]),
  buildLevel([[0,1,1,2,2],[0,0,1,3,2],[4,0,5,3,2],[4,5,5,3,6],[4,4,7,3,6]]),
  buildLevel([[0,0,0,1,2],[0,3,1,1,2],[3,3,1,4,2],[3,5,4,4,2],[5,5,6,4,6]]),
  buildLevel([[0,1,1,2,2],[0,1,3,3,2],[4,4,3,5,2],[4,6,3,5,5],[4,6,6,5,7]]),
  buildLevel([[0,0,1,2,2],[0,3,1,1,2],[0,3,4,1,5],[0,3,4,5,5],[6,6,4,4,7]]),
  buildLevel([[0,0,0,1,2],[0,3,1,1,2],[3,3,4,1,2],[3,5,4,4,2],[5,5,6,4,4]]),
  buildLevel([[0,1,2,2,3],[0,1,2,3,3],[0,1,4,5,3],[0,6,4,5,5],[6,6,4,4,7]]),
  buildLevel([[0,0,0,1,1],[0,2,3,3,1],[2,2,3,4,4],[5,6,3,4,7],[5,6,6,4,7]]),
  // 6×6 (Levels 31–43)
  buildLevel([[0,0,0,0,0,0],[1,1,1,1,1,1],[2,2,2,2,2,2],[3,3,3,3,3,3],[4,4,4,4,4,4],[5,5,5,5,5,5]]),
  buildLevel([[0,1,2,3,4,5],[0,1,2,3,4,5],[0,1,2,3,4,5],[0,1,2,3,4,5],[0,1,2,3,4,5],[0,1,2,3,4,5]]),
  buildLevel([[0,0,0,1,1,2],[0,3,4,4,1,2],[0,3,4,5,1,2],[3,3,6,5,5,2],[7,6,6,8,5,2],[7,7,8,8,8,2]]),
  buildLevel([[0,0,1,1,2,2],[0,3,3,1,4,2],[5,3,6,4,4,2],[5,5,6,6,7,2],[5,8,9,6,7,7],[8,8,9,9,9,7]]),
  buildLevel([[0,0,0,1,2,2],[0,3,1,1,1,2],[3,3,4,4,5,2],[6,3,4,5,5,2],[6,7,4,8,5,9],[6,7,7,8,8,9]]),
  buildLevel([[0,0,1,1,2,2],[0,3,3,1,4,2],[5,3,6,4,4,2],[5,5,6,7,4,8],[5,9,6,7,7,8],[9,9,6,10,7,8]]),
  buildLevel([[0,0,0,1,1,2],[0,3,4,4,1,2],[3,3,4,5,1,2],[6,3,7,5,5,2],[6,6,7,7,8,2],[9,6,9,8,8,2]]),
  buildLevel([[0,1,1,2,3,3],[0,1,4,2,2,3],[0,5,4,4,2,6],[0,5,5,7,6,6],[0,8,7,7,9,6],[8,8,7,9,9,9]]),
  buildLevel([[0,0,0,1,1,2],[0,3,4,4,1,2],[0,3,4,5,1,2],[3,3,6,5,5,2],[7,6,6,8,5,9],[7,7,8,8,9,9]]),
  buildLevel([[0,0,1,1,2,2],[0,3,3,1,4,2],[5,3,4,4,4,2],[5,5,6,7,4,8],[9,5,6,7,7,8],[9,9,6,6,7,8]]),
  buildLevel([[0,0,0,1,2,2],[0,3,1,1,1,2],[3,3,4,1,5,2],[6,3,4,5,5,2],[6,7,4,8,5,2],[6,7,7,8,8,2]]),
  buildLevel([[0,1,1,2,3,3],[0,1,4,2,2,3],[0,5,4,4,2,6],[0,5,7,4,6,6],[0,5,7,8,8,6],[9,9,7,7,8,10]]),
  buildLevel([[0,0,0,0,1,2],[0,3,4,1,1,2],[3,3,4,4,1,2],[5,3,6,4,7,2],[5,5,6,7,7,2],[8,5,6,6,7,2]]),
  // 7×7 (Levels 44–50)
  buildLevel([[0,0,0,0,0,0,0],[1,1,1,1,1,1,1],[2,2,2,2,2,2,2],[3,3,3,3,3,3,3],[4,4,4,4,4,4,4],[5,5,5,5,5,5,5],[6,6,6,6,6,6,6]]),
  buildLevel([[0,1,2,3,4,5,6],[0,1,2,3,4,5,6],[0,1,2,3,4,5,6],[0,1,2,3,4,5,6],[0,1,2,3,4,5,6],[0,1,2,3,4,5,6],[0,1,2,3,4,5,6]]),
  buildLevel([[0,0,0,0,1,2,2],[0,3,4,1,1,1,2],[0,3,4,4,5,1,2],[3,3,6,4,5,5,7],[8,6,6,9,5,7,7],[8,8,6,9,9,10,7],[11,8,9,9,10,10,10]]),
  buildLevel([[0,0,1,1,2,3,3],[0,4,4,1,2,2,3],[0,4,5,5,6,2,3],[0,4,7,5,6,6,8],[0,7,7,9,6,8,8],[10,7,9,9,11,8,12],[10,10,9,11,11,12,12]]),
  buildLevel([[0,0,0,1,2,2,2],[0,3,1,1,1,4,2],[0,3,3,5,4,4,2],[0,6,3,5,5,7,2],[6,6,8,5,7,7,2],[9,6,8,8,10,7,11],[9,9,9,10,10,11,11]]),
  buildLevel([[0,0,0,0,1,1,1],[0,2,3,1,1,4,4],[0,2,3,3,5,4,6],[0,2,7,3,5,5,6],[2,2,7,8,5,6,6],[9,7,7,8,8,10,6],[9,9,9,8,10,10,10]]),
  buildLevel([[0,0,1,1,2,3,3],[0,4,4,1,2,2,3],[0,4,5,1,6,2,3],[0,4,5,5,6,6,7],[0,8,5,9,6,7,7],[10,8,8,9,9,11,7],[10,10,9,11,11,11,12]]),
].map((lvl, li) => ({
  ...lvl,
  pieces: lvl.pieces.map((p, pi) => ({
    ...p,
    dog: DOGS[(li + pi) % DOGS.length],
    color: COLORS[(li + pi * 2) % COLORS.length],
  })),
}));

let globalUnlocked = 1;

function getAbsCells(piece, anchorR, anchorC) {
  return piece.cells.map(([dr, dc]) => [anchorR + dr, anchorC + dc]);
}

// ── Draggable Piece ───────────────────────────────────────────────────────
function DraggablePiece({
  piece, PS, placed,
  boardLayout, cellSize,
  onPlace,
}) {
  const pan    = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);

  const maxR = Math.max(...piece.cells.map(([r]) => r));
  const maxC = Math.max(...piece.cells.map(([, c]) => c));
  const tileW = (maxC + 1) * PS + 20;
  const tileH = (maxR + 1) * PS + 20;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !placed,
    onMoveShouldSetPanResponder:  () => !placed,

    onPanResponderGrant: () => {
      isDragging.current = true;
      pan.setValue({ x: 0, y: 0 });
    },

    onPanResponderMove: (e, g) => {
      pan.setValue({ x: g.dx, y: g.dy });
    },

    onPanResponderRelease: (e) => {
      isDragging.current = false;
      const fx = e.nativeEvent.pageX;
      const fy = e.nativeEvent.pageY;

      if (!boardLayout.current) {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        return;
      }

      const { bx, by, cellSize: cs } = boardLayout.current;
      const col = Math.floor((fx - bx) / cs);
      const row = Math.floor((fy - by) / cs);

      const placed_ = onPlace(piece.id, row, col);
      if (!placed_) {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      } else {
        pan.setValue({ x: 0, y: 0 });
      }
    },

    onPanResponderTerminate: () => {
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        s.pieceTile,
        placed && s.pieceTilePlaced,
        { width: tileW, height: tileH + 8, zIndex: isDragging.current ? 999 : 1 },
        { transform: [...pan.getTranslateTransform()] },
      ]}
    >
      <View style={{ position: 'relative', width: (maxC + 1) * PS, height: (maxR + 1) * PS }}>
        {piece.cells.map(([r, c], ci) => (
          <View
            key={ci}
            style={[
              s.miniCell,
              {
                position: 'absolute',
                top: r * PS, left: c * PS,
                width: PS - 2, height: PS - 2,
                backgroundColor: placed ? '#CCCCCC' : piece.color,
                borderRadius: 5,
                borderTopWidth: 2, borderLeftWidth: 2,
                borderTopColor: placed ? '#DDD' : 'rgba(255,255,255,0.35)',
                borderLeftColor: placed ? '#DDD' : 'rgba(255,255,255,0.35)',
                borderBottomWidth: 2, borderRightWidth: 2,
                borderBottomColor: placed ? '#BBB' : 'rgba(0,0,0,0.15)',
                borderRightColor: placed ? '#BBB' : 'rgba(0,0,0,0.15)',
              },
            ]}
          >
            {ci === 0 && !placed && (
              <Text style={{ fontSize: PS * 0.65, textAlign: 'center', includeFontPadding: false }}>
                {piece.dog}
              </Text>
            )}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────
export default function DogsBlocksScreen({ onBack }) {
  const [view,         setView]         = useState('levels');
  const [levelIdx,     setLevelIdx]     = useState(0);
  const [maxUnlocked,  setMaxUnlocked]  = useState(globalUnlocked);
  const [placed,       setPlaced]       = useState([]);  // [{pieceId, anchorR, anchorC}]
  const [complete,     setComplete]     = useState(false);

  const boardLayout = useRef(null);
  const boardRef    = useRef(null);

  // Restore progress saved on a previous app session. `globalUnlocked` only
  // survives while the JS engine stays alive (screen navigations within one
  // session); a full app close/reopen resets it, which is what was reported
  // — so read the persisted value once on mount and adopt it if it's ahead.
  useEffect(() => {
    loadNumber(STORAGE_KEYS.DOGSBLOCKS_MAX_UNLOCKED, 1).then((saved) => {
      if (saved > globalUnlocked) {
        globalUnlocked = saved;
        setMaxUnlocked(saved);
      }
    });
  }, []);

  const lvl = LEVEL_DATA[levelIdx] || LEVEL_DATA[0];
  const { gridSize, pieces, emptyCells } = lvl;

  const BOARD_PAD  = 20;
  const BOARD_SIZE = SW - BOARD_PAD * 2;
  const CELL       = Math.floor(BOARD_SIZE / gridSize);
  const ACTUAL_BOARD_SIZE = CELL * gridSize;

  const placedCells = placed.flatMap(pp => {
    const p = pieces.find(x => x.id === pp.pieceId);
    return p ? getAbsCells(p, pp.anchorR, pp.anchorC) : [];
  });
  const isCellFilled  = (r, c) => placedCells.some(([fr, fc]) => fr === r && fc === c);
  const isPiecePlaced = (pid)  => placed.some(pp => pp.pieceId === pid);

  const getPieceFilling = (r, c) => {
    for (const pp of placed) {
      const p = pieces.find(x => x.id === pp.pieceId);
      if (!p) continue;
      if (getAbsCells(p, pp.anchorR, pp.anchorC).some(([fr, fc]) => fr === r && fc === c))
        return { piece: p, pp };
    }
    return null;
  };

  const startLevel = useCallback((idx) => {
    setLevelIdx(idx);
    setPlaced([]);
    setComplete(false);
    setView('game');
    boardLayout.current = null;
  }, []);

  const handleDrop = useCallback((pieceId, row, col) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece || isPiecePlaced(pieceId)) return false;

    const abs = getAbsCells(piece, row, col);

    // Check if every part of the piece lands in a valid empty hole and is not overlapping
    const valid = abs.every(([ar, ac]) =>
      emptyCells.some(([er, ec]) => er === ar && ec === ac) &&
      !isCellFilled(ar, ac)
    );
    if (!valid) return false;

    playClick();

    const newPlaced = [...placed, { pieceId, anchorR: row, anchorC: col }];
    setPlaced(newPlaced);

    // Win condition: All pieces are placed
    if (newPlaced.length === pieces.length) {
      setComplete(true);
      playSuccess();
      const next = Math.max(maxUnlocked, levelIdx + 2);
      setMaxUnlocked(next);
      globalUnlocked = next;
      saveNumber(STORAGE_KEYS.DOGSBLOCKS_MAX_UNLOCKED, next);
    }
    return true;
  }, [pieces, placed, emptyCells, isPiecePlaced, isCellFilled, levelIdx, maxUnlocked]);

  const onBoardLayout = () => {
    if (boardRef.current) {
      boardRef.current.measure((x, y, w, h, px, py) => {
        boardLayout.current = { bx: px, by: py, cellSize: CELL };
      });
    }
  };

  const MAX_PS = 28;
  const trayPS = Math.min(MAX_PS, Math.floor((SW - 48) / Math.max(3, pieces.length) / 2));
  const PS = Math.max(16, trayPS);

  if (view === 'levels') {
    return (
      <View style={s.root}>
        <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => { playTap(); onBack(); }} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>Levels</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={s.levelsGrid}>
          {LEVEL_DATA.map((_, i) => {
            const num    = i + 1;
            const locked = num > maxUnlocked;
            return (
              <TouchableOpacity
                key={i}
                style={[s.lvlBtn, locked && s.lvlBtnLocked]}
                onPress={() => { if (!locked) { playTap(); startLevel(i); } }}
                activeOpacity={locked ? 1 : 0.8}
              >
                <Text style={[s.lvlBtnText, locked && s.lvlBtnTextLocked]}>
                  {locked ? '🔒' : num}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      <View style={s.topBar}>
        <TouchableOpacity onPress={() => { playTap(); setView('levels'); }} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.levelBadge}>
          <Text style={s.levelBadgeText}>Level-{levelIdx + 1}</Text>
        </View>
        <TouchableOpacity onPress={() => { playTap(); startLevel(levelIdx); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 22 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ── Board exactly matching reference style ─────────────────────── */}
      <View style={s.boardSection}>
        <View style={[s.boardWrap, { width: ACTUAL_BOARD_SIZE + 8 }]}>
          {/* Grass top */}
          <View style={s.grassTop} />
          
          <View
            ref={boardRef}
            onLayout={onBoardLayout}
            style={[s.board, { width: ACTUAL_BOARD_SIZE, height: ACTUAL_BOARD_SIZE }]}
          >
            {Array.from({ length: gridSize }, (_, r) =>
              Array.from({ length: gridSize }, (_, c) => {
                const isEmptyCell = emptyCells.some(([er, ec]) => er === r && ec === c);
                const result = getPieceFilling(r, c);
                const filled = !!result;
                const fillPiece = result?.piece;
                
                let isDogFace = false;
                if (filled && result) {
                  const { piece: fp, pp } = result;
                  const [dr0, dc0] = fp.cells[0];
                  isDogFace = (pp.anchorR + dr0 === r) && (pp.anchorC + dc0 === c);
                }

                return (
                  <View
                    key={`${r}-${c}`}
                    style={[
                      s.cell,
                      { width: CELL, height: CELL },
                      !isEmptyCell ? s.cellWall : (filled ? {} : s.cellEmpty)
                    ]}
                  >
                    {filled && (
                      <View style={[
                        s.cellFilled, 
                        { backgroundColor: fillPiece?.color || '#E8A045', width: '100%', height: '100%' }
                      ]}>
                        {isDogFace && (
                          <Text style={{ fontSize: CELL * 0.55, textAlign: 'center' }}>
                            {fillPiece?.dog}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

      <Text style={s.hint}>🐾 Drag dogs into the dashed outline!</Text>

      {/* ── Piece tray ──────────────────────────────────────────────── */}
      <View style={s.tray}>
        {pieces.map((piece) => (
          <DraggablePiece
            key={piece.id}
            piece={piece}
            PS={PS}
            placed={isPiecePlaced(piece.id)}
            boardLayout={boardLayout}
            cellSize={CELL}
            onPlace={handleDrop}
          />
        ))}
      </View>

      {/* ── Complete overlay ──────────────────────────────────────────── */}
      {complete && (
        <View style={s.overlay}>
          <View style={s.completeCard}>
            <Text style={s.completeEmoji}>🏆</Text>
            <Text style={s.completeTitle}>Level Completed!</Text>
            <View style={{ height: 20 }} />
            {levelIdx + 1 < LEVEL_DATA.length && (
              <TouchableOpacity style={s.nextBtn} onPress={() => { playTap(); startLevel(levelIdx + 1); }}>
                <Text style={s.nextBtnText}>Next Level</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.replayBtn} onPress={() => { playTap(); startLevel(levelIdx); }}>
              <Text style={s.replayBtnText}>Replay</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { playTap(); setView('levels'); }} style={{ marginTop: 12 }}>
              <Text style={{ color: '#999', fontSize: 16 }}>All Levels</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FDFCF8' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 20, paddingBottom: 10,
  },
  backArrow: { fontSize: 28, color: '#333', fontWeight: '700' },
  topTitle:  { fontSize: 24, fontWeight: '900', color: '#111' },

  levelBadge: {
    backgroundColor: '#4BB3FD', paddingHorizontal: 22, paddingVertical: 8,
    borderRadius: 20, elevation: 4,
    shadowColor: '#4BB3FD', shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 6,
  },
  levelBadgeText: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 0.4 },

  levelsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', padding: 16, paddingBottom: 60,
  },
  lvlBtn: {
    width: 58, height: 58, backgroundColor: '#FFB800', borderRadius: 14,
    borderWidth: 2, borderColor: '#B38100', justifyContent: 'center',
    alignItems: 'center', margin: 7, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 3,
  },
  lvlBtnLocked: { backgroundColor: '#DCDCDC', borderColor: '#BDBDBD' },
  lvlBtnText:       { fontSize: 20, fontWeight: '900', color: '#111' },
  lvlBtnTextLocked: { fontSize: 20, color: '#999' },

  // Game Board styling exactly like the dirt block
  boardSection: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, marginTop: 10 },
  boardWrap: {
    backgroundColor: '#A06D44',
    borderRadius: 12,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 5 }, shadowRadius: 8,
  },
  grassTop: {
    height: 18,
    backgroundColor: '#86C137',
    borderBottomWidth: 4, borderBottomColor: '#689E31',
    width: '100%',
  },
  board: { 
    flexDirection: 'row', flexWrap: 'wrap', 
    backgroundColor: '#8A5A39', // dirt brown
    padding: 4 
  },
  cell: { justifyContent: 'center', alignItems: 'center' },
  cellWall: {
    backgroundColor: '#8A5A39',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
  },
  cellEmpty: {
    backgroundColor: '#956441', // slightly lighter brown to stand out
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 5,
  },
  cellFilled: {
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 6,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
    borderBottomWidth: 2, borderRightWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    borderRightColor: 'rgba(0,0,0,0.2)',
  },

  hint: {
    textAlign: 'center', fontSize: 14, color: '#666',
    fontWeight: '700', marginBottom: 8, marginTop: 16,
  },

  tray: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 10, flex: 1,
  },

  pieceTile: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 10,
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 6,
    margin: 4,
  },
  pieceTilePlaced: { opacity: 0, height: 0, padding: 0, margin: 0, overflow: 'hidden' }, // hide entirely when placed
  miniCell: { alignItems: 'center', justifyContent: 'center' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1000,
  },
  completeCard: {
    backgroundColor: 'transparent',
    alignItems: 'center', width: SW * 0.82,
  },
  completeEmoji: { fontSize: 50, marginBottom: 10 },
  completeTitle: { 
    fontSize: 28, fontWeight: '900', color: '#4BB3FD', 
    textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 3 
  },
  nextBtn: {
    backgroundColor: '#98E04D', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12, marginBottom: 14, width: '100%', alignItems: 'center', elevation: 2,
    borderBottomWidth: 4, borderBottomColor: '#7BBE33',
  },
  nextBtnText:   { fontSize: 20, fontWeight: '900', color: '#FFF' },
  replayBtn: {
    backgroundColor: '#4BB3FD', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 12, width: '100%', alignItems: 'center', elevation: 2,
    borderBottomWidth: 4, borderBottomColor: '#3099E8',
  },
  replayBtnText: { fontSize: 20, fontWeight: '900', color: '#FFF' },
});

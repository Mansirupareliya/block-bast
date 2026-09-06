export const BOARD_SIZE = 8;

export const COLORS = {
  red: '#E8443A',
  orange: '#FF8C00',
  yellow: '#FFD700',
  green: '#4CAF50',
  blue: '#2196F3',
  purple: '#9C27B0',
  cyan: '#00BCD4',
  pink: '#E91E63',
};

export const BLOCK_SHAPES = [
  // 1x1 Dot
  { shape: [[1]], color: 'red', name: 'dot' },
  
  // 2x2 Square
  { shape: [
      [1, 1],
      [1, 1]
    ], color: 'yellow', name: 'sq_2x2' },

  // 3x3 Square
  { shape: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1]
    ], color: 'orange', name: 'sq_3x3' },
  
  // Lines (Horizontal)
  { shape: [[1, 1]], color: 'blue', name: 'h2' },
  { shape: [[1, 1, 1]], color: 'cyan', name: 'h3' },
  { shape: [[1, 1, 1, 1]], color: 'purple', name: 'h4' },
  { shape: [[1, 1, 1, 1, 1]], color: 'pink', name: 'h5' },
  
  // Lines (Vertical)
  { shape: [[1], [1]], color: 'blue', name: 'v2' },
  { shape: [[1], [1], [1]], color: 'cyan', name: 'v3' },
  { shape: [[1], [1], [1], [1]], color: 'purple', name: 'v4' },
  { shape: [[1], [1], [1], [1], [1]], color: 'pink', name: 'v5' },
  
  // L-Shapes Small
  { shape: [[1, 0], [1, 1]], color: 'orange', name: 'l_sm1' },
  { shape: [[0, 1], [1, 1]], color: 'orange', name: 'l_sm2' },
  { shape: [[1, 1], [1, 0]], color: 'orange', name: 'l_sm3' },
  { shape: [[1, 1], [0, 1]], color: 'orange', name: 'l_sm4' },

  // L-Shapes Large (3x3)
  { shape: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1]
    ], color: 'green', name: 'l_lg1' },
  { shape: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1]
    ], color: 'green', name: 'l_lg2' },
  { shape: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0]
    ], color: 'green', name: 'l_lg3' },
  { shape: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1]
    ], color: 'green', name: 'l_lg4' },

  // T-Shapes Small
  { shape: [[1, 1, 1], [0, 1, 0]], color: 'purple', name: 't_sm1' },
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'purple', name: 't_sm2' },
  { shape: [[1, 0], [1, 1], [1, 0]], color: 'purple', name: 't_sm3' },
  { shape: [[0, 1], [1, 1], [0, 1]], color: 'purple', name: 't_sm4' },

  // Z-Shapes
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'red', name: 'z1' },
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'red', name: 'z2' },
  { shape: [[1, 0], [1, 1], [0, 1]], color: 'red', name: 'z3' },
  { shape: [[0, 1], [1, 1], [1, 0]], color: 'red', name: 'z4' },
];

export function createEmptyBoard() {
  return Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
}

export function getRandomPieces(count = 3) {
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * BLOCK_SHAPES.length);
    pieces.push({ ...BLOCK_SHAPES[idx], id: Math.random().toString(36) });
  }
  return pieces;
}

export function canPlacePiece(board, shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const newRow = row + r;
        const newCol = col + c;
        if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) return false;
        if (board[newRow][newCol] !== null) return false;
      }
    }
  }
  return true;
}

export function placePiece(board, shape, row, col, color) {
  const newBoard = board.map(r => [...r]);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        newBoard[row + r][col + c] = color;
      }
    }
  }
  return newBoard;
}

export function clearLines(board) {
  let newBoard = board.map(r => [...r]);
  const clearedRows = [];
  const clearedCols = [];

  // Check rows
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (newBoard[r].every(cell => cell !== null)) {
      clearedRows.push(r);
    }
  }

  // Check cols
  for (let c = 0; c < BOARD_SIZE; c++) {
    if (newBoard.every(row => row[c] !== null)) {
      clearedCols.push(c);
    }
  }

  // Clear rows
  clearedRows.forEach(r => {
    newBoard[r] = Array(BOARD_SIZE).fill(null);
  });

  // Clear cols
  clearedCols.forEach(c => {
    for (let r = 0; r < BOARD_SIZE; r++) {
      newBoard[r][c] = null;
    }
  });

  const linesCleared = clearedRows.length + clearedCols.length;
  return { newBoard, clearedRows, clearedCols, linesCleared };
}

export function calculateScore(pieceCells, linesCleared, combo) {
  const placementScore = pieceCells * 2;
  let clearScore = 0;
  if (linesCleared > 0) {
    clearScore = linesCleared * 100 * (linesCleared > 1 ? linesCleared : 1);
  }
  const comboBonus = combo > 1 ? combo * 50 : 0;
  return placementScore + clearScore + comboBonus;
}

export function countPieceCells(shape) {
  return shape.flat().filter(Boolean).length;
}

export function checkGameOver(board, pieces) {
  for (const piece of pieces) {
    if (!piece) continue;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlacePiece(board, piece.shape, r, c)) return false;
      }
    }
  }
  return true;
}

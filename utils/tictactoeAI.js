const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],          // diags
];

export function checkWinner(board) {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line: [a,b,c] };
  }
  if (board.every(c => c !== null)) return { winner: 'draw', line: [] };
  return null;
}

function score(board, depth) {
  const res = checkWinner(board);
  if (!res) return null;
  if (res.winner === 'O') return 10 - depth;
  if (res.winner === 'X') return depth - 10;
  return 0;
}

function minimax(board, depth, isMax, alpha, beta) {
  const s = score(board, depth);
  if (s !== null) return s;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, depth + 1, false, alpha, beta));
        board[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, depth + 1, true, alpha, beta));
        board[i] = null;
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

export function getBestMove(board, difficulty) {
  // difficulty: 'easy' | 'medium' | 'hard'
  const randomChance = difficulty === 'easy' ? 0.6 : difficulty === 'medium' ? 0.25 : 0;
  const empty = board.map((v,i) => v === null ? i : -1).filter(i => i !== -1);
  if (!empty.length) return -1;

  if (Math.random() < randomChance) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestVal = -Infinity, bestMove = empty[0];
  for (const i of empty) {
    board[i] = 'O';
    const val = minimax(board, 0, false, -Infinity, Infinity);
    board[i] = null;
    if (val > bestVal) { bestVal = val; bestMove = i; }
  }
  return bestMove;
}

export { WIN_LINES };

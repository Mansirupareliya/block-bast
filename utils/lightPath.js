// Light Path — laser/mirror puzzle logic: beam tracing + procedural levels.
//
// Levels aren't hand-made. Each one is built from a fixed seed (its level
// number), so every player gets the same board for "Level 37" on every
// install. The generator first lays out a *solved* board — it walks each
// laser across the grid, dropping mirrors where the beam turns and a crystal
// where it ends — then scrambles the tappable mirrors. That way every level
// is guaranteed solvable. Then it adds the traps that make it hard:
//   - false trails: turning a path mirror the wrong way sends the beam down
//     a believable route of decoy mirrors that ends at a dead end or a bomb,
//     so every turn is a real decision and a wrong guess costs several taps;
//   - loose decoy mirrors, walls and bombs scattered off the path.
//
// In play, a mirror only passes the laser once the player has tapped it
// ("switched it on") — locked mirrors too; the laser never runs through a
// mirror on its own. The first tap switches a mirror on without turning it,
// later taps turn it (locked ones can't turn). So every path mirror costs one
// tap, plus one more if it was knocked out of place — that total is the
// level's "par" for the stars.

export const LEVEL_COUNT = 200;

// Directions, clockwise: 0 up, 1 right, 2 down, 3 left.
export const DR = [-1, 0, 1, 0];
export const DC = [0, 1, 0, -1];

export const BEAM_COLORS = {
  blue: '#FFC93C',
  red: '#FF5FA8',
  green: '#5CFFA0',
};
const COLOR_ORDER = ['blue', 'red', 'green'];

// Neon tube colours, in hue order. Each level gets its own set: the main
// laser takes one colour and the 2nd/3rd lasers (multi-colour levels) take
// colours 3 and 5 steps further round, so the three always look different.
const NEON_PALETTE = [
  '#FFD23C', // gold
  '#FF7A2E', // orange
  '#FF3F7F', // hot pink
  '#FF3FE0', // magenta
  '#A86BFF', // violet
  '#3BE8FF', // cyan
  '#3DFFB8', // mint
  '#8CFF3F', // lime
];

export function neonColorsFor(levelNum) {
  const n = NEON_PALETTE.length;
  const i = (((levelNum - 1) % n) + n) % n;
  return {
    blue: NEON_PALETTE[i],
    red: NEON_PALETTE[(i + 3) % n],
    green: NEON_PALETTE[(i + 5) % n],
  };
}

// Cell types. Mirrors and splitters have an orientation: '/' or '\'.
//   { type: 'source',   dir, color }
//   { type: 'target',   color }
//   { type: 'mirror',   o, fixed }
//   { type: 'splitter', o, fixed }   half-silvered: beam passes AND reflects
//   { type: 'wall' }
//   { type: 'mine' }                 the beam must never touch it

// '/' turns right<->up and left<->down; '\' turns right<->down and left<->up.
export function reflect(o, d) {
  return o === '/' ? d ^ 1 : 3 - d;
}

// The level number at which each mechanic first appears (shown as a tip).
export const MECHANIC_TIPS = [
  { level: 1, text: 'Tap a mirror to switch it on, tap again to turn it. Guide the laser into the crystal!' },
  { level: 3, text: 'Careful: a wrong turn can lead down a fake trail of mirrors. Think before you tap!' },
  { level: 10, text: "Mirrors with bolts are locked: tap to switch them on, but they won't turn." },
  { level: 18, text: 'Glass splitters let the beam pass through AND reflect.' },
  { level: 25, text: 'Two lasers! Each crystal only lights up in its own colour.' },
  { level: 30, text: "Watch out: don't let any laser hit a bomb!" },
  { level: 70, text: 'Three lasers. Good luck, laser master!' },
];

export function tipForLevel(levelNum) {
  const t = MECHANIC_TIPS.find((m) => m.level === levelNum);
  return t ? t.text : null;
}

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Beam tracing ──────────────────────────────────────────────────────────
// Follows every laser from its source. Returns, for drawing, every cell the
// beam passes through as a "visit": the side it came in (`inSide`, null when
// it starts at the cell's centre — the source) and the side it leaves
// (`outSide`, null when it stops at the centre — a crystal or bomb). Sides
// use the direction numbers above. Also returns which crystals are lit and
// whether a bomb was hit. A visited set stops beams looping forever between
// mirrors.
//
// Options (gameplay only; the solver and title art use the defaults):
//   isActive(r, c, cell) — mirrors/splitters it returns false for stop the
//     beam at their centre instead of turning it.
//   hideDeadEnds — a run that ends on the board edge or a wall isn't drawn;
//     the beam just stops at the mirror that sent it there.
export function traceBeams(grid, { isActive, hideDeadEnds = false } = {}) {
  const n = grid.length;
  const visits = [];
  const lit = new Set(); // "r,c" of targets hit by their own colour
  let mineHit = null;
  const seen = new Set();
  const queue = []; // [r, c, heading, colour, side it entered (r,c) from]

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = grid[r][c];
      if (cell && cell.type === 'source') queue.push([r, c, cell.dir, cell.color, null]);
    }
  }

  while (queue.length) {
    const [sr, sc, sd, color, sIn] = queue.shift();
    let r = sr, c = sc, d = sd, inSide = sIn;
    let runStart = -1; // index of the visit where the current straight run began
    // Off the board / into a wall: optionally erase the run back to its start.
    const deadEnd = () => {
      if (!hideDeadEnds || runStart < 0) return;
      visits.length = runStart + 1;
      visits[runStart] = { ...visits[runStart], outSide: null };
    };
    while (true) {
      const key = `${r},${c},${d},${color}`;
      if (seen.has(key)) break;
      seen.add(key);
      visits.push({ r, c, inSide, outSide: d, color });
      if (runStart < 0) runStart = visits.length - 1;
      const nr = r + DR[d], nc = c + DC[d];
      // Off the board, or into a wall/emitter: the beam ends at this edge.
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) { deadEnd(); break; }
      const cell = grid[nr][nc];
      if (cell && (cell.type === 'wall' || cell.type === 'source')) { deadEnd(); break; }
      inSide = (d + 2) % 4;
      r = nr; c = nc;
      if (!cell) continue;
      if (cell.type === 'target' || cell.type === 'mine') {
        visits.push({ r, c, inSide, outSide: null, color });
        if (cell.type === 'target' && cell.color === color) lit.add(`${r},${c}`);
        if (cell.type === 'mine') mineHit = `${r},${c}`;
        break;
      }
      if (isActive && !isActive(r, c, cell)) {
        visits.push({ r, c, inSide, outSide: null, color });
        break;
      }
      runStart = -1;
      if (cell.type === 'mirror') {
        d = reflect(cell.o, d);
      } else if (cell.type === 'splitter') {
        queue.push([r, c, reflect(cell.o, d), color, inSide]);
      }
    }
  }

  return { visits, lit, mineHit };
}

export function countTargets(grid) {
  let total = 0;
  for (const row of grid) for (const cell of row) if (cell && cell.type === 'target') total++;
  return total;
}

export function isSolved(grid, opts) {
  const { lit, mineHit } = traceBeams(grid, opts);
  return !mineHit && lit.size === countTargets(grid);
}

export function cloneGrid(grid) {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

// ── Difficulty curve ──────────────────────────────────────────────────────
// Ramps quickly: full 9x9 boards by level 61, more turns per laser, false
// trails on most turns, and few locked mirrors (they give the answer away).
function settingsFor(level) {
  const size = level <= 4 ? 5 : level <= 12 ? 6 : level <= 30 ? 7 : level <= 60 ? 8 : 9;
  const lasers = level < 25 ? 1 : level < 70 ? 2 : 3;
  const turnsBase = Math.min(3 + Math.floor(level / 5), 10);
  // Each extra laser takes two turns off the others so big boards still fit.
  const turns = Math.max(3, turnsBase - 2 * (lasers - 1));
  return {
    size,
    lasers,
    turns,
    splitChance: level >= 18 ? Math.min(0.18 + (level - 18) * 0.004, 0.45) : 0,
    fixedChance: level >= 10 ? 0.15 : 0,
    walls: level >= 4 ? Math.min(2 + Math.floor(level / 15), 8) : 0,
    mines: level >= 30 ? Math.min(1 + Math.floor((level - 30) / 20), 5) : 0,
    // Chance that a path mirror gets a false trail behind its wrong turn,
    // and how many turns that trail may take.
    trailChance: level >= 3 ? Math.min(0.4 + level * 0.01, 0.95) : 0,
    trailTurns: Math.min(1 + Math.floor(level / 20), 4),
    // A share of false trails end in a bomb once bombs are introduced.
    trailMineChance: level >= 30 ? 0.35 : 0,
    decoys: level >= 2 ? Math.min(2 + Math.floor(level / 5), Math.floor((size * size) / 4)) : 0,
  };
}

// ── Generator ─────────────────────────────────────────────────────────────
function tryBuild(level, rng, cfg) {
  const n = cfg.size;
  const grid = Array.from({ length: n }, () => Array(n).fill(null));
  const path = new Set(); // cells some beam passes through in the solution
  const pathPieces = []; // [r, c] of mirrors/splitters on the solution path
  const wrongTurns = []; // [r, c, heading] a path mirror sends the beam when wrong
  const inB = (r, c) => r >= 0 && c >= 0 && r < n && c < n;
  const k = (r, c) => `${r},${c}`;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // A piece may only go on an empty cell no beam already runs through.
  const free = (r, c) => inB(r, c) && !grid[r][c] && !path.has(k(r, c));

  // Walk one beam from (r,c) heading d, placing `turns` turns, then a target.
  const walk = (r, c, d, color, turns, splitBudget) => {
    for (let t = 0; t <= turns; t++) {
      // How far it can travel straight before hitting something.
      const room = [];
      let rr = r, cc = c;
      while (true) {
        rr += DR[d]; cc += DC[d];
        if (!inB(rr, cc)) break;
        const cell = grid[rr][cc];
        if (cell) break;
        room.push([rr, cc]);
      }
      // Stops where a piece could go (not on another beam's crossing cell).
      const stops = room.map((p, i) => i).filter((i) => free(room[i][0], room[i][1]));
      if (!stops.length) return false;
      const stop = pick(stops);
      for (let i = 0; i <= stop; i++) path.add(k(room[i][0], room[i][1]));
      const [pr, pc] = room[stop];

      if (t === turns) {
        grid[pr][pc] = { type: 'target', color };
        return true;
      }

      const turnDir = rng() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
      const o = reflect('/', d) === turnDir ? '/' : '\\';
      const remaining = turns - t - 1;
      if (splitBudget > 0 && remaining >= 1 && rng() < cfg.splitChance) {
        // Splitter: one branch keeps going straight, the other turns. Each
        // branch gets about half the remaining turns.
        grid[pr][pc] = { type: 'splitter', o, fixed: false };
        pathPieces.push([pr, pc]);
        const a = Math.max(0, Math.floor(remaining / 2));
        if (!walk(pr, pc, turnDir, color, a, splitBudget - 1)) return false;
        r = pr; c = pc; // straight branch continues this loop
        turns = t + 1 + (remaining - a);
        continue;
      }
      grid[pr][pc] = { type: 'mirror', o, fixed: false };
      pathPieces.push([pr, pc]);
      // Turned the wrong way, this mirror sends the beam the opposite way.
      wrongTurns.push([pr, pc, (turnDir + 2) % 4]);
      r = pr; c = pc; d = turnDir;
    }
    return false;
  };

  // Sources sit on the board edge, pointing inwards.
  for (let i = 0; i < cfg.lasers; i++) {
    const color = COLOR_ORDER[i];
    const edges = [];
    for (let j = 0; j < n; j++) {
      edges.push([0, j, 2], [n - 1, j, 0], [j, 0, 1], [j, n - 1, 3]);
    }
    const options = edges.filter(([r, c]) => free(r, c));
    if (!options.length) return null;
    const [sr, sc, sd] = pick(options);
    grid[sr][sc] = { type: 'source', dir: sd, color };
    path.add(k(sr, sc));
    if (!walk(sr, sc, sd, color, cfg.turns, 1)) return null;
  }

  if (!isSolved(grid)) return null;

  const solution = cloneGrid(grid);

  // Off-path obstacles: walls, bombs and decoy mirrors. Decoys sit on cells
  // no solution beam crosses, so they never change the answer — they're
  // there to catch a beam the player has turned the wrong way.
  const empties = () => {
    const out = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (free(r, c)) out.push([r, c]);
    return out;
  };
  const place = (count, make) => {
    for (let i = 0; i < count; i++) {
      const e = empties();
      if (!e.length) return;
      const [r, c] = pick(e);
      grid[r][c] = make();
    }
  };
  // False trails: from each path mirror's wrong turn, lay a short route of
  // decoy mirrors (each turned at random, like the real ones) so the wrong
  // choice looks just as promising as the right one. It ends wherever its
  // last run goes (edge, wall, another piece), sometimes at a bomb.
  const trail = (r, c, d, turns) => {
    for (let t = 0; t <= turns; t++) {
      const room = [];
      let rr = r, cc = c;
      while (true) {
        rr += DR[d]; cc += DC[d];
        if (!inB(rr, cc) || grid[rr][cc]) break;
        room.push([rr, cc]);
      }
      const stops = room.map((p, i) => i).filter((i) => free(room[i][0], room[i][1]));
      if (!stops.length) return;
      const [pr, pc] = room[pick(stops)];
      if (t === turns) {
        if (rng() < cfg.trailMineChance) grid[pr][pc] = { type: 'mine' };
        return;
      }
      const turnDir = rng() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
      const o = reflect('/', d) === turnDir ? '/' : '\\';
      grid[pr][pc] = { type: 'mirror', o: rng() < 0.5 ? o : (o === '/' ? '\\' : '/'), fixed: false };
      r = pr; c = pc; d = turnDir;
    }
  };
  for (const [r, c, d] of wrongTurns) {
    if (rng() < cfg.trailChance) trail(r, c, d, 1 + Math.floor(rng() * cfg.trailTurns));
  }

  place(cfg.walls, () => ({ type: 'wall' }));
  place(cfg.mines, () => ({ type: 'mine' }));
  place(cfg.decoys, () => ({
    type: rng() < cfg.splitChance / 2 ? 'splitter' : 'mirror',
    o: rng() < 0.5 ? '/' : '\\',
    fixed: rng() < cfg.fixedChance,
  }));

  // Lock some solution mirrors in their correct orientation.
  const movable = [];
  for (const [r, c] of pathPieces) {
    if (rng() < cfg.fixedChance) grid[r][c].fixed = true;
    else movable.push([r, c]);
  }
  if (!movable.length) return null;

  // Scramble: knock movable solution mirrors out of place (at least one,
  // usually most). Par = one tap to switch on each path mirror (locked ones
  // included), plus one to turn each scrambled one.
  let par = pathPieces.length;
  movable.forEach(([r, c], i) => {
    if (i === 0 || rng() < 0.85) {
      grid[r][c].o = grid[r][c].o === '/' ? '\\' : '/';
      par++;
    }
  });
  if (isSolved(grid)) return null;
  // Before any tap no mirror passes light; no crystal may be lit yet.
  if (traceBeams(grid, { isActive: () => false }).lit.size) return null;

  return { size: n, grid, solution, par };
}

const cache = new Map();

export function getLevel(levelNum) {
  if (cache.has(levelNum)) return cache.get(levelNum);
  const cfg = settingsFor(levelNum);
  let level = null;
  for (let attempt = 0; attempt < 400 && !level; attempt++) {
    const rng = makeRng(levelNum * 7919 + attempt * 104729 + 17);
    // If a big config keeps failing, ease off the turn count a step at a time.
    const ease = Math.floor(attempt / 50);
    const eased = ease ? { ...cfg, turns: Math.max(2, cfg.turns - ease) } : cfg;
    level = tryBuild(levelNum, rng, eased);
  }
  cache.set(levelNum, level);
  return level;
}

// Star rating from taps vs par. Using a hint caps it at 2 stars.
export function starsFor(taps, par, usedHint) {
  const stars = taps <= par ? 3 : taps <= par + 2 ? 2 : 1;
  return usedHint ? Math.min(stars, 2) : stars;
}

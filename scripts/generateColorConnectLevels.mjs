// Generates utils/colorConnectLevels.js — the 100 Color Connect levels.
//
//   node scripts/generateColorConnectLevels.mjs
//
// How a level is built (so it is always solvable with every cell filled):
//   1. Take a path that visits every cell of the n×n grid exactly once
//      (a Hamiltonian path). Start from a zig-zag and shuffle it with many
//      random "backbite" moves until it winds unpredictably.
//   2. Cut that path into k pieces. Each piece becomes one colour; its two
//      ends are that colour's dots. The pieces themselves are the solution,
//      and they cover the whole board with no overlaps.
//   3. Reject boards that would make dull puzzles (a colour's dots side by
//      side, a piece shorter than 3 cells) and, of the rest, keep the one
//      whose lines fold back on themselves least (fewer corner-cut shortcuts).
// Seeded RNG, so re-running produces the same levels.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateBoard, DOT_COLORS } from '../utils/colorConnect.js';

// [first level, last level, grid size, colours at start of band, at end]
// More colours = shorter, easier lines; fewer colours on a big grid = long
// winding lines that need every cell planned.
const BANDS = [
  [1, 5, 5, 5, 5],
  [6, 10, 5, 4, 4],
  [11, 20, 6, 6, 5],
  [21, 30, 7, 7, 6],
  [31, 45, 8, 8, 7],
  [46, 60, 9, 9, 8],
  [61, 80, 10, 11, 10],
  [81, 100, 10, 10, 9],
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const neighbours = (n, cell) => {
  const r = Math.floor(cell / n), c = cell % n, out = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
};

function hamiltonianPath(n, rand) {
  const path = [];
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < n; i++) path.push(r * n + (r % 2 ? n - 1 - i : i));
  }
  // Backbite: pick an end, join it to a random grid neighbour that's on the
  // path, and reverse the loop that forms. Always stays a valid path.
  const steps = 40 * n * n;
  for (let s = 0; s < steps; s++) {
    if (rand() < 0.5) path.reverse();
    const end = path[path.length - 1];
    const nb = neighbours(n, end);
    const pick = nb[Math.floor(rand() * nb.length)];
    const i = path.indexOf(pick);
    if (i === path.length - 2) continue;
    const tail = path.splice(i + 1).reverse();
    path.push(...tail);
  }
  return path;
}

const adjacent = (n, a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n)) === 1;

// Places where a line touches itself (two cells next to each other on the
// grid but not consecutive on the line) — each is a spot where the player
// could cut the corner.
function selfTouches(n, seg) {
  let t = 0;
  for (let i = 0; i < seg.length; i++) {
    for (let j = i + 2; j < seg.length; j++) if (adjacent(n, seg[i], seg[j])) t++;
  }
  return t;
}

function cut(path, k, rand) {
  const lengths = new Array(k).fill(3);
  let spare = path.length - 3 * k;
  // Uneven split: some long snakes, some short ones.
  const weights = lengths.map(() => 0.3 + rand() * rand() * 3);
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < k; i++) {
    const add = Math.floor((weights[i] / sum) * (path.length - 3 * k));
    lengths[i] += add;
    spare -= add;
  }
  while (spare-- > 0) lengths[Math.floor(rand() * k)] += 1;
  const segs = [];
  let at = 0;
  for (const len of lengths) { segs.push(path.slice(at, at + len)); at += len; }
  return segs;
}

// Scores CANDIDATES valid boards and keeps the one whose lines fold back on
// themselves the least (gives up after MAX_TRIES attempts).
const CANDIDATES = 300;
const MAX_TRIES = 6000;

function makeLevel(num, n, k) {
  const rand = mulberry32(num * 7919 + 17);
  let best = null, bestTouches = Infinity, found = 0;
  for (let tries = 0; tries < MAX_TRIES && found < CANDIDATES; tries++) {
    const segs = cut(hamiltonianPath(n, rand), k, rand);
    if (segs.some((s) => s.length < 3 || adjacent(n, s[0], s[s.length - 1]))) continue;
    found++;
    const touches = segs.reduce((t, s) => t + selfTouches(n, s), 0);
    if (touches < bestTouches) { best = segs; bestTouches = touches; }
    if (touches === 0) break;
  }
  if (!best) throw new Error(`level ${num}: no board found`);
  // Shuffle which colour each piece gets so colours aren't in board order.
  for (let i = best.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [best[i], best[j]] = [best[j], best[i]];
  }
  const dots = best.map((s) => [s[0], s[s.length - 1]]);
  const check = validateBoard(n, best, dots);
  if (!check.ok) throw new Error(`level ${num}: generator bug (${check.reason})`);
  return { n, paths: best };
}

const levels = [];
for (const [from, to, n, kStart, kEnd] of BANDS) {
  for (let num = from; num <= to; num++) {
    const t = to === from ? 0 : (num - from) / (to - from);
    const k = Math.round(kStart + (kEnd - kStart) * t);
    if (k > DOT_COLORS.length) throw new Error('not enough colours');
    levels.push(makeLevel(num, n, k));
  }
}

const out = [
  '// GENERATED by scripts/generateColorConnectLevels.mjs — do not edit by hand.',
  '// Each level: n = grid size, paths = the solution, one cell list per colour',
  '// (cell = row * n + col). Each list\'s first and last cells are the dots.',
  'export const LEVELS = [',
  ...levels.map((lv) => `  ${JSON.stringify(lv)},`),
  '];',
  '',
].join('\n');

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, '..', 'utils', 'colorConnectLevels.js'), out);
console.log(`Wrote ${levels.length} levels.`);

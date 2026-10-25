// Checks every Color Connect level and the drawing / win rules.
//
//   node scripts/testColorConnect.mjs
import assert from 'node:assert/strict';
import {
  makeLevel, validateBoard, progressOf, beginDrag, extendDrag, applyDrag, tidy,
  applyHint, emptyPaths, isConnected, walkBetween, DOT_COLORS,
} from '../utils/colorConnect.js';
import { LEVELS } from '../utils/colorConnectLevels.js';

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); } catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

// Plays one finger drag through `cells` (first cell = where the finger went
// down) and returns the board after release, like the screen does.
function drag(level, paths, cells) {
  let d = beginDrag(paths, level.dots, level.n, cells[0]);
  if (!d) return paths;
  for (const cell of cells.slice(1)) d = { ...d, path: extendDrag(d, level.dots, level.n, cell) };
  return tidy(applyDrag(paths, d));
}

console.log('Levels');
test('at least 100 levels', () => assert.ok(LEVELS.length >= 100));
LEVELS.forEach((raw, i) => {
  const num = i + 1;
  const lv = makeLevel(raw);
  test(`level ${num} (${lv.n}x${lv.n}, ${lv.dots.length} colours) solvable with every cell filled`, () => {
    assert.ok(lv.dots.length <= DOT_COLORS.length, 'more colours than the palette');
    const all = lv.dots.flat();
    assert.equal(new Set(all).size, all.length, 'two dots share a cell');
    const v = validateBoard(lv.n, lv.solution, lv.dots);
    assert.ok(v.ok, v.reason);
    const cells = lv.solution.reduce((t, p) => t + p.length, 0);
    assert.equal(cells, lv.n * lv.n, 'solution does not cover rows x columns');
    lv.solution.forEach((p) => assert.ok(p.length >= 3, 'line shorter than 3'));
    // Drawn by "finger" through the real drawing code, it must win.
    let paths = emptyPaths(lv.dots);
    lv.solution.forEach((p) => { paths = drag(lv, paths, p); });
    assert.ok(validateBoard(lv.n, paths, lv.dots).ok, 'drawing the solution does not win');
  });
});
test('difficulty never shrinks the grid', () => {
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].n >= LEVELS[i - 1].n, `level ${i + 1}`);
  assert.equal(LEVELS[0].n, 5);
  assert.equal(LEVELS[LEVELS.length - 1].n, 10);
});

console.log('Validation');
const L = makeLevel(LEVELS[0]);
const n = L.n;
const solved = L.solution.map((p) => p.slice());
test('full correct board wins', () => assert.ok(validateBoard(n, solved, L.dots).ok));
test('pair connected but one empty cell does not win', () => {
  // 3x3: red goes around the edge, centre left empty -> 8/9 filled.
  const dots = [[0, 3]];
  const paths = [[0, 1, 2, 5, 8, 7, 6, 3]];
  const v = validateBoard(3, paths, dots);
  assert.ok(!v.ok && /1 empty/.test(v.reason), v.reason);
  assert.deepEqual(progressOf(3, paths, dots), { filled: 8, total: 9, connected: 1, pairs: 1 });
});
test('overlap rejected', () => {
  const dots = [[0, 2], [3, 5]];
  assert.ok(!validateBoard(3, [[0, 1, 2], [3, 4, 1, 4, 5]], dots).ok);
});
test('diagonal step rejected', () => {
  assert.ok(!validateBoard(2, [[0, 3], [1, 2]], [[0, 3], [1, 2]]).ok);
});
test('line through another colour dot rejected', () => {
  const dots = [[0, 2], [1, 7]];
  assert.ok(!validateBoard(3, [[0, 1, 2], [1, 4, 7]], dots).ok);
});
test('unconnected line rejected', () => {
  const dots = [[0, 8]];
  assert.ok(!validateBoard(3, [[0, 1, 2, 5, 4, 3, 6, 7]], dots).ok);
});

console.log('Drawing');
// 3x3 board: red 0..2 across the top, blue 6..8 across the bottom, green 3..5.
const B = { n: 3, dots: [[0, 2], [3, 5], [6, 8]] };
test('cannot start on an empty cell', () => assert.equal(beginDrag(emptyPaths(B.dots), B.dots, 3, 4), null));
test('no diagonal moves', () => {
  const d = beginDrag(emptyPaths(B.dots), B.dots, 3, 0);
  assert.deepEqual(extendDrag(d, B.dots, 3, 4), [0]);
});
test('cannot enter another colour dot', () => {
  const d = beginDrag(emptyPaths(B.dots), B.dots, 3, 0);
  assert.deepEqual(extendDrag(d, B.dots, 3, 3), [0]);
});
test('connect a pair', () => {
  const p = drag(B, emptyPaths(B.dots), [0, 1, 2]);
  assert.ok(isConnected(p[0], B.dots[0]));
});
test('finished line stops at its dot', () => {
  let d = beginDrag(emptyPaths(B.dots), B.dots, 3, 0);
  for (const c of [1, 2]) d = { ...d, path: extendDrag(d, B.dots, 3, c) };
  assert.deepEqual(extendDrag(d, B.dots, 3, 5), [0, 1, 2]);
});
test('backtracking shortens the line', () => {
  let d = beginDrag(emptyPaths(B.dots), B.dots, 3, 3);
  for (const c of [4, 1, 4]) d = { ...d, path: extendDrag(d, B.dots, 3, c) };
  assert.deepEqual(d.path, [3, 4]);
});
test('crossing a line cuts it, backing off restores it', () => {
  const base = drag(B, emptyPaths(B.dots), [3, 4, 5]);
  let d = beginDrag(base, B.dots, 3, 0);
  d = { ...d, path: extendDrag(d, B.dots, 3, 1) };
  d = { ...d, path: extendDrag(d, B.dots, 3, 4) };
  assert.deepEqual(applyDrag(base, d)[1], [3], 'green cut at the crossing');
  d = { ...d, path: extendDrag(d, B.dots, 3, 1) };
  assert.deepEqual(applyDrag(base, d)[1], [3, 4, 5], 'green restored');
});
test('redraw from a dot clears the old line', () => {
  const base = drag(B, emptyPaths(B.dots), [0, 1, 2]);
  const p = drag(B, base, [2]);
  assert.deepEqual(p[0], []);
});
test('drag from middle of a line continues from there', () => {
  const base = drag(B, emptyPaths(B.dots), [3, 4]);
  const d = beginDrag(base, B.dots, 3, 4);
  assert.deepEqual(d.path, [3, 4]);
});
test('fast swipe replays the skipped cells one step at a time', () => {
  assert.deepEqual(walkBetween(5, 0, 3), [1, 2, 3]);
  assert.deepEqual(walkBetween(5, 0, 11), [5, 10, 11]);
});
test('hints alone solve every level', () => {
  for (const raw of LEVELS) {
    const lv = makeLevel(raw);
    let paths = emptyPaths(lv.dots);
    for (let i = 0; i < lv.dots.length * 2; i++) {
      const h = applyHint(paths, lv);
      if (!h) break;
      paths = h.paths;
    }
    assert.ok(validateBoard(lv.n, paths, lv.dots).ok);
  }
});

console.log(failures ? `\n${failures} FAILED` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);

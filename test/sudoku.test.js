const test = require('node:test');
const assert = require('node:assert');
const { SIZES, boxDims, solvedGrid, countSolutions, generate, judge } = require('../sudoku');

test('box dims multiply to the size and are never a full row (except 2)', () => {
  for (const n of SIZES) {
    const [r, c] = boxDims(n);
    assert.strictEqual(r * c, n);
    if (n > 2) assert.ok(r > 1, `${n} has ${r}x${c} boxes`);
  }
});

test('solved grids follow the rules for every size', () => {
  for (const n of SIZES) {
    const grid = solvedGrid(n);
    assert.deepStrictEqual(judge(grid, grid, n), { solved: true, wrong: [], empty: 0 });
  }
});

test('generated puzzles keep givens from the solution and are uniquely solvable', () => {
  for (const n of SIZES) {
    const { puzzle, solution } = generate(n);
    puzzle.forEach((v, i) => { if (v !== null) assert.strictEqual(v, solution[i]); });
    assert.ok(puzzle.some(v => v === null), `${n}x${n} has empty cells`);
    if (n <= 12) assert.strictEqual(countSolutions(puzzle, n, 2, 1e6), 1);
  }
});

test('judge flags conflicting user cells, not givens', () => {
  const n = 4;
  const solution = solvedGrid(n);
  const puzzle = solution.slice();
  puzzle[0] = null;
  puzzle[1] = null;
  const grid = puzzle.slice();
  // Same emoji twice in row 0
  grid[0] = solution[1];
  grid[1] = solution[1];
  const result = judge(puzzle, grid, n);
  assert.strictEqual(result.solved, false);
  assert.deepStrictEqual(result.wrong, [0, 1]);
  assert.strictEqual(result.empty, 0);
});

test('judge counts empty cells and ignores tampered givens', () => {
  const n = 4;
  const solution = solvedGrid(n);
  const puzzle = solution.slice();
  puzzle[5] = null;
  const grid = solution.slice();
  grid[5] = null;
  grid[0] = (solution[0] + 1) % n; // client tries to overwrite a given
  assert.deepStrictEqual(judge(puzzle, grid, n), { solved: false, wrong: [], empty: 1 });
  grid[5] = solution[5];
  assert.strictEqual(judge(puzzle, grid, n).solved, true);
});

test('any valid fill counts as solved, even if it differs from the stored solution', () => {
  const n = 4;
  const a = solvedGrid(n);
  const empty = new Array(n * n).fill(null);
  assert.strictEqual(judge(empty, a, n).solved, true);
});

// Sizes whose boxes form a real rectangle. Primes are excluded since their only "box" would be a
// full row; 2 (1x2 boxes) stays in as a joke warm-up size.
const SIZES = [2, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
const REMOVE_FRACTION = 0.6;
// Low on purpose: checks that would need deep search just keep the cell, which costs almost no clues
// but keeps 20x20 generation well under a second.
const SOLVER_BUDGET = 1000;

// Box is boxRows x boxCols, as square as possible with boxRows <= boxCols.
function boxDims(n) {
  for (let r = Math.floor(Math.sqrt(n)); r >= 1; r--) {
    if (n % r === 0) return [r, n / r];
  }
}

const range = n => Array.from({ length: n }, (_, i) => i);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function boxIndex(r, c, n) {
  const [br, bc] = boxDims(n);
  return Math.floor(r / br) * br + Math.floor(c / bc);
}

// Every row, column and box as a list of cell indices.
function units(n) {
  const rows = range(n).map(r => range(n).map(c => r * n + c));
  const cols = range(n).map(c => range(n).map(r => r * n + c));
  const boxes = range(n).map(() => []);
  for (let i = 0; i < n * n; i++) boxes[boxIndex(Math.floor(i / n), i % n, n)].push(i);
  return [...rows, ...cols, ...boxes];
}

// A valid full grid from the classic shifted pattern, randomized by shuffling bands, rows within
// bands, stacks, columns within stacks and the symbols. Instant even at 20x20, unlike backtracking.
function solvedGrid(n) {
  const [br, bc] = boxDims(n);
  const rows = shuffle(range(bc)).flatMap(band => shuffle(range(br)).map(r => band * br + r));
  const cols = shuffle(range(br)).flatMap(stack => shuffle(range(bc)).map(c => stack * bc + c));
  const symbols = shuffle(range(n));
  const grid = new Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const rr = rows[r];
      grid[r * n + c] = symbols[(bc * (rr % br) + Math.floor(rr / br) + cols[c]) % n];
    }
  }
  return grid;
}

function popcount(x) {
  let count = 0;
  for (; x; count++) x &= x - 1;
  return count;
}

// Counts solutions up to `limit`. Returns -1 if the search budget runs out (treated as "not unique").
function countSolutions(grid, n, limit = 2, budget = SOLVER_BUDGET) {
  const full = (1 << n) - 1;
  const rowM = new Array(n).fill(0);
  const colM = new Array(n).fill(0);
  const boxM = new Array(n).fill(0);
  const cellR = [], cellC = [], cellB = [];
  const cells = grid.slice();
  const empties = [];

  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, b = boxIndex(r, c, n);
    cellR[i] = r; cellC[i] = c; cellB[i] = b;
    if (cells[i] === null) { empties.push(i); continue; }
    const bit = 1 << cells[i];
    if ((rowM[r] | colM[c] | boxM[b]) & bit) return 0;
    rowM[r] |= bit; colM[c] |= bit; boxM[b] |= bit;
  }

  let count = 0, nodes = 0, aborted = false;

  function search() {
    if (++nodes > budget) { aborted = true; return; }
    // Branch on the empty cell with the fewest candidates.
    let best = -1, bestMask = 0, bestCount = n + 1;
    for (const i of empties) {
      if (cells[i] !== null) continue;
      const mask = full & ~(rowM[cellR[i]] | colM[cellC[i]] | boxM[cellB[i]]);
      const cnt = popcount(mask);
      if (cnt === 0) return;
      if (cnt < bestCount) { best = i; bestMask = mask; bestCount = cnt; if (cnt === 1) break; }
    }
    if (best === -1) { count++; return; }

    const r = cellR[best], c = cellC[best], b = cellB[best];
    for (let mask = bestMask; mask; mask &= mask - 1) {
      const bit = mask & -mask;
      cells[best] = 31 - Math.clz32(bit);
      rowM[r] |= bit; colM[c] |= bit; boxM[b] |= bit;
      search();
      rowM[r] &= ~bit; colM[c] &= ~bit; boxM[b] &= ~bit;
      cells[best] = null;
      if (count >= limit || aborted) return;
    }
  }

  search();
  return aborted ? -1 : count;
}

// Removes cells in random order, keeping each removal only if the puzzle stays uniquely solvable.
function generate(n) {
  const [boxRows, boxCols] = boxDims(n);
  const solution = solvedGrid(n);
  const puzzle = solution.slice();
  const maxRemove = Math.floor(n * n * REMOVE_FRACTION);
  let removed = 0;
  for (const i of shuffle(range(n * n))) {
    if (removed >= maxRemove) break;
    const value = puzzle[i];
    puzzle[i] = null;
    if (countSolutions(puzzle, n) === 1) removed++;
    else puzzle[i] = value;
  }
  return { size: n, boxRows, boxCols, puzzle, solution };
}

// Judges by the rules rather than against a stored solution, so any valid fill counts as solved.
// Givens from the puzzle always win over whatever the client sent for those cells.
function judge(puzzle, grid, n) {
  const cells = puzzle.map((given, i) => (given !== null ? given : grid[i]));
  const bad = new Set();
  for (const unit of units(n)) {
    const seen = new Map();
    for (const i of unit) {
      if (cells[i] === null) continue;
      if (!seen.has(cells[i])) seen.set(cells[i], []);
      seen.get(cells[i]).push(i);
    }
    for (const group of seen.values()) {
      if (group.length > 1) group.forEach(i => bad.add(i));
    }
  }
  const wrong = [...bad].filter(i => puzzle[i] === null).sort((a, b) => a - b);
  const empty = cells.filter(v => v === null).length;
  return { solved: empty === 0 && wrong.length === 0, wrong, empty };
}

module.exports = { SIZES, boxDims, solvedGrid, countSolutions, generate, judge };

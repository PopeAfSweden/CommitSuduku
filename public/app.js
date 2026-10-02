// Every theme needs at least 20 emojis (the largest grid). Single-codepoint emojis only, so they
// render as one glyph on Windows without variation selectors or ZWJ sequences.
const THEMES = {
  'Memes 💀': [...'💀🗿🔥💯👀🧢🍿🤌🥲🤡🐸🚀📉📈🧠🤑😤🙃🤷🐐👑🎯💅🦆🍷'],
  'Animals 🐶': [...'🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦆🦉🐺🐗🐴🦄🐝'],
  'Food 🍕': [...'🍎🍌🍇🍉🍓🍒🍑🍍🥝🥑🍆🥕🌽🍕🍔🍟🌭🌮🍩🍪🎂🍫🍿🧀🥐'],
  'Faces 😎': [...'😀😂🤣😊😍😎🤓🤔😐🙄😏😴🤯😱😡🥶🥵🤢🤠🥳😭😬🤡👽🤖'],
  'Nature 🌈': [...'🌞🌝⭐🌈⚡🌙🌍🪐🌵🌲🌻🌹🍄🌊💧🌋🌸🍁🍀🌷🐚🌴🌾🌑🌟'],
  'Games ⚽': [...'⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🥊🎳⛳🏒🥏🛹🎮🎲🧩🎸🎺🥁🎻🎹🎨'],
};

const SIZES = [2, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];

// {wrong}, {empty}, {time} and {attempts} are filled in from the judge result.
const MEMES = {
  nothing: [
    ['Bro really clicked Judge me', 'on an empty board', '💀'],
    ['Ah yes', 'the speedrun strat: do nothing', '🗿'],
    ['Error 404', 'effort not found', '🤖'],
    ['Sir, this is a Sudoku', 'you have to actually put emojis in it', '🙄'],
  ],
  incomplete: [
    ['No mistakes?', "That's because you didn't finish. {empty} empty", '🧢'],
    ['Task failed successfully', 'still {empty} empty', '🎯'],
    ["You're not done, chief", 'Empty cells left: {empty}. They judge YOU', '👀'],
    ['Wow, zero errors', 'now do the other {empty}', '👏'],
  ],
  few: [
    ['So close', 'yet so embarrassing. {wrong} wrong', '🤏'],
    ['You had one job', 'and still got {wrong} wrong', '🤡'],
    ["I'm not mad", 'just disappointed. {wrong} wrong', '😔'],
    ['Visible confusion', '{wrong} wrong. The grid said no', '🧐'],
  ],
  many: [
    ["That's a lot of damage", '{wrong} wrong cells', '💥'],
    ['This is fine', '{wrong} things are on fire', '🔥'],
    ['Skill issue', 'times {wrong}', '📉'],
    ['Emotional damage', '{wrong} wrong. Your ancestors felt that', '😭'],
    ['Bro really thought', '{wrong} wrong cells was a strategy', '🤨'],
  ],
  tons: [
    ["It's over nine!", "{wrong} mistakes. That's not a power level, that's a cry for help", '💥'],
    ['Ight imma head out', '{wrong} errors is above my pay grade', '🚶'],
    ['Press F', 'to pay respects. {wrong} cells died here', '🙏'],
    ['Did you just', 'pick emojis by vibes? {wrong} wrong', '🎲'],
    ['Certified bruh moment', '{wrong} wrong cells', '🗿'],
  ],
  solved: [
    ['Stonks', "Solved in {time}. Don't get used to it", '📈'],
    ['GG EZ', '{time}. OK, maybe not EZ for you', '😎'],
    ['Fine. You win.', "{time}. I'll pretend I'm impressed", '🙄'],
    ['Not bad', '...for a human. {time}', '🤖'],
    ['Look at you', 'solving puzzles like a big kid. {time}', '👶'],
  ],
  slow: [
    ['Finally', 'only took {attempts} judgments. {time}', '🐌'],
    ['Persistence', 'is just failing {attempts} times in a row. {time}', '🥱'],
  ],
  record: [
    ['New #1', '{time}. The bar was on the floor, but still', '👑'],
    ['Absolute unit', '{time}. Top of the Hall of Fame', '🐐'],
  ],
  lost: [
    ['Who are you?', 'The server forgot your game. Start a new one', '🤷'],
  ],
};

const $ = id => document.getElementById(id);
const els = {
  size: $('size'), theme: $('theme'), name: $('name'), newGame: $('new'),
  timer: $('timer'), info: $('info'), board: $('board'), palette: $('palette'), judge: $('judge'),
  top: $('top'), recent: $('recent'), lbSize: $('lb-size'),
  verdict: $('verdict'), vTop: $('v-top'), vEmoji: $('v-emoji'), vBottom: $('v-bottom'),
  vStats: $('v-stats'), vClose: $('v-close'),
};

let game = null;
let grid = [];
let selected = -1;
let wrong = new Set();
let solved = false;
let timerId = 0;

// localStorage only remembers UI preferences; scores live on the server.
function pref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

const emojis = () => THEMES[els.theme.value];
const pick = list => list[Math.floor(Math.random() * list.length)];

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const pad = x => String(x).padStart(2, '0');
  const hms = s >= 3600 ? [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60] : [Math.floor(s / 60), s % 60];
  return hms.map(pad).join(':');
}

async function api(url, body) {
  const res = await fetch(url, body && {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function newGame() {
  const size = Number(els.size.value);
  els.newGame.disabled = els.judge.disabled = true;
  els.info.textContent = size >= 14 ? 'Cooking a big one...' : '';
  const { data } = await api('/api/new', { size });
  game = data;
  grid = game.puzzle.slice();
  selected = -1;
  wrong = new Set();
  solved = false;
  els.newGame.disabled = els.judge.disabled = false;
  els.info.textContent = `${size}x${size} · boxes ${game.boxRows}x${game.boxCols}`;
  buildBoard();
  buildPalette();
  startTimer();
  loadScores();
}

function startTimer() {
  clearInterval(timerId);
  const start = Date.now();
  els.timer.textContent = formatTime(0);
  timerId = setInterval(() => { els.timer.textContent = formatTime(Date.now() - start); }, 1000);
}

function buildBoard() {
  const { size: n, boxRows, boxCols } = game;
  els.board.style.setProperty('--n', n);
  els.board.replaceChildren(...grid.map((_, i) => {
    const r = Math.floor(i / n), c = i % n;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;
    if (c % boxCols === boxCols - 1 && c < n - 1) cell.classList.add('box-r');
    if (r % boxRows === boxRows - 1 && r < n - 1) cell.classList.add('box-b');
    if (game.puzzle[i] !== null) cell.classList.add('given');
    return cell;
  }));
  render();
}

function buildPalette() {
  const buttons = emojis().slice(0, game.size).map((emoji, v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = emoji;
    b.dataset.v = v;
    return b;
  });
  const eraser = document.createElement('button');
  eraser.type = 'button';
  eraser.textContent = '⌫';
  eraser.title = 'Clear cell';
  eraser.dataset.v = '';
  els.palette.replaceChildren(...buttons, eraser);
  render();
}

function sameUnit(a, b) {
  const n = game.size;
  const [ra, ca, rb, cb] = [Math.floor(a / n), a % n, Math.floor(b / n), b % n];
  return ra === rb || ca === cb ||
    (Math.floor(ra / game.boxRows) === Math.floor(rb / game.boxRows) &&
     Math.floor(ca / game.boxCols) === Math.floor(cb / game.boxCols));
}

function render() {
  if (!game) return;
  const set = emojis();
  const sel = selected >= 0 ? grid[selected] : null;
  [...els.board.children].forEach((cell, i) => {
    cell.textContent = grid[i] === null ? '' : set[grid[i]];
    cell.classList.toggle('selected', i === selected);
    cell.classList.toggle('peer', selected >= 0 && i !== selected && sameUnit(i, selected));
    cell.classList.toggle('same', sel !== null && i !== selected && grid[i] === sel);
    cell.classList.toggle('wrong', wrong.has(i));
  });
  const counts = new Array(game.size).fill(0);
  grid.forEach(v => { if (v !== null) counts[v]++; });
  [...els.palette.children].forEach(b => {
    b.classList.toggle('done', b.dataset.v !== '' && counts[b.dataset.v] >= game.size);
  });
}

function place(v) {
  if (!game || solved || selected < 0 || game.puzzle[selected] !== null) return;
  grid[selected] = v;
  wrong.delete(selected);
  render();
}

async function judgeMe() {
  if (!game || solved) return;
  els.judge.disabled = true;
  const { status, data } = await api('/api/judge', { id: game.id, grid, name: els.name.value });
  els.judge.disabled = false;
  if (status === 404) return showVerdict(pick(MEMES.lost), '');

  wrong = new Set(data.wrong);
  const vars = { wrong: data.wrong.length, empty: data.empty, attempts: data.attempts, time: '' };
  let meme, stats;
  if (data.solved) {
    solved = true;
    clearInterval(timerId);
    vars.time = formatTime(data.timeMs);
    els.timer.textContent = vars.time;
    meme = pick(data.rank === 1 ? MEMES.record : data.attempts > 3 ? MEMES.slow : MEMES.solved);
    stats = `⏱ ${vars.time} · rank #${data.rank} on ${game.size}x${game.size} · judged ${data.attempts}x`;
    loadScores();
  } else {
    const filled = grid.some((v, i) => v !== null && game.puzzle[i] === null);
    const n = vars.wrong;
    meme = pick(!filled ? MEMES.nothing : n === 0 ? MEMES.incomplete : n <= 3 ? MEMES.few : n <= 9 ? MEMES.many : MEMES.tons);
    stats = `❌ ${n} wrong · ⬜ ${data.empty} empty · judgment #${data.attempts}`;
  }
  render();
  showVerdict(meme.map(text => text.replace(/\{(\w+)\}/g, (_, k) => vars[k])), stats);
}

function showVerdict([top, bottom, emoji], stats) {
  els.vTop.textContent = top;
  els.vBottom.textContent = bottom;
  els.vEmoji.textContent = emoji;
  els.vStats.textContent = stats;
  els.verdict.hidden = false;
  els.vClose.focus();
}

function closeVerdict() {
  els.verdict.hidden = true;
}

function row(cells) {
  const tr = document.createElement('tr');
  for (const [text, cls] of cells) {
    const td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.append(td);
  }
  return tr;
}

function emptyRow(text, cols) {
  const tr = row([[text, 'empty']]);
  tr.firstChild.colSpan = cols;
  return tr;
}

async function loadScores() {
  const size = Number(els.size.value);
  const { data } = await api(`/api/scores?size=${size}`);
  els.lbSize.textContent = `${size}x${size}`;
  els.top.replaceChildren(...(data.top.length
    ? data.top.map((s, i) => row([[i + 1], [s.name, 'name'], [formatTime(s.timeMs)], [`${s.attempts}x`]]))
    : [emptyRow('Nobody yet. Low bar, go.', 4)]));
  els.recent.replaceChildren(...(data.recent.length
    ? data.recent.map(s => row([[s.name, 'name'], [`${s.size}x${s.size}`], [formatTime(s.timeMs)], [new Date(s.date).toLocaleDateString()]]))
    : [emptyRow('No victims yet', 4)]));
}

function moveSelection(dr, dc) {
  const n = game.size;
  if (selected < 0) { selected = 0; return render(); }
  const r = (Math.floor(selected / n) + dr + n) % n;
  const c = (selected % n + dc + n) % n;
  selected = r * n + c;
  render();
}

function init() {
  els.size.append(...SIZES.map(n => new Option(`${n} x ${n}`, n)));
  els.theme.append(...Object.keys(THEMES).map(name => new Option(name, name)));
  els.size.value = pref('size', '9');
  els.theme.value = pref('theme', Object.keys(THEMES)[0]);
  if (!els.size.value) els.size.value = '9';
  if (!els.theme.value) els.theme.value = Object.keys(THEMES)[0];
  els.name.value = pref('name', '');

  els.size.addEventListener('change', () => { savePref('size', els.size.value); newGame(); });
  els.theme.addEventListener('change', () => { savePref('theme', els.theme.value); if (game) buildPalette(); });
  els.name.addEventListener('change', () => savePref('name', els.name.value));
  els.newGame.addEventListener('click', newGame);
  els.judge.addEventListener('click', judgeMe);
  els.vClose.addEventListener('click', closeVerdict);
  els.verdict.addEventListener('click', e => { if (e.target === els.verdict) closeVerdict(); });

  els.board.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    selected = Number(cell.dataset.i);
    render();
  });

  els.palette.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) place(b.dataset.v === '' ? null : Number(b.dataset.v));
  });

  document.addEventListener('keydown', e => {
    if (!els.verdict.hidden) {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeVerdict(); }
      return;
    }
    if (!game || e.target.matches('input, select')) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[e.key]) { e.preventDefault(); moveSelection(...arrows[e.key]); }
    else if (e.key === 'Backspace' || e.key === 'Delete') place(null);
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= game.size) place(Number(e.key) - 1);
  });

  newGame();
}

init();

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { SIZES, generate, judge } = require('./sudoku');

const PORT = Number(process.env.PORT) || 3000;
// 0.0.0.0 makes the game reachable from other machines on the network. Use HOST=127.0.0.1 for local only.
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data', 'scores.json');
const MAX_SCORES = 5000;
const MAX_GAMES = 1000;
const GAME_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BODY = 64 * 1024;

// Only these files are served, so a request path never maps onto the filesystem directly.
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

let scores = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : [];

// Puzzles and start times live only on the server: the client never gets the solution and
// cannot report its own solve time.
const games = new Map();

function saveScores() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
  // Write-then-rename so a crash mid-write can't leave a half-written scores file.
  fs.renameSync(tmp, DATA_FILE);
}

function pruneGames() {
  const now = Date.now();
  for (const [id, game] of games) {
    if (now - game.start > GAME_TTL_MS) games.delete(id);
  }
  // Map keeps insertion order, so the first key is the oldest game.
  while (games.size >= MAX_GAMES) games.delete(games.keys().next().value);
}

function cleanName(name) {
  return String(name ?? '').replace(/\p{C}/gu, '').trim().slice(0, 24) || 'Anonymous';
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type });
  res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Body too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && STATIC[url.pathname]) {
    const [file, type] = STATIC[url.pathname];
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', file)), type);
  }

  if (req.method === 'GET' && url.pathname === '/api/scores') {
    const size = Number(url.searchParams.get('size'));
    const top = scores
      .filter(s => s.size === size)
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, 10);
    const recent = scores.slice(-10).reverse();
    return send(res, 200, { top, recent });
  }

  if (req.method === 'POST' && url.pathname === '/api/new') {
    const { size } = await readJson(req);
    if (!SIZES.includes(size)) return send(res, 400, { error: 'Invalid size' });
    pruneGames();
    const { puzzle, boxRows, boxCols } = generate(size);
    const id = crypto.randomUUID();
    games.set(id, { size, puzzle, start: Date.now(), attempts: 0 });
    return send(res, 200, { id, size, boxRows, boxCols, puzzle });
  }

  if (req.method === 'POST' && url.pathname === '/api/judge') {
    const { id, grid, name } = await readJson(req);
    const game = games.get(id);
    if (!game) return send(res, 404, { error: 'Game not found' });

    const n = game.size;
    const validGrid = Array.isArray(grid) && grid.length === n * n &&
      grid.every(v => v === null || (Number.isInteger(v) && v >= 0 && v < n));
    if (!validGrid) return send(res, 400, { error: 'Invalid grid' });

    game.attempts++;
    const result = judge(game.puzzle, grid, n);
    if (!result.solved) return send(res, 200, { ...result, attempts: game.attempts });

    games.delete(id);
    const entry = {
      name: cleanName(name),
      size: n,
      timeMs: Date.now() - game.start,
      attempts: game.attempts,
      date: new Date().toISOString(),
    };
    scores.push(entry);
    if (scores.length > MAX_SCORES) scores = scores.slice(-MAX_SCORES);
    saveScores();
    const rank = 1 + scores.filter(s => s.size === n && s.timeMs < entry.timeMs).length;
    return send(res, 200, { ...result, attempts: entry.attempts, timeMs: entry.timeMs, rank });
  }

  send(res, 404, { error: 'Not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 400, { error: 'Bad request' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Emoji Sudoku running on http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    for (const iface of Object.values(os.networkInterfaces()).flat()) {
      if (iface.family === 'IPv4' && !iface.internal) console.log(`  on your network: http://${iface.address}:${PORT}`);
    }
  }
});

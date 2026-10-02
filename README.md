# Emoji Sudoku

Sudoku with emojis instead of numbers, sizes from 2x2 to 20x20, and a "Judge me" button that roasts you.

## Run

Requires Node 18+. No dependencies.

```sh
npm start          # http://localhost:3000, also reachable from other machines on your network
npm test
```

| Env var | Default   | Purpose                                   |
|---------|-----------|-------------------------------------------|
| `PORT`  | `3000`    | Port to listen on                         |
| `HOST`  | `0.0.0.0` | Use `127.0.0.1` to allow this machine only |

On first start Windows asks whether to allow Node through the firewall. Allow it on private networks if other devices should reach the game. Reaching it from the internet also needs port forwarding on your router. There is no login, so anyone who can reach the port can play and post scores.

## Sizes

Only sizes that split into rectangular boxes are offered: 2, 4, 6, 8, 9, 10, 12, 14, 15, 16, 18 and 20. Boxes are as square as possible (for example 20 = 4x5, 14 = 2x7).

## How scores are stored

Scores go in `data/scores.json` (gitignored) and are written atomically, so a crash can't leave a half-written file.

The server owns the game: it generates the puzzle, records the start time, judges the grid and computes the solve time. The client never sees a solution and can't submit its own time, so faking a highscore takes more than editing a request. Names are length-limited, stripped of control characters, and rendered as text only. Requests are capped at 64 KB, at most 1000 games are held in memory, and only the three files in `public/` are served.

Solving is judged by the rules (every row, column and box has each emoji once), not against a stored answer.

To reset scores, stop the server and delete `data/scores.json`.

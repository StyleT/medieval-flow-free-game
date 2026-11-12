# Flow

A Flow Free–style puzzle game. Drag pipes between same-colored dots. Pipes can't cross, and a level is solved when every pair is connected and every cell is filled. Built with TypeScript, React 19, Vite and Vitest. It is mobile-first and works with touch, mouse and pen.

## Run it

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173 (also reachable on your LAN, for phone testing)
```

| Command | Purpose |
|---|---|
| `npm test` | all tests (Vitest, jsdom for UI) |
| `npm run typecheck` | `tsc -b` |
| `npm run build` | production build into `dist/` |
| `npm run gen:levels` | regenerate `src/engine/levels.data.ts` (several minutes, one process per core, finished levels cached in `scripts/.cache/`) |
| `npm run bench:gen` | generator timing at 11×11 and 15×15 |
| `npm run test:mutation` | Stryker mutation testing on `src/engine/` (about 7 minutes, see below) |

## How to play

1. **Pick or create a player.** Names are 1–16 characters, unique ignoring case. There are no passwords, and profiles live in this browser's `localStorage`.
2. **Pick a level.** There are 15, from 5×5 with 4 flows to 15×15 with 14 flows. Level *n* unlocks when level *n−1* is solved. Flow counts follow one rule, `flowsFor(rows, cols) = min(16, round(√(rows·cols)) − 1)`:

   | Level | Board | Flows | | Level | Board | Flows |
   |---|---|---|---|---|---|---|
   | 1 | 5×5 | 4 | | 9 | 11×11 | 10 |
   | 2 | 6×6 | 5 | | 10 | 12×11 | 10 |
   | 3 | 7×7 | 6 | | 11 | 12×12 | 11 |
   | 4 | 8×8 | 7 | | 12 | 13×13 | 12 |
   | 5 | 9×9 | 8 | | 13 | 14×13 | 12 |
   | 6 | 10×9 | 8 | | 14 | 14×14 | 13 |
   | 7 | 10×10 | 9 | | 15 | 15×15 | 14 |
   | 8 | 11×10 | 9 | | | | |
3. **Drag** from a dot (or from an existing pipe) to draw. Release to finish.
   - Dragging back over your own pipe backs up.
   - Dragging into another color's pipe cuts it.
   - A pipe can't enter another color's dot.
   - Fast swipes are fine: skipped cells are filled in along your finger's path.
4. **Hint** reveals one flow's reference path and cuts pipes in its way. It targets the first flow that is not connected. If every flow is connected but the board isn't full, it targets the first flow that differs from the reference. A flow you connected by a different valid route is left alone while other work remains. You get 3 per level.
5. **Reset** clears the board. Leaving a level abandons that attempt, because boards are not saved.

### Moves and stars

A move is a finished drag that changed the board, as in Flow Free: two drags in a row of the same color count once. Hints are not moves.

Each level's optimal move count is its number of flows, since each flow is drawn once.

```
stars = clamp(3 − hintsUsed − (moves > optimal ? 1 : 0), 1, 3)     // 0 if unsolved
```

- ★★★: no hints and moves ≤ optimal
- ★★: one hint, or extra moves
- ★: anything worse. Any solve earns at least one star.

### Score

**Total score** is the sum of each level's **first-clear** stars (max 45). Replays never change it. They only update that level's best run and completion count, both visible in the level's **Stats** sheet. This keeps the score honest: you can't farm it by replaying.

### Open solutions

A level is solved by **any** fill that connects every flow and covers every cell. It does not have to match the stored reference solution, and levels 3–15 usually have several valid fills. Levels 1 and 2 are unique tutorial boards.

### Endless mode

An **Endless** card on the levels screen is available from the start. Pick a size (6×6, 8×8, 10×10, 12×12 or 15×15) and press **Generate**. A spinner shows while a Web Worker builds the puzzle, which usually takes well under a second and occasionally a few seconds at 15×15.

- Endless puzzles give no stars and never change the total score.
- After a solve you see moves against optimal, hints, time, how many times you solved this puzzle, and its best result, with a "New personal best" note when it applies.
- Every generated puzzle is saved to your profile right away (up to 50, newest first), solved or not. Find them under **Auto-generated (n)**, a collapsed list with **Play** and **Delete**.

## Architecture

```
src/engine/    pure TS, no React or DOM: all game logic
src/profile/   pure save-file domain + a thin Storage adapter
src/ui/        React: SVG board, pointer-drag hook, screens, dialogs
               art/ manifest · pixel/ icons, sprites, crowns · fx/ connect + coin burst
               scene/ animated backgrounds · map/ level road
art/           pxl sources (.px.js) for every pixel asset; PNGs are committed in public/art
src/App.tsx    screen state machine (profiles → levels → play)
scripts/       level generator
```

`CLAUDE.md` holds the canonical rules (R1–R16), scoring, persistence schema and mobile rules. Test names reference rule IDs.

- **Engine.** State transitions (`startDrag`, `dragTo`, `endDrag`, `applyHint`) are pure functions that return new state and never mutate their input. The UI folds them through a reducer.
- **Levels are data.** `levels.data.ts` is generated by `scripts/generate-levels.ts` and committed. Each level stores a reference solution (what Hint uses) and the colors proved forced. The campaign never runs a solver at runtime. Only Endless mode does, inside the generator Web Worker.
- **Board.** One SVG with `viewBox="0 0 C R"`, so a cell is 1 unit. Pipes are `<polyline>`s. Board styling is plain CSS custom properties, and the page chrome uses Tailwind v4.
- **Input.** Pointer Events on the root `<svg>` with pointer capture, one active pointer, and `pointercancel`/`lostpointercapture` handling for iOS. `traceCells` (Amanatides–Woo grid traversal) turns sparse `pointermove`s into adjacent cells, so quick swipes don't skip cells.
- **Persistence.** One `localStorage` key, `flow.save.v2`, validated by a hand-written type guard. If it is missing, a v1 save (`flow.save.v1`) is migrated and written as v2, and the v1 key is left untouched so rolling back is safe. A corrupt save is copied to `flow.save.v2.corrupt` and the game starts fresh. If storage is blocked or full, the game runs in memory and says progress won't be saved.

### Solver, SAT proofs and generator

- **Solver** (`solver.ts`) is a backtracking DFS on typed arrays. It picks the most constrained flow first and uses one flood fill per node to check dead cells, stranded regions and reachability. It has a node budget and a "forbid this route" query. It serves `solve()` and is the reference that the SAT code is tested against.
- **SAT prover** (`sat.ts`) encodes the board once with [`logic-solver`](https://www.npmjs.com/package/logic-solver) (MiniSat compiled to JavaScript): one color per cell, endpoints fixed, edge variables with degree 1 at endpoints and 2 elsewhere. Same-color loops that the degree rules allow are cut lazily, with a clause per loop found. `check(color)` asks for a full fill in which that flow leaves its reference route. *Unsatisfiable* means the flow is **forced** (one possible route). The proof is on the whole board at any size.
- **Quality (R16).** A level meets the quota when at least `max(1, round(0.3 × flows))` flows are forced and at least one forced flow has a detour. Flows are checked longest detour first, and checking stops once the quota is met.
- **Generator** (`generator.ts`) is seeded and has two modes. `unique` keeps the old rule (exactly one solution, used for levels 1–2). `open` (the default) works in three steps:
  1. **Snake packing.** It covers the board with induced snakes (paths that never touch themselves), starting in the most cramped cell and growing toward cramped neighbors.
  2. **Merge and split.** It joins short runs, then splits long ones, until there are exactly *N* flows. Every flow has at least 3 cells, never touches itself, and has non-adjacent ends.
  3. **Score.** It rejects boards where most flows run straight along the border, then keeps the first candidate that meets the quota, or the best one found within the time budget.
- **Time budget.** Each candidate's proofs get a deadline (a timed-out flow counts as not forced), and the browser worker stops searching after 3 s.

Measured with `npm run bench:gen` (20 seeds each, in Node on one development machine):

| Board | Median | Slowest |
|---|---|---|
| 11×11, 10 flows | 46 ms | 0.2 s |
| 15×15, 14 flows | 0.65 s | 17 s |
| 15×15, 16 flows | 0.12 s | 3 s |

The typical case is fast. The slow tail is a single SAT solve that cannot be interrupted, so the deadline only stops the next one. The app's client gives up after 20 s and offers to try again.

## Testing

`npm test` runs about 290 tests: engine rules, solver, SAT prover and generator, profile and storage logic (including the v1→v2 migration), geometry, and the full UI flow (create a player, drag, hint, solve, replay, stats, endless generation and replay) with an injected fake `Storage`, clock and id source. Each rule has logic, boundary and negative cases, and engine transitions are checked against deep-frozen input.

**Mutation testing** is configured (`stryker.config.json`) but **not finished**. Run it with `npm run test:mutation`. It runs in Stryker's sandbox mode, never `inPlace`, because TypeScript 7 breaks Stryker's in-place tsconfig rewrite, so the config points `tsconfigFile` at a missing file to skip it. A full run takes about 7 minutes. My one attempt hit a 300s cap at 56% done, with 113 surviving mutants and 108 timeouts. Those survivors are untriaged, so there is no mutation score yet.

## Known limitations

- Mutation testing is incomplete (see above), and `CLAUDE.md` lists no equivalent mutants yet.
- No keyboard play, colorblind glyphs on dots, animations beyond the solve pulse and star pop, or cross-tab sync.
- In-progress boards are not saved. Leaving a level abandons the attempt.
- Profiles are local to one browser. There are no real accounts.
- Endless generation at 15×15 occasionally takes many seconds, because a started SAT solve cannot be interrupted (see the timings above).
- Browser generation is verified through the build and the dev server serving the worker, and in jsdom with a fake generator. I have not run the worker in a real browser.
- Levels are generated, not hand-tuned for difficulty.
- Touch dragging was verified with simulated pointer events in jsdom, not on a physical iOS device.

## Sound

Sound effects and two music beds (menu and play) with separate Music and Sound effects switches (top-right on every screen; saved per device). All audio is CC0 from Lots of Sounds; the file list is in `public/sounds/CREDITS.md`.

## Look and feel

A medieval pixel-art skin: gem endpoints, flagstone board, parchment and wood 9-slice panels, animated castle, hall and dungeon backdrops, a kingdom-road level map, and a treasure chest with a coin burst and crown drop on solve. The font is Pixelify Sans (OFL, self-hosted).

- All art is authored 1:1 with [pxl](art/) and committed as PNGs in `public/art`. `npm run art` rebuilds them (dev-only, needs the pxl skill, or `PXL=/path/to/pxl.js`).
- **Retina / HiDPI.** One art pixel is `--px` CSS pixels, chosen in `src/ui/pixel/pixelScale.ts` so it is always a whole number of *device* pixels (2×, 2.625×, 3× phones included). Backgrounds scale by an integer too, and every image uses `image-rendering: pixelated`, so nothing is blurred.
- Animations stop under `prefers-reduced-motion`, and pause when the tab is hidden.

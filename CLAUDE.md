# CLAUDE.md

Flow Free–style puzzle game with a medieval pixel-art theme. TypeScript + React 19 + Vite + Vitest.
All work happens on `main`.

## Work rules

- **Plan first.** Propose a plan and get explicit approval before editing files.
- **Tests are mandatory** for every change: logic (happy path), boundary (edges/limits) and negative (invalid input, no-ops, failure paths).
- **Mutation testing is a must.** Stryker runs on `src/engine/**`, `src/audio/soundEvents.ts` and `src/audio/settings.ts`. Mutation testing is parked for now; the new pure UI files (`src/ui/fx/{connectFx,burst}.ts`, `src/ui/map/mapLayout.ts`, `src/ui/scene/sceneLayout.ts`, `src/ui/pixel/pixelScale.ts`) are not in the Stryker scope yet. Surviving mutants are either killed with a new test or listed below as equivalent.
- **Timeouts.** Wrap every command: `gtimeout 20s <cmd>` (e.g. `gtimeout 20s npm test`). Stryker is the one long job, so it runs in the background under `gtimeout 300s`.
- **Background probes.** The dev server and other long-lived processes run in the background, and you check them with short probes (e.g. `gtimeout 5s curl …`).
- **Readable over clever.** Prefer small, named, pure functions and obvious control flow.
- **Commits.** One commit per phase (rules → engine → UI → README). Push after tests are green.
- **Keep this file current** when rules, scoring, architecture or commands change.

## Game rules (canonical)

The engine and its tests are the executable form of these rules. Test names reference rule IDs.

- **R1** The board is an R×C grid. Each cell is empty, an endpoint (exactly 2 per color) or blocked. Blocked cells are not fillable.
- **R2** Moves are orthogonal: each step goes to an edge-adjacent cell.
- **R3** A cell holds at most one color. Pipes never cross or share a cell.
- **R4** A drag starts on an endpoint or on an existing pipe cell. Starting on an endpoint clears that color and starts a new pipe there, and either endpoint may start the pipe. Starting on a pipe cell truncates the pipe to that cell and continues from it. Starting on an empty or blocked cell does nothing.
- **R5** Dragging into an empty adjacent cell extends the pipe.
- **R6** Dragging back onto a cell of your own pipe truncates the pipe to that cell (backtracking).
- **R7** Dragging into another color's pipe cuts it: the other color keeps only the cells *before* the entered cell, and the active pipe takes the cell.
- **R8** A pipe never enters another color's endpoint or a blocked cell.
- **R9** When a pipe reaches its matching endpoint, the flow is connected and further forward moves are ignored. Backtracking still works.
- **R10** A fast drag may skip cells. A jump along a straight row or column is interpolated cell by cell, stopping at the first illegal cell. Any other jump is ignored.
- **R11** The level is solved when every flow is connected and every non-blocked cell is covered. Any such fill solves the level; uniqueness is not required (a level stores a reference solution).
- **R12** Hint: at most **3 per level**. A hint targets the first flow (in color order) that is **not connected**. If every flow is connected but the board is not full, it targets the first flow that differs from the reference solution. It reveals that flow's reference path and cuts overlapping pipes as in R7. A flow the player has connected along a different valid route is left alone while other work remains. Hints do nothing once 3 are used or the level is solved.
- **R13** Moves follow Flow Free's rule. A move is a finished drag that changed the board, except that a drag of the same color as the previously counted move does not count again. Hints are not moves and do not reset the "previous color".
- **R14** Stars are awarded only on solve (see Scoring).
- **R15** Endless mode is available from the start. Endless puzzles give no stars and do not count toward the total. They record completions, best result and last result.
- **R16** A generated level is valid if its reference fill is valid, no flow touches itself, every flow has ≥ 3 cells and the two ends of a flow are never adjacent. Quality is the forced-flow quota: `forced ≥ max(1, round(0.3·flows))` and at least one forced flow with a detour. A flow is *forced* when it has only one possible route, proved by a SAT solver on the whole board (`logic-solver`); a proof that runs out of time counts as not forced.

## Scoring

Every level stores `optimalMoves = number of flows`, since each flow is drawn exactly once. Endless puzzles are not scored.

```
stars = solved ? clamp(3 − hintsUsed − (moves > optimalMoves ? 1 : 0), 1, 3) : 0
```

- ★★★: no hints and `moves ≤ optimalMoves`
- ★★: one hint *or* extra moves
- ★: anything worse. Any solve earns at least 1 star.

The best stars per level are saved in `localStorage` behind try/catch. The game still works if storage is unavailable.

## Architecture

```
src/engine/   pure TS: no React, no DOM. All game logic lives here.
  types.ts      Cell, Level, GameState, MAX_HINTS
  grid.ts       adjacency, bounds, neighbors, straight-line interpolation
  game.ts       pure state transitions: startDrag / dragTo / endDrag / applyHint / isSolved …
  scoring.ts    starsFor(state)
  rng.ts        seeded PRNG (mulberry32), randInt, shuffle
  solver.ts     backtracking DFS on typed arrays (MRV + one flood fill per node), node budget, `forbid` query; used for `solve` and as a cross-check
  sat.ts        SAT encoding (edge variables, lazy loop cuts) built once per level; `check(color)` says forced / alternative / unknown
  forced.ts     quality: detourOf, meetsQuota, analyzeLevel (forced flows via sat.ts)
  generator.ts  snake packing → merge/split into non-self-touching flows, scored by forced-flow analysis; modes `open` (default) and `unique`
  levels.ts     parseLevel(ASCII solution grid), toGrid, flowsFor, LEVELS (15 levels)
  levels.data.ts  generated by scripts/generate-levels.ts and committed
src/profile/  pure save-file domain (profiles, scoring records, generated endless puzzles) + thin Storage adapter
src/ui/       React: SVG Board, useBoardDrag (pointer events), geometry (traceCells), gameReducer, screens, dialogs, generator.worker.ts
src/audio/    sound: soundMap (event → file, volume), soundEvents (pure state diff → one SoundEvent), settings (flow.audio.v1), audioEngine (Web Audio player, noop player), SoundProvider (context, unlock, button clicks)
art/          pxl sources (palette.px.js shared; board, gui, scenes, map). Dev-only; PNGs are committed in public/art/{sprites,anims,scenes}
src/ui/art/     manifest.ts: every asset's dir, frame size and frame count (single source of truth), artUrl()
src/ui/pixel/   PixelIcon, Sprite (CSS steps() strips), CrownRow (★ text kept sr-only), pixelScale (--px)
src/ui/fx/      connectFx (pure), useConnectFx, burst (pure), Treasure (chest + coins)
src/ui/scene/   sceneLayout (pure: coverScale, SCENES), SceneBackground
src/ui/map/     mapLayout (pure: nodes, decor), LevelMap
src/App.tsx   screen state machine (profiles / levels / play); props inject levels, storage, clock, ids
```

- Board rendering uses SVG with `viewBox="0 0 C R"`, so one cell is 1 unit. Pipes are `<polyline>` elements with round caps and joins.
- Board styling is plain CSS with custom properties (`--flow-A…`, `--board-bg`, `--grid-line`, `--pipe-width`). The rest of the UI uses Tailwind.
- Engine transitions never mutate their input. Levels are data. The solver runs at runtime only inside the generator Web Worker (endless mode).

## Pixel art and styling

- Art is authored 1:1 (16 px board cells, 320×180 scenes) and committed as PNGs. `npm run art` rebuilds them from `art/*.px.js` (needs the pxl skill, or `PXL=/path/to/pxl.js`). CI never runs it.
- One art pixel is `--px` CSS px. `main.tsx` sets it from viewport width and `devicePixelRatio` so it is a **whole number of device pixels** (crisp on retina and fractional-DPR phones). Scenes scale by an integer (`coverScale`). Every image is `image-rendering: pixelated`.
- 9-slice panels and buttons are `.px-panel`, `.px-panel-dark`, `.px-btn`, `.px-banner` in `src/styles/pixel-ui.css`. UI font is Pixelify Sans via `@fontsource`.
- Decorative images are `aria-hidden`. Accessible names and ★ text never depend on art. Animations stop under `prefers-reduced-motion` and pause while the tab is hidden.
- **Responsive layout.** Frame art is never changed for small screens; layout adapts instead. Bordered `.px-btn`s are `flex: none; white-space: nowrap` so they are never squashed. The sound control (`.sound-toggle`) floats bottom-right on phones with its menu opening upward, and sits top-right from 640px up. `--dock` (5.5rem on phones, 0 from 640px) pads page bottoms and the board's height budget (`--bars-h`) so the floating button never covers content. The level map fits its column: `mapWidthFor()` picks a width between 96 and 160 art px and `LevelMap` re-measures on resize. `.board` subtracts its own frame from the column width, and `html, body` use `overflow-x: clip`. `src/styles/responsive.test.ts` locks these rules.
- Board sprites (floor, blocks, gems) are `<rect>`s filled from a `<pattern>` holding the `<image>`. WebKit (every iOS browser) smooths a bare SVG `<image>` even with `pixelated`, but keeps pattern fills crisp. `Board.test.tsx` fails on any bare board `<image>`.
- Pipes stay SVG polylines (outline, main with the `pipe-X` testid, highlight) styled with `crispEdges`.

## Audio

- Assets: `public/sounds/*.mp3` (CC0, Lots of Sounds; see `public/sounds/CREDITS.md`). Missing files fail silently.
- `createWebAudioPlayer` has two buses (SFX, music). SFX are decoded buffers; music is a looping `<audio>` element, crossfaded over 800 ms between the `menu` and `play` beds. Muting sets the bus gain to 0 and pauses the element. A hidden tab pauses the music.
- Audio starts on the first `pointerdown` or `keydown` (`unlock`), as iOS requires. The first unlock also sets `navigator.audioSession.type = 'playback'` (Safari 17+, guarded), so the iOS ringer switch does not mute the game.
- iOS puts the context in the WebKit-only `interrupted` state when the tab is hidden or the screen locks. Any state other than `running`/`closed` is resumed on every later `unlock` (each tap) and when the tab becomes visible, and music is re-synced after the resume.
- `player.isLocked()` / `onLockChange()` say whether the browser still waits for a tap (no context yet, or not running). `SoundProvider` exposes it as `locked` (`useSyncExternalStore`). While locked and any sound is on, `SoundToggle` pulses the speaker (`.sound-toggle-btn--locked`, off under reduced motion) and shows a "Tap to enable sound" note (`role="status"`, hidden while the menu is open). The note's width follows its text, so it is drawn with solid borders and box-shadows (not a 9-slice, which seams at fractional pixels in WebKit) and placed by flex, never by `transform`. No Web Audio, a closed context and `noopPlayer` are never locked.
- `soundEventsFor(prev, next)` returns at most one event. Priority: `solve > hint > connect > cut > start > step/backtrack`. Illegal moves are silent. `tick` is throttled to 40 ms.
- A capture-phase `click` listener plays `click` for any enabled `<button>`. `data-sfx="none"` skips it and `data-sfx="next"` plays `next`.
- Settings `{ music, sfx }` live under `flow.audio.v1` (per device, not per profile), behind try/catch. `App` takes an injected `audio` player (default `noopPlayer`; `main.tsx` passes the Web Audio one). Tests use `fakePlayer()`.

## Persistence

- One `localStorage` key, `flow.save.v2`, holds a `SaveFile` (`version: 2`, `activeProfileId`, `profileOrder`, `profiles`). If v2 is missing, a v1 save (`flow.save.v1`) is migrated (`generated: []`) and written as v2; the v1 key is left untouched. Bad JSON or shape is copied to `flow.save.v2.corrupt` and the game starts empty.
- `Profile.generated` holds up to 50 endless puzzles (most recent first), each with `grid`, `completions`, `best` and `last` run results (no stars). A puzzle is stored when it is generated, with `completions: 0` and no runs until solved. `totalScore` ignores them.
- Profiles are name-only: trimmed, 1–16 characters, unique case-insensitively.
- Each profile stores a `LevelRecord` per completed level: `firstClear` (frozen), `best`, `completions`, `lastPlayedAt`.
- **Replay rule:** a replay never changes `firstClear`. Total score is the sum of first-clear stars, so it is fixed at the first clear. `best` is most stars, then fewest moves, then fewest hints.
- Level *n* unlocks when level *n−1* has a record. In-progress boards are not saved.
- `src/profile/` is pure (clock and id injected); only `storage.ts` touches `Storage`, and it takes it as a parameter.

## Mobile/Safari rules

- Baseline: Safari/iOS 16.4+, Chrome/Edge 111+, Firefox 128+.
- All drag input uses Pointer Events on the root `<svg>`: pointer capture on the SVG, one active pointer, `pointerup`/`pointercancel`/`lostpointercapture` all end the drag, `contextmenu` is suppressed.
- Fast swipes are rasterized with `traceCells` (Amanatides–Woo), so every step handed to the engine is adjacent.
- Board CSS: `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`. `html, body`: `overscroll-behavior: none`, transparent tap highlight.
- Viewport meta has `viewport-fit=cover`. Layout uses `100dvh` and `env(safe-area-inset-*)`.
- Buttons are at least 44×44px. Inputs use a 16px font, or iOS zooms on focus.
- Motion is disabled under `prefers-reduced-motion`.
- Pixel art: integer `--px` in device pixels and `image-rendering: pixelated` (see Pixel art and styling).

## Commands

| Command | Purpose |
|---|---|
| `gtimeout 20s npm test` | Vitest, all tests |
| `gtimeout 20s npm run typecheck` | `tsc -b` |
| `gtimeout 20s npm run build` | production build |
| `npm run art` | rebuild `public/art` from `art/*.px.js` (dev-only, needs pxl; PNGs are committed) |
| `npm run dev` (background) | Vite dev server on :5173 |
| `gtimeout 300s npm run test:mutation` (background) | Stryker on the engine (sandbox mode, never `inPlace`; a full run is ~7 min, so it can exceed the cap) |
| `npm run gen:levels` (background, several minutes) | regenerate `levels.data.ts`: one process per core, finished levels cached in `scripts/.cache/` (delete it to start over) |
| `gtimeout 60s npm run bench:gen` | generator timing at 11×11 and 15×15 (runs in a Web Worker in the app, so a few seconds is fine) |

## CI (GitHub Actions)

- `.github/workflows/ci.yml` runs on every push and on PRs to `main`: `npm ci` → typecheck → test → build on Node from `.nvmrc` (22.18; scripts run `.ts` via Node type stripping). Steps use `timeout`, since `gtimeout` is a macOS name.
- `.github/workflows/mutation.yml` is manual only (`workflow_dispatch`): Stryker in sandbox mode with a 20 min job cap, and the HTML report is uploaded as the `mutation-report` artifact. Start it with `gh workflow run mutation.yml --ref <branch>`.
- Keep the workflow steps in sync with the Commands table when scripts change.

## Equivalent mutants

- `src/audio/settings.ts` `parsed?.music` → `parsed.music`: for stored `null` the property read throws, and the surrounding `catch` returns the same defaults.

import { applyHint, createGame, dragTo, endDrag, resetGame, startDrag } from '../engine/game.ts'
import type { Cell, GameState, Level } from '../engine/types.ts'

export type GameAction =
  | { type: 'start'; cell: Cell }
  | { type: 'moveMany'; cells: Cell[] }
  | { type: 'end' }
  | { type: 'reset' }
  | { type: 'hint' }
  | { type: 'load'; level: Level }

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start':
      return startDrag(state, action.cell)
    case 'moveMany':
      return action.cells.reduce(dragTo, state)
    case 'end':
      return endDrag(state)
    case 'reset':
      return resetGame(state)
    case 'hint':
      return applyHint(state)
    case 'load':
      return createGame(action.level)
  }
}

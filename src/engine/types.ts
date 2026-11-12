export type Cell = { row: number; col: number }
export type ColorId = string // 'A'..'Z'
export type Pair = { color: ColorId; ends: [Cell, Cell] }

export type Level = {
  id: string
  name: string
  rows: number
  cols: number
  pairs: Pair[] // sorted by color
  blocked: Cell[]
  solution: Record<ColorId, Cell[]> // ordered from ends[0] to ends[1]
  optimalMoves: number
}

export type Paths = Record<ColorId, Cell[]> // ordered from the endpoint the drag began at

export type GameState = {
  level: Level
  paths: Paths
  active: ColorId | null // color being dragged
  dragChanged: boolean // did the current drag alter paths?
  moves: number
  lastMovedColor: ColorId | null
  hintsUsed: number
}

export const MAX_HINTS = 3

import { useCallback, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { isFlowConnected, isSolved } from '../engine/game.ts'
import type { Cell, GameState } from '../engine/types.ts'
import type { GameAction } from './gameReducer.ts'
import { artUrl, gemName } from './art/manifest.ts'
import { useConnectFx } from './fx/useConnectFx.ts'
import { useBoardDrag } from './useBoardDrag.ts'

const center = (c: Cell) => `${c.col + 0.5},${c.row + 0.5}`

function gridPath(rows: number, cols: number): string {
  const lines: string[] = []
  for (let r = 1; r < rows; r++) lines.push(`M0 ${r}H${cols}`)
  for (let c = 1; c < cols; c++) lines.push(`M${c} 0V${rows}`)
  return lines.join('')
}

export function Board({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const { level, paths } = state
  const { rows, cols } = level
  const svgRef = useRef<SVGSVGElement>(null)
  const [head, setHead] = useState<Cell | null>(null)
  const onHead = useCallback((cell: Cell | null) => setHead(cell), [])
  useBoardDrag(svgRef, rows, cols, dispatch, onHead)

  const fx = useConnectFx(state)
  const fxColors = new Set(fx.map((f) => f.color))

  const activePath = state.active ? paths[state.active] : undefined
  const haloAt = activePath && activePath.length > 0 ? activePath[activePath.length - 1] : head

  return (
    <svg
      ref={svgRef}
      className={`board${isSolved(state) ? ' board--solved' : ''}`}
      style={{ '--rows': rows, '--cols': cols } as React.CSSProperties}
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Flow board ${rows} by ${cols}`}
      data-testid="board"
    >
      <defs>
        <pattern id="board-floor" width={1} height={1} patternUnits="userSpaceOnUse">
          <image href={artUrl('floor_a')} width={1} height={1} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />
        </pattern>
      </defs>
      <rect width={cols} height={rows} fill="url(#board-floor)" />
      {level.blocked.map((cell) => (
        <image
          key={`block-${cell.row}-${cell.col}`}
          className="board-block"
          data-testid="block"
          href={artUrl('block')}
          x={cell.col}
          y={cell.row}
          width={1}
          height={1}
          preserveAspectRatio="none"
        />
      ))}
      {level.pairs.map((pair) =>
        paths[pair.color].map((cell) => (
          <rect
            key={`${pair.color}-${cell.row}-${cell.col}`}
            className="board-cell"
            data-testid="cell-tint"
            x={cell.col}
            y={cell.row}
            width={1}
            height={1}
            fill={`var(--flow-${pair.color})`}
            opacity={isFlowConnected(state, pair.color) ? 0.35 : 'var(--cell-fill-opacity)'}
          />
        )),
      )}
      <path className="board-grid" d={gridPath(rows, cols)} />
      {state.active && haloAt && (
        <circle
          className="board-halo"
          data-testid="halo"
          cx={haloAt.col + 0.5}
          cy={haloAt.row + 0.5}
          r={0.9}
          fill={`var(--flow-${state.active})`}
        />
      )}
      {level.pairs.map((pair) => {
        if (paths[pair.color].length < 2) return null
        const points = paths[pair.color].map(center).join(' ')
        const glow = fxColors.has(pair.color) ? ' board-pipe--glow' : ''
        return (
          <g key={pair.color} style={{ '--c': `var(--flow-${pair.color})` } as React.CSSProperties}>
            <polyline className="board-pipe board-pipe--rim" points={points} />
            <polyline className="board-pipe board-pipe--outline" points={points} />
            <polyline className={`board-pipe board-pipe--main${glow}`} data-testid={`pipe-${pair.color}`} points={points} stroke={`var(--flow-${pair.color})`} />
            <polyline className="board-pipe board-pipe--shine" points={points} transform="translate(-0.05,-0.05)" />
          </g>
        )
      })}
      {level.pairs.flatMap((pair) =>
        pair.ends.map((end) => (
          <image
            key={`${pair.color}-${end.row}-${end.col}`}
            className="board-gem"
            data-testid={`end-${pair.color}`}
            href={artUrl(gemName(pair.color))}
            x={end.col + 0.06}
            y={end.row + 0.09}
            width={0.88}
            height={0.8}
            preserveAspectRatio="xMidYMid meet"
          />
        )),
      )}
      {fx.flatMap(({ color, key }) =>
        level.pairs
          .filter((p) => p.color === color)
          .flatMap((p) =>
            p.ends.map((end) => (
              <svg
                key={`fx-${key}-${end.row}-${end.col}`}
                data-testid="sparkle"
                className="board-sparkle"
                x={end.col}
                y={end.row}
                width={1}
                height={1}
                viewBox="0 0 16 16"
                overflow="hidden"
              >
                <image className="board-sparkle-strip" href={artUrl('sparkle')} width={80} height={16} />
              </svg>
            )),
          ),
      )}
    </svg>
  )
}

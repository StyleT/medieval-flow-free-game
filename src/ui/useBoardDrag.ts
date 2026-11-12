import { useEffect, useRef } from 'react'
import type { Dispatch, RefObject } from 'react'
import type { Cell } from '../engine/types.ts'
import type { GameAction } from './gameReducer.ts'
import { pointToCell, toBoardPoint, traceCells } from './geometry.ts'
import type { Point } from './geometry.ts'

type DragSession = { pointerId: number; rect: DOMRect; last: Point }

/** Pointer-event drag handling on the root SVG; one pointer at a time. */
export function useBoardDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  rows: number,
  cols: number,
  dispatch: Dispatch<GameAction>,
  onHead: (cell: Cell | null) => void,
): void {
  const session = useRef<DragSession | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (svg === null) return

    const finish = (e: PointerEvent) => {
      const s = session.current
      if (s === null || e.pointerId !== s.pointerId) return
      session.current = null
      dispatch({ type: 'end' })
      onHead(null)
    }

    const onDown = (e: PointerEvent) => {
      if (session.current !== null) return // second finger
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const point = toBoardPoint(rect, e.clientX, e.clientY, rows, cols)
      const cell = pointToCell(point, rows, cols)
      if (cell === null) return
      try {
        svg.setPointerCapture(e.pointerId)
      } catch {
        // capture is best-effort
      }
      session.current = { pointerId: e.pointerId, rect, last: point }
      dispatch({ type: 'start', cell })
      onHead(cell)
    }

    const onMove = (e: PointerEvent) => {
      const s = session.current
      if (s === null || e.pointerId !== s.pointerId) return
      const point = toBoardPoint(s.rect, e.clientX, e.clientY, rows, cols)
      const cells = traceCells(s.last, point, rows, cols)
      s.last = point
      if (cells.length > 0) {
        dispatch({ type: 'moveMany', cells })
        onHead(cells[cells.length - 1])
      }
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', finish)
    svg.addEventListener('pointercancel', finish)
    svg.addEventListener('lostpointercapture', finish)
    svg.addEventListener('contextmenu', onContextMenu)
    return () => {
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', finish)
      svg.removeEventListener('pointercancel', finish)
      svg.removeEventListener('lostpointercapture', finish)
      svg.removeEventListener('contextmenu', onContextMenu)
    }
  }, [svgRef, rows, cols, dispatch, onHead])
}

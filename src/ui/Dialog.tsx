import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** Plain modal: backdrop, focus on the heading, Esc or backdrop closes. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center"
      data-testid="backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="px-panel w-full max-w-md pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" ref={heading} tabIndex={-1} className="mb-3 text-xl font-bold outline-none">
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

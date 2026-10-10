import { useEffect, useRef, type ReactNode } from 'react'
import { useBodyClass } from '../lib/hooks'

/** Bottom sheet on phones, centered dialog on wider screens. Escape or tapping the scrim closes it. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useBodyClass('locked', true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="sheet">
      <div className="scrim" onClick={onClose} />
      {/* .anim plays once on mount; switching content inside an open sheet doesn't replay it. */}
      <div className="panel anim" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </div>
  )
}

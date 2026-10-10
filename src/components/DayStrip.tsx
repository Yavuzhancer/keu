import { useLayoutEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { dayKey } from '../lib/time'

/** Horizontal row of the next few days. Keeps the selected day scrolled into view. */
export function DayStrip({ days, selected, onPick }: { days: Date[]; selected: number; onPick: (i: number) => void }) {
  const { t, fmt } = useI18n()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const st = ref.current
    const on = st?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (st && on && (on.offsetLeft + on.offsetWidth > st.scrollLeft + st.clientWidth || on.offsetLeft < st.scrollLeft))
      st.scrollLeft = on.offsetLeft - st.clientWidth / 2 + on.offsetWidth / 2
  }, [selected])

  return (
    <div className="days" ref={ref}>
      {days.map((d, i) => (
        <button key={dayKey(d)} className="day" aria-pressed={i === selected} onClick={() => onPick(i)}>
          <small>{i === 0 ? t('today') : fmt(d, { weekday: 'short' }).replace('.', '')}</small>
          <b>{d.getDate()}</b>
        </button>
      ))}
    </div>
  )
}

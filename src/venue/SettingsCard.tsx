import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { saveSettings } from '../lib/api'
import type { Settings, VenueInfo } from '../lib/types'

/** Walk-in tables and weekend prepay. Changes show at once and save in the background. */
export function SettingsCard({ info, onSaved }: { info: VenueInfo; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [pending, setPending] = useState<Settings | null>(null)
  const [err, setErr] = useState(false)
  const seq = useRef(0)
  const s = pending ?? info.settings
  const maxHold = Math.min(4, info.tables.filter(x => x.type === 'pool').length)

  async function save(next: Settings) {
    const n = ++seq.current
    setPending(next)
    setErr(false)
    try {
      await saveSettings(info.venue.id, next)
      await onSaved()
    } catch {
      setErr(true)
    } finally {
      if (n === seq.current) setPending(null)
    }
  }
  const hold = (delta: number) => save({ ...s, holdBack: Math.max(0, Math.min(maxHold, s.holdBack + delta)) })

  return (
    <section className="card">
      <h2>{t('settings')}</h2>
      <div className="set">
        <div><strong>{t('holdLabel')}</strong><p>{t('holdHelp')}</p></div>
        <div className="stepper">
          <button aria-label={t('fewer')} disabled={s.holdBack <= 0} onClick={() => hold(-1)}>−</button>
          <span aria-live="polite">{s.holdBack}</span>
          <button aria-label={t('more')} disabled={s.holdBack >= maxHold} onClick={() => hold(1)}>+</button>
        </div>
      </div>
      <div className="set">
        <div><strong>{t('prepayLabel')}</strong><p>{t('prepayHelp')}</p></div>
        <button className="switch" role="switch" aria-checked={s.prepayWeekend} aria-label={t('prepayLabel')}
          onClick={() => save({ ...s, prepayWeekend: !s.prepayWeekend })}><span /></button>
      </div>
      {err && <p className="err set-err">{t('netErr')}</p>}
    </section>
  )
}

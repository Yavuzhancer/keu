import { useState, type KeyboardEvent } from 'react'
import { Chips } from '../components/Chips'
import { useI18n } from '../i18n'
import { ApiError, createBooking } from '../lib/api'
import { DURATIONS, isActive } from '../lib/rules'
import { hm } from '../lib/time'
import type { Booking, Table } from '../lib/types'

/** Venue staff adding a booking that came in by phone or WhatsApp. */
export function AddSheet({ venueId, table, date, start, close, bookings, onSaved, onClose }: {
  venueId: string
  table: Table
  date: string
  start: number
  /** Closing time that day, in minutes. */
  close: number
  /** That day's bookings, to explain clashes by name. */
  bookings: Booking[]
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const { t, durLabel, tableShort } = useI18n()
  const [name, setName] = useState('')
  const [dur, setDur] = useState(60)
  const [players, setPlayers] = useState(2)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (saving) return
    const end = start + dur
    if (!name.trim()) return setErr(t('addNameErr'))
    if (end > close) return setErr(t('closeErr', { t: hm(close) }))
    const clash = bookings
      .filter(b => b.tableId === table.id && isActive(b) && b.start < end && start < b.start + b.dur)
      .sort((a, b) => a.start - b.start)[0]
    if (clash) return setErr(t('overlapErr', { name: clash.name, t: hm(clash.start) }))
    setSaving(true)
    try {
      await createBooking(venueId, { tableId: table.id, date, start, dur, name: name.trim(), phone: null, players, source: 'phone' })
      await onSaved()
    } catch (e) {
      // The database also refuses overlaps, e.g. when an app booking came in a moment ago.
      setErr(e instanceof ApiError && e.kind === 'overlap' ? t('overlapAny') : t('netErr'))
      setSaving(false)
    }
  }
  const onEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') save() }

  return (
    <>
      <h2 className="sh-t">{t('addTitle')}</h2>
      <p className="sh-sub">{t('addSub', { table: tableShort(table), a: hm(start) })}</p>
      <label className="fld">
        <span>{t('name')}</span>
        <input autoFocus value={name} placeholder={t('namePh')} onChange={e => setName(e.target.value)} onKeyDown={onEnter} />
      </label>
      <div className="fld">
        <span>{t('howLong')}</span>
        <Chips values={DURATIONS} value={dur} onPick={v => { setDur(v); setErr('') }} label={durLabel} />
      </div>
      <div className="fld"><span>{t('players')}</span><Chips values={[2, 3, 4, 5, 6]} value={players} onPick={setPlayers} /></div>
      {err && <p className="err">{err}</p>}
      <div className="sh-actions">
        <button className="btn" disabled={saving} onClick={save}>{t('save')}</button>
        <button className="btn ghost" onClick={onClose}>{t('close')}</button>
      </div>
    </>
  )
}

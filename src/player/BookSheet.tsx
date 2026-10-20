import { useRef, useState, type KeyboardEvent } from 'react'
import { Chips } from '../components/Chips'
import { useI18n } from '../i18n'
import { ApiError, createBooking } from '../lib/api'
import { prepayRequired, rate } from '../lib/rules'
import { hm, parseDay } from '../lib/time'
import type { Booking, VenueInfo } from '../lib/types'
import type { Contact, Pick } from './state'

export function BookSheet({ info, pick, contact, setContact, onBooked }: {
  info: VenueInfo
  pick: Pick
  contact: Contact
  setContact: (f: (c: Contact) => Contact) => void
  onBooked: (b: Booking) => void
}) {
  const { t, money, dayLong, tableName } = useI18n()
  const d = parseDay(pick.date)
  const x = info.tables.find(z => z.id === pick.tableId)!
  const req = prepayRequired(info.settings, d, pick.start)
  const [players, setPlayers] = useState(2)
  const [pay, setPay] = useState<'bar' | 'now'>('bar')
  const [err, setErr] = useState<'name' | 'taken' | 'net' | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const payNow = req || pay === 'now'
  const total = rate(info, x.type) * pick.dur / 60
  const counts = x.type === 'pool' ? [2, 3, 4, 5, 6] : [2, 3, 4]

  async function confirm() {
    if (saving) return
    const name = contact.name.trim()
    if (!name) { setErr('name'); nameRef.current?.focus(); return }
    setSaving(true)
    setErr(null)
    try {
      // iDEAL isn't wired up yet, so every booking is stored unpaid and paid at the bar.
      onBooked(await createBooking(info.venue.id, {
        ...pick, name, phone: contact.phone.trim() || null, players, source: 'app',
      }))
    } catch (e) {
      setErr(e instanceof ApiError && e.kind === 'overlap' ? 'taken' : 'net')
      setSaving(false)
    }
  }
  const onEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') confirm() }

  return (
    <>
      <h2 className="sh-t">{tableName(x)}</h2>
      <p className="sh-sub">{dayLong(d)}, {hm(pick.start)}–{hm(pick.start + pick.dur)}</p>
      <label className="fld">
        <span>{t('yourName')}</span>
        <input ref={nameRef} value={contact.name} placeholder={t('namePh')} autoComplete="name" onKeyDown={onEnter}
          onChange={e => { const name = e.target.value; setContact(c => ({ ...c, name })); if (err === 'name') setErr(null) }} />
        {err === 'name' && <em className="err">{t('nameErr')}</em>}
      </label>
      <label className="fld">
        <span>{t('phone')}</span>
        <input type="tel" inputMode="tel" value={contact.phone} placeholder="06 12345678" autoComplete="tel" onKeyDown={onEnter}
          onChange={e => { const phone = e.target.value; setContact(c => ({ ...c, phone })) }} />
      </label>
      <div className="fld"><span>{t('players')}</span><Chips values={counts} value={players} onPick={setPlayers} /></div>
      <div className="fld">
        <span>{t('payment')}</span>
        <div className="pay">
          <button className="opt" aria-pressed={!payNow} disabled={req} onClick={() => setPay('bar')}>{t('payBar')}</button>
          <button className="opt" aria-pressed={payNow} onClick={() => setPay('now')}>{t('payNow')}</button>
        </div>
        {req && <p className="note">{t('prepayReq')}</p>}
        {payNow && <p className="note">{t('payLater')}</p>}
      </div>
      {(err === 'taken' || err === 'net') && <p className="err">{t(err === 'taken' ? 'takenErr' : 'netErr')}</p>}
      <div className="sh-foot">
        <div><small>{t('total')}</small><strong>{money(total)}</strong></div>
        <button className="btn" onClick={confirm} disabled={saving}>{t('book')}</button>
      </div>
    </>
  )
}

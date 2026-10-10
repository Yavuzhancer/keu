import { useState } from 'react'
import { useI18n } from '../i18n'
import { setBookingStatus } from '../lib/api'
import { hm } from '../lib/time'
import type { Booking, BookingStatus, Table } from '../lib/types'

/** Tapped booking: details plus arrived / no-show / cancel. */
export function DetailSheet({ booking: b, table, onChanged }: {
  booking: Booking
  table: Table
  onChanged: () => Promise<void>
}) {
  const { t, tableShort } = useI18n()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(false)

  async function mark(status: BookingStatus) {
    setSaving(true)
    setErr(false)
    try {
      await setBookingStatus(b.id, status)
      await onChanged()
    } catch {
      setErr(true)
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="sh-t">{b.name}</h2>
      <p className="sh-sub">{tableShort(table)}, {hm(b.start)}–{hm(b.start + b.dur)}</p>
      <dl className="dl">
        <div><dt>{t('players')}</dt><dd>{b.players}</dd></div>
        <div><dt>{t('status')}</dt><dd>{t(`st_${b.status}`)}</dd></div>
        <div><dt>{t('via')}</dt><dd>{b.source === 'app' ? t('viaApp') : t('viaPhone')}</dd></div>
        {b.source === 'app' && <div><dt>{t('payment')}</dt><dd>{b.paid ? t('paidNow') : t('paidBar')}</dd></div>}
        {b.phone && <div><dt>{t('phoneShort')}</dt><dd><a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{b.phone}</a></dd></div>}
      </dl>
      {err && <p className="err">{t('netErr')}</p>}
      <div className="sh-actions col">
        <button className="btn green" disabled={saving} onClick={() => mark('arrived')}>{t('markArrived')}</button>
        <button className="btn ghost" disabled={saving} onClick={() => mark('noshow')}>{t('markNoShow')}</button>
        <button className="btn danger" disabled={saving} onClick={() => mark('cancelled')}>{t('cancelBooking')}</button>
      </div>
    </>
  )
}

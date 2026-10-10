import { useI18n } from '../i18n'
import { hm, parseDay } from '../lib/time'
import type { Booking, VenueInfo } from '../lib/types'

export function DoneSheet({ info, booking: b, onSeeVenue, onClose }: {
  info: VenueInfo
  booking: Booking
  onSeeVenue: (b: Booking) => void
  onClose: () => void
}) {
  const { t, dayLong, tableName } = useI18n()
  const x = info.tables.find(z => z.id === b.tableId)!
  return (
    <>
      <div className="ticket">
        <div className="felt"><span className="ticket-n">{x.number}</span><span className="ticket-type">{t(x.type)}</span></div>
        <div className="ticket-body">
          <h2>{t('headline', { table: tableName(x) })}</h2>
          <p>
            {dayLong(parseDay(b.date))}, {hm(b.start)}–{hm(b.start + b.dur)}<br />
            {t('playersN', { n: b.players })}, {b.paid ? t('paidNow') : t('paidBar')}
          </p>
        </div>
      </div>
      <p className="note">{t('reminder')}</p>
      <p className="note">{t('demoNote')}</p>
      <div className="sh-actions">
        <button className="btn" onClick={() => onSeeVenue(b)}>{t('seeVenue')}</button>
        <button className="btn ghost" onClick={onClose}>{t('done')}</button>
      </div>
    </>
  )
}

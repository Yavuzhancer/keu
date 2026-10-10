import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Chips } from '../components/Chips'
import { DayStrip } from '../components/DayStrip'
import { Sheet } from '../components/Sheet'
import { TableSvg } from '../components/TableSvg'
import { useI18n } from '../i18n'
import { fetchBusy } from '../lib/api'
import { useBodyClass, useNow, usePolled } from '../lib/hooks'
import { BOOKING_DAYS, DURATIONS, freeTables, hoursOn, rate, tableFree } from '../lib/rules'
import { dayKey, hm, nextDays, nowMin, parseDay, reducedMotion } from '../lib/time'
import type { Booking, Busy, Table, VenueInfo } from '../lib/types'
import { BookSheet } from './BookSheet'
import { DoneSheet } from './DoneSheet'
import type { Contact, Pick, PlayerSel } from './state'

type SheetState = { type: 'book'; pick: Pick } | { type: 'done'; booking: Booking } | null

export function PlayerView({ info, sel, setSel, contact, setContact, onSeeVenue }: {
  info: VenueInfo
  sel: PlayerSel
  setSel: Dispatch<SetStateAction<PlayerSel>>
  contact: Contact
  setContact: Dispatch<SetStateAction<Contact>>
  onSeeVenue: (b: Booking) => void
}) {
  const { t, money, durLabel, tableName, dayShort } = useI18n()
  const { venue, tables } = info
  const now = useNow()
  const todayKey = dayKey(now)
  const days = useMemo(() => nextDays(BOOKING_DAYS, parseDay(todayKey)), [todayKey])
  const from = dayKey(days[0]), to = dayKey(days[days.length - 1])
  const busyQ = usePolled(`${venue.id}:${from}`, () => fetchBusy(venue.id, from, to), 60_000)
  const busy = busyQ.data
  const [sheet, setSheet] = useState<SheetState>(null)
  const floorRef = useRef<HTMLElement>(null)
  const scrollToFloor = useRef(false)

  const d = days[sel.dayIdx], k = dayKey(d), h = hoursOn(info, d), today = hoursOn(info, days[0])
  const nm = sel.dayIdx === 0 ? nowMin(now) : -1
  const slots: { m: number; f: number }[] = []
  if (h && busy) {
    for (let m = h[0]; m + sel.dur <= h[1]; m += 30) {
      if (m <= nm) continue
      slots.push({ m, f: freeTables(tables, busy, k, sel.game, m, sel.dur).length })
    }
  }

  // As in the demo: a picked time that filled up gets dropped, and a table
  // that got taken is swapped for the first free one.
  const slot = sel.slot != null && slots.some(s => s.m === sel.slot && s.f > 0) ? sel.slot : null
  const free = slot != null && busy ? freeTables(tables, busy, k, sel.game, slot, sel.dur) : []
  const table = slot == null ? null : free.some(x => x.id === sel.table) ? sel.table : free[0].id
  useEffect(() => {
    if (busy && (slot !== sel.slot || table !== sel.table)) setSel(s => ({ ...s, slot, table }))
  }, [busy, slot, table, sel.slot, sel.table, setSel])

  // After picking a time, bring the table picker into view if it's below the fold.
  useEffect(() => {
    if (!scrollToFloor.current) return
    scrollToFloor.current = false
    const f = floorRef.current
    if (f && f.getBoundingClientRect().bottom > innerHeight - 90)
      f.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
  }, [sel.slot])

  const barTable = table ? tables.find(x => x.id === table) ?? null : null
  useBodyClass('has-bar', !!barTable)

  const held = tables.filter(x => x.type === 'pool' && x.walkIn).length
  const price = (cents: number) => money(cents / 100)

  function booked(b: Booking) {
    setSel(s => ({ ...s, slot: null, table: null }))
    setSheet({ type: 'done', booking: b })
    busyQ.reload()
    window.scrollTo(0, 0)
  }

  return (
    <>
      <section className="venue felt">
        <h1>{venue.name}</h1>
        <p>{venue.address}, {venue.city}</p>
        <p>{today ? t('openToday', { a: hm(today[0]), b: hm(today[1]) }) : t('closedToday')}</p>
        <p className="price">
          {t('priceLine', { a: price(venue.priceCents), b: price(venue.offPeakPriceCents), c: price(venue.studentPriceCents) })}
        </p>
      </section>

      <div className="game">
        {(['pool', 'snooker'] as const).map(g => (
          <button key={g} className="opt" aria-pressed={sel.game === g}
            onClick={() => setSel(s => ({ ...s, game: g, slot: null, table: null }))}>
            <strong>{t(g)}</strong>
            <small>{t('nTables', { n: tables.filter(x => x.type === g).length })}</small>
          </button>
        ))}
      </div>

      <section className="blk">
        <h2>{t('when')}</h2>
        <DayStrip days={days} selected={sel.dayIdx} onPick={i => setSel(s => ({ ...s, dayIdx: i, slot: null, table: null }))} />
      </section>

      <section className="blk">
        <h2>{t('howLong')}</h2>
        <Chips values={DURATIONS} value={sel.dur} onPick={dur => setSel(s => ({ ...s, dur }))} label={durLabel} />
      </section>

      <section className="blk">
        <h2>{t('pickTime')}</h2>
        {!busy ? (
          <p className="muted">{busyQ.error ? t('netErr') : t('loading')}</p>
        ) : slots.length ? (
          <div className="times">
            {slots.map(s => (
              <button key={s.m} className="time" disabled={!s.f} aria-pressed={s.m === slot}
                onClick={() => { scrollToFloor.current = true; setSel(p => ({ ...p, slot: s.m, table: null })) }}>
                <b>{hm(s.m)}</b>
                <small>{s.f ? t('free', { n: s.f }) : t('full')}</small>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{t('noTimes')}</p>
        )}
      </section>

      {slot != null && busy && (
        <section className="blk" ref={floorRef}>
          <h2>{t('pickTable')}</h2>
          <div className={`floor ${sel.game}`}>
            {tables.filter(x => x.type === sel.game).map(x => (
              <TableButton key={x.id} table={x} busy={busy} date={k} start={slot} dur={sel.dur} selected={x.id === table}
                onPick={() => setSel(s => ({ ...s, table: x.id }))} />
            ))}
          </div>
          {sel.game === 'pool' && held > 0 && <p className="note">{t(held === 1 ? 'heldNote1' : 'heldNote', { n: held })}</p>}
        </section>
      )}

      <aside className="hub"><strong>{t('hubTitle')}</strong>{t('hubBody')}</aside>
      <p className="foot">{t('footer')}</p>

      {barTable && slot != null && (
        <div className="bar">
          <div className="bar-in">
            <div className="bar-txt">
              <strong>{tableName(barTable)}</strong>
              <span>{dayShort(d)}, {hm(slot)}–{hm(slot + sel.dur)}</span>
            </div>
            <div className="bar-r">
              <span className="bar-p">{money(rate(venue, d, slot, false) * sel.dur / 60)}</span>
              <button className="btn" onClick={() => setSheet({ type: 'book', pick: { date: k, tableId: barTable.id, start: slot, dur: sel.dur } })}>
                {t('book')}
              </button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          {sheet.type === 'book' ? (
            <BookSheet info={info} pick={sheet.pick} contact={contact} setContact={setContact} onBooked={booked} />
          ) : (
            <DoneSheet info={info} booking={sheet.booking} onSeeVenue={onSeeVenue} onClose={() => setSheet(null)} />
          )}
        </Sheet>
      )}
    </>
  )
}

function TableButton({ table: x, busy, date, start, dur, selected, onPick }: {
  table: Table
  busy: Busy[]
  date: string
  start: number
  dur: number
  selected: boolean
  onPick: () => void
}) {
  const { t, tableName } = useI18n()
  const st = x.walkIn ? 'held' : !tableFree(busy, date, x.id, start, start + dur) ? 'taken' : selected ? 'sel' : 'free'
  const label = { held: t('walkin'), taken: t('taken'), sel: t('yours'), free: t('tFree') }[st]
  const ok = st === 'free' || st === 'sel'
  return (
    <button className={`tb ${x.type} ${st}`} disabled={!ok} aria-pressed={st === 'sel'} aria-label={`${tableName(x)}: ${label}`} onClick={onPick}>
      <TableSvg table={x} />
      <span className="tb-l">{label}</span>
    </button>
  )
}

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { DayStrip } from '../components/DayStrip'
import { Sheet } from '../components/Sheet'
import { useI18n } from '../i18n'
import { fetchBookings } from '../lib/api'
import { useNow, usePolled, useViewportWidth } from '../lib/hooks'
import { BOOKING_DAYS, hoursOn, isActive, tableFree } from '../lib/rules'
import { dayKey, hm, nextDays, nowMin, parseDay } from '../lib/time'
import type { Booking, OpenHours, Table, VenueInfo } from '../lib/types'
import { AddSheet } from './AddSheet'
import { DetailSheet } from './DetailSheet'
import { SettingsCard } from './SettingsCard'

/** px for the table-name column */
const NW = 92
/** App bookings are highlighted as new for a day, or until staff change their status. */
const NEW_FOR_MS = 24 * 3600_000

type SheetState = { type: 'detail'; id: string } | { type: 'add'; tableId: string; start: number } | null

export function VenueView({ info, dayIdx, setDayIdx, focusId, clearFocus, reloadInfo }: {
  info: VenueInfo
  dayIdx: number
  setDayIdx: (i: number) => void
  /** Booking to scroll to, e.g. right after booking it in the player view. */
  focusId: string | null
  clearFocus: () => void
  reloadInfo: () => Promise<void>
}) {
  const { t, dayLong } = useI18n()
  const { venue, tables } = info
  const now = useNow()
  const todayKey = dayKey(now)
  const days = useMemo(() => nextDays(BOOKING_DAYS, parseDay(todayKey)), [todayKey])
  const from = dayKey(days[0]), to = dayKey(days[days.length - 1])
  const q = usePolled(`${venue.id}:${from}`, () => fetchBookings(venue.id, from, to), 30_000)
  const [sheet, setSheet] = useState<SheetState>(null)
  const vw = useViewportWidth()

  const d = days[dayIdx], k = dayKey(d), h = hoursOn(info, d)
  const day = (q.data ?? []).filter(b => b.date === k && isActive(b))
  const n = day.length, p = day.reduce((s, b) => s + b.players, 0), a = day.filter(b => b.source === 'app').length
  const sum = n ? t(n === 1 ? 'vSum1' : 'vSum', { n, p }) + ' ' + t(a === 1 ? 'vApp1' : 'vApp', { a }) : t('vEmpty')
  const table = (id: string) => tables.find(x => x.id === id)!

  const afterChange = async () => { await q.reload(); setSheet(null) }

  function openAdd(tableId: string, x: number, hw: number, [o, c]: OpenHours) {
    let m = o + Math.floor(x / hw * 2) * 30
    m = Math.max(o, Math.min(m, c - 60))
    if (!tableFree(day, k, tableId, m, m + 30)) return
    setSheet({ type: 'add', tableId, start: m })
  }

  const detail = sheet?.type === 'detail' ? (q.data ?? []).find(b => b.id === sheet.id) : undefined
  const sw = (bg: string, bd: string, l: string) => (
    <span><i className="sw" style={{ background: bg, borderColor: bd }} />{l}</span>
  )

  return (
    <>
      <div className="vhead">
        <h1>{t('vTitle')}</h1>
        <p className="muted vdate">{dayLong(d)}{h && `, ${hm(h[0])}–${hm(h[1])}`}</p>
      </div>
      <DayStrip days={days} selected={dayIdx} onPick={setDayIdx} />
      <p className="summary">{q.data ? sum : q.error ? t('netErr') : t('loading')}</p>
      {h ? (
        <Timeline key={k} tables={tables} bookings={day} hours={h} vw={vw} nowMs={now.getTime()} nowM={dayIdx === 0 ? nowMin(now) : null}
          focusId={focusId} onFocused={clearFocus} onBlock={id => setSheet({ type: 'detail', id })} onTrack={openAdd} />
      ) : (
        <p className="muted">{t('closedDay')}</p>
      )}
      <div className="legend">
        {sw('var(--chalk-tint)', 'var(--chalk)', t('lgBooked'))}
        {sw('var(--green-tint)', 'var(--cloth)', t('lgArrived'))}
        {sw('var(--red-tint)', 'var(--red)', t('lgNoshow'))}
        {sw('var(--ball-tint)', 'var(--ball)', t('lgNew'))}
      </div>
      <p className="note">{t('tapHint')}</p>
      <SettingsCard info={info} onSaved={reloadInfo} />
      <p className="foot">{t('footer')}</p>

      {sheet && (
        <Sheet onClose={() => setSheet(null)}>
          {sheet.type === 'detail' && detail ? (
            <DetailSheet booking={detail} table={table(detail.tableId)} onChanged={afterChange} />
          ) : sheet.type === 'add' && h ? (
            <AddSheet venueId={venue.id} table={table(sheet.tableId)} date={k} start={sheet.start} close={h[1]}
              bookings={day} onSaved={afterChange} onClose={() => setSheet(null)} />
          ) : null}
        </Sheet>
      )}
    </>
  )
}

/** All tables side by side on one day's opening hours. Scrolls sideways on phones. */
function Timeline({ tables, bookings, hours, vw, nowMs, nowM, focusId, onFocused, onBlock, onTrack }: {
  tables: Table[]
  bookings: Booking[]
  hours: OpenHours
  vw: number
  nowMs: number
  /** Minutes now, only when showing today. */
  nowM: number | null
  focusId: string | null
  onFocused: () => void
  onBlock: (id: string) => void
  onTrack: (tableId: string, x: number, hw: number, hours: OpenHours) => void
}) {
  const { t, tableShort } = useI18n()
  const [o, c] = hours
  // px per hour; stretches to fill wide screens
  const HW = Math.max(64, (Math.min(1000, vw) - 34 - NW) / ((c - o) / 60))
  const W = (c - o) / 60 * HW
  const scRef = useRef<HTMLDivElement>(null)

  // Opening a day: start at "now" for today, 19:00 otherwise. (Timeline is keyed by day, so this runs per day.)
  useLayoutEffect(() => {
    let m = nowM ?? 1140
    if (m < o || m > c) m = 1140
    if (scRef.current) scRef.current.scrollLeft = Math.max(0, (m - o) / 60 * HW - 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on mount only; later updates must keep the user's scroll position
  }, [])

  const focusB = focusId ? bookings.find(b => b.id === focusId) : undefined
  useLayoutEffect(() => {
    if (!focusB || !scRef.current) return
    scRef.current.scrollLeft = Math.max(0, (focusB.start - o) / 60 * HW - 40)
    onFocused()
  }, [focusB, o, HW, onFocused])

  const hrs = []
  for (let m = Math.ceil(o / 60) * 60; m < c; m += 60) hrs.push(<span key={m} style={{ left: (m - o) / 60 * HW }}>{hm(m)}</span>)

  return (
    <div className="tl-card">
      <div className="tl-scroll" ref={scRef}>
        <div className="tl-inner" style={{ width: NW + W, '--hw': `${HW}px`, '--nw': `${NW}px` } as CSSProperties}>
          <div className="tl-head"><div className="tl-name" /><div className="tl-hours" style={{ width: W }}>{hrs}</div></div>
          {tables.map(x => (
            <div key={x.id} className={`tl-row${x.walkIn ? ' held' : ''}`}>
              <div className="tl-name">{tableShort(x)}</div>
              <div className="tl-track" style={{ width: W }}
                onClick={e => onTrack(x.id, e.clientX - e.currentTarget.getBoundingClientRect().left, HW, hours)}>
                {x.walkIn && <span className="held-l">{t('walkin')}</span>}
                {bookings.filter(b => b.tableId === x.id).map(b => {
                  const isNew = b.source === 'app' && b.status === 'booked' && nowMs - Date.parse(b.createdAt) < NEW_FOR_MS
                  return (
                    <button key={b.id} className={`bk ${b.status}${isNew ? ' new' : ''}`}
                      style={{ left: (b.start - o) / 60 * HW + 2, width: b.dur / 60 * HW - 4 }}
                      aria-label={`${b.name}, ${hm(b.start)}–${hm(b.start + b.dur)}`}
                      onClick={e => { e.stopPropagation(); onBlock(b.id) }}>
                      <span>{b.name}</span><small>{b.players}p</small>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {nowM != null && nowM >= o && nowM <= c && <div className="nowline" style={{ left: NW + (nowM - o) / 60 * HW }} />}
        </div>
      </div>
    </div>
  )
}

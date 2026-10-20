import type { Busy, BookingStatus, GameType, Settings, Table, VenueInfo } from './types'

/** How many days ahead players can book, including today. */
export const BOOKING_DAYS = 7
export const DURATIONS = [60, 90, 120]
/** Order of the game options and price line. */
export const GAMES: GameType[] = ['pool', 'snooker', 'carom']
/** Weekend prepay applies to Friday and Saturday from 17:00. */
const EVENING_FROM = 17 * 60

export const hoursOn = (info: VenueInfo, d: Date) => info.hours[d.getDay()] ?? null

/** Hourly rate in euros for this type of table. */
export const rate = (info: VenueInfo, type: GameType) => (info.rates[type] ?? 0) / 100

/** Latest bookable start that day: the venue's online cutoff, else as late as closing allows. */
export const lastStartOn = (info: VenueInfo, close: number, dur: number) =>
  Math.min(close - dur, info.settings.lastStart ?? Infinity)

export const prepayRequired = (s: Settings, d: Date, m: number) =>
  s.prepayWeekend && (d.getDay() === 5 || d.getDay() === 6) && m >= EVENING_FROM

type Slot = Busy & { status?: BookingStatus }

/** Cancelled bookings free the table; everything else (incl. no-shows) still holds it. */
export const isActive = (b: { status?: BookingStatus }) => b.status !== 'cancelled'

export function tableFree(list: Slot[], date: string, tableId: string, s: number, e: number) {
  return !list.some(b => b.date === date && b.tableId === tableId && isActive(b) && b.start < e && s < b.start + b.dur)
}

/** Tables of this type that can be booked online for [s, s+dur). */
export function freeTables(tables: Table[], list: Slot[], date: string, type: GameType, s: number, dur: number) {
  return tables.filter(x => x.type === type && !x.walkIn && tableFree(list, date, x.id, s, s + dur))
}

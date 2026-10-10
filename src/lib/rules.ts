import type { Busy, BookingStatus, GameType, Settings, Table, Venue, VenueInfo } from './types'

/** How many days ahead players can book, including today. */
export const BOOKING_DAYS = 7
export const DURATIONS = [60, 90, 120]
/** Off-peak runs until 17:00 (and all day Sunday). Prepay evenings start here too. */
export const OFF_PEAK_UNTIL = 17 * 60

export const hoursOn = (info: VenueInfo, d: Date) => info.hours[d.getDay()] ?? null

/** Hourly rate in euros for a booking starting at minute m on day d. */
export function rate(v: Venue, d: Date, m: number, student: boolean) {
  const cents =
    d.getDay() === 0 || m < OFF_PEAK_UNTIL ? v.offPeakPriceCents : student ? v.studentPriceCents : v.priceCents
  return cents / 100
}

export const prepayRequired = (s: Settings, d: Date, m: number) =>
  s.prepayWeekend && (d.getDay() === 5 || d.getDay() === 6) && m >= OFF_PEAK_UNTIL

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

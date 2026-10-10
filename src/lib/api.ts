// Temporary in-memory data layer so the UI can be ported and checked first.
// The next commits replace this with Supabase, keeping the same functions.
import type { Booking, BookingStatus, Busy, NewBooking, Settings, Table, VenueInfo } from './types'
import { tableFree } from './rules'

export class ApiError extends Error {
  kind: 'overlap' | 'other'
  constructor(kind: 'overlap' | 'other', message = kind) {
    super(message)
    this.kind = kind
  }
}

const tables: Table[] = [
  ...[1, 2].map(n => ({ id: 'S' + n, type: 'snooker' as const, number: n, walkIn: false })),
  ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 'P' + n, type: 'pool' as const, number: n, walkIn: n > 4 })),
]

const info: VenueInfo = {
  venue: {
    id: 'de-peper', slug: 'de-peper', name: 'Poolcafé de Peper', address: 'Peperstraat 13', city: 'Delft',
    priceCents: 960, studentPriceCents: 840, offPeakPriceCents: 720,
  },
  tables,
  hours: [[1020, 1440], [1020, 1500], [1020, 1500], [1020, 1500], [1020, 1500], [840, 1560], [840, 1560]],
  settings: { holdBack: 2, prepayWeekend: false },
}

let bookings: Booking[] = []

export async function loadVenueInfo(_slug: string): Promise<VenueInfo> {
  return structuredClone(info)
}

export async function fetchBusy(_venueId: string, from: string, to: string): Promise<Busy[]> {
  return bookings
    .filter(b => b.status !== 'cancelled' && b.date >= from && b.date <= to)
    .map(({ tableId, date, start, dur }) => ({ tableId, date, start, dur }))
}

export async function createBooking(_venueId: string, nb: NewBooking): Promise<Booking> {
  if (!tableFree(bookings, nb.date, nb.tableId, nb.start, nb.start + nb.dur)) throw new ApiError('overlap')
  const b: Booking = { ...nb, id: crypto.randomUUID(), status: 'booked', paid: false, createdAt: new Date().toISOString() }
  bookings = [...bookings, b]
  return b
}

export async function fetchBookings(_venueId: string, from: string, to: string): Promise<Booking[]> {
  return bookings.filter(b => b.date >= from && b.date <= to)
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  bookings = bookings.map(b => (b.id === id ? { ...b, status } : b))
}

export async function saveSettings(_venueId: string, s: Settings): Promise<void> {
  info.settings = { ...s }
  const pool = info.tables.filter(x => x.type === 'pool')
  info.tables.forEach(x => { x.walkIn = x.type === 'pool' && x.number > pool.length - s.holdBack })
}

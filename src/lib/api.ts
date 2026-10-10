// All database access. Tables and policies are defined in supabase/schema.sql.
import { getVenueToken, setVenueToken, supabase } from './supabase'
import type { Booking, BookingStatus, Busy, GameType, NewBooking, OpenHours, Settings, VenueInfo } from './types'

export class ApiError extends Error {
  /** overlap: the table is already taken. session: venue login expired or missing. */
  kind: 'overlap' | 'session' | 'other'
  constructor(kind: 'overlap' | 'session' | 'other', message: string = kind) {
    super(message)
    this.kind = kind
  }
}

/** Fired when a venue request turns out not to be logged in, so the venue view shows the PIN screen. */
export const SESSION_LOST = 'keu:session-lost'

function sessionLost(): never {
  setVenueToken(null)
  window.dispatchEvent(new Event(SESSION_LOST))
  throw new ApiError('session')
}

function fail(error: { code?: string; message: string }): never {
  if (error.code === '23P01') throw new ApiError('overlap', error.message) // bookings_no_overlap
  throw new ApiError('other', error.message)
}

// ---------- Public (players) ----------

export async function loadVenueInfo(slug: string): Promise<VenueInfo> {
  const { data: v, error } = await supabase
    .from('venues')
    .select('id, slug, name, address, city, price_cents, student_price_cents, off_peak_price_cents')
    .eq('slug', slug)
    .single()
  if (error) fail(error)

  const [tables, hours, settings] = await Promise.all([
    // 'snooker' > 'pool', so descending puts snooker first, like the venue timeline wants
    supabase.from('tables').select('id, type, number, walk_in').eq('venue_id', v.id)
      .order('type', { ascending: false }).order('number'),
    supabase.from('opening_hours').select('weekday, open_minutes, close_minutes').eq('venue_id', v.id),
    supabase.from('venue_settings').select('hold_back, prepay_weekend').eq('venue_id', v.id).single(),
  ])
  if (tables.error) fail(tables.error)
  if (hours.error) fail(hours.error)
  if (settings.error) fail(settings.error)

  const week: (OpenHours | null)[] = Array(7).fill(null)
  for (const h of hours.data) week[h.weekday] = [h.open_minutes, h.close_minutes]

  return {
    venue: {
      id: v.id, slug: v.slug, name: v.name, address: v.address, city: v.city,
      priceCents: v.price_cents, studentPriceCents: v.student_price_cents, offPeakPriceCents: v.off_peak_price_cents,
    },
    tables: tables.data.map(x => ({ id: x.id, type: x.type as GameType, number: x.number, walkIn: x.walk_in })),
    hours: week,
    settings: { holdBack: settings.data.hold_back, prepayWeekend: settings.data.prepay_weekend },
  }
}

/** Taken slots between two dates (inclusive). Names and phone numbers stay private. */
export async function fetchBusy(venueId: string, from: string, to: string): Promise<Busy[]> {
  const { data, error } = await supabase.rpc('busy_slots', { venue: venueId, from_date: from, to_date: to })
  if (error) fail(error)
  return (data as { table_id: string; date: string; start_minutes: number; duration_minutes: number }[])
    .map(r => ({ tableId: r.table_id, date: r.date, start: r.start_minutes, dur: r.duration_minutes }))
}

/**
 * App bookings (anyone) and phone bookings (venue session). The id is made here
 * because players aren't allowed to read bookings back after inserting.
 * The database refuses overlaps, walk-in tables and times outside opening hours.
 */
export async function createBooking(venueId: string, nb: NewBooking): Promise<Booking> {
  const b: Booking = { ...nb, id: uuid(), status: 'booked', paid: false, createdAt: new Date().toISOString() }
  const { error } = await supabase.from('bookings').insert({
    id: b.id, venue_id: venueId, table_id: b.tableId, date: b.date, start_minutes: b.start, duration_minutes: b.dur,
    name: b.name, phone: b.phone, players: b.players, source: b.source,
  })
  if (error) {
    if (error.code === '42501' && nb.source === 'phone') sessionLost() // RLS: not logged in any more
    fail(error)
  }
  return b
}

// ---------- Venue (needs a session) ----------

/** Logs in with the venue PIN. Returns false for a wrong PIN or while login is locked. */
export async function venueLogin(slug: string, pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('venue_login', { venue_slug: slug, pin })
  if (error) fail(error)
  setVenueToken((data as string | null) ?? null)
  return data != null
}

export async function venueLogout(): Promise<void> {
  if (getVenueToken()) await supabase.rpc('venue_logout')
  setVenueToken(null)
}

/** Whether the stored token is still a live session for this venue. */
export async function hasVenueSession(venueId: string): Promise<boolean> {
  if (!getVenueToken()) return false
  const { data, error } = await supabase.rpc('venue_session_venue')
  if (error) fail(error)
  if (data !== venueId) setVenueToken(null)
  return data === venueId
}

export async function fetchBookings(venueId: string, from: string, to: string): Promise<Booking[]> {
  // Without a session RLS just returns no rows, so check the session alongside.
  const [session, res] = await Promise.all([
    supabase.rpc('venue_session_venue'),
    supabase.from('bookings')
      .select('id, table_id, date, start_minutes, duration_minutes, name, phone, players, source, status, paid, created_at')
      .eq('venue_id', venueId).gte('date', from).lte('date', to)
      .order('start_minutes'),
  ])
  if (session.error) fail(session.error)
  if (session.data !== venueId) sessionLost()
  if (res.error) fail(res.error)
  return res.data.map(r => ({
    id: r.id, tableId: r.table_id, date: r.date, start: r.start_minutes, dur: r.duration_minutes,
    name: r.name, phone: r.phone, players: r.players, source: r.source, status: r.status, paid: r.paid, createdAt: r.created_at,
  }))
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { data, error } = await supabase.from('bookings').update({ status }).eq('id', id).select('id')
  if (error) fail(error)
  if (!data.length) sessionLost() // RLS matched nothing
}

export async function saveSettings(venueId: string, s: Settings): Promise<void> {
  const { data, error } = await supabase.from('venue_settings')
    .update({ hold_back: s.holdBack, prepay_weekend: s.prepayWeekend })
    .eq('venue_id', venueId).select('venue_id')
  if (error) fail(error)
  if (!data.length) sessionLost()
}

/** crypto.randomUUID only exists on https/localhost; fall back for phones testing over the LAN. */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

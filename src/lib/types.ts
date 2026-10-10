export type GameType = 'pool' | 'snooker'
export type BookingStatus = 'booked' | 'arrived' | 'noshow' | 'cancelled'
export type BookingSource = 'app' | 'phone'

export interface Venue {
  id: string
  slug: string
  name: string
  address: string
  city: string
  priceCents: number
  studentPriceCents: number
  offPeakPriceCents: number
}

export interface Table {
  id: string
  type: GameType
  number: number
  /** Kept free for walk-ins, so it can't be booked online. */
  walkIn: boolean
}

/** [open, close] in minutes from midnight. close can run past 1440 into the next night. */
export type OpenHours = readonly [open: number, close: number]

export interface Settings {
  holdBack: number
  prepayWeekend: boolean
}

export interface VenueInfo {
  venue: Venue
  /** Snooker first, then pool, each by number (the order the venue timeline shows them). */
  tables: Table[]
  /** Index = weekday (0 = Sunday). null = closed that day. */
  hours: (OpenHours | null)[]
  settings: Settings
}

/** A slot someone has taken. This is all the public player view gets to see. */
export interface Busy {
  tableId: string
  /** YYYY-MM-DD */
  date: string
  start: number
  dur: number
}

export interface Booking extends Busy {
  id: string
  name: string
  phone: string | null
  players: number
  source: BookingSource
  status: BookingStatus
  paid: boolean
  createdAt: string
}

export type NewBooking = Pick<Booking, 'tableId' | 'date' | 'start' | 'dur' | 'name' | 'phone' | 'players' | 'source'>

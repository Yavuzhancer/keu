import type { GameType } from '../lib/types'

/** What the player has picked so far. Lives in App so it survives switching tabs. */
export interface PlayerSel {
  game: GameType
  dayIdx: number
  dur: number
  slot: number | null
  table: string | null
}

export const initialSel: PlayerSel = { game: 'pool', dayIdx: 0, dur: 60, slot: null, table: null }

/** Name and phone are remembered between bookings in the same visit. */
export interface Contact {
  name: string
  phone: string
}

/** The booking being confirmed, frozen when the sheet opens so live availability updates can't change it. */
export interface Pick {
  date: string
  tableId: string
  start: number
  dur: number
}

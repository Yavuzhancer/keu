import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False until .env (locally) or the repo secrets (on GitHub Pages) provide the Supabase URL and key. */
export const configured = Boolean(url && key)

const TOKEN_KEY = 'keu.venueToken'

let venueToken: string | null = null
try { venueToken = localStorage.getItem(TOKEN_KEY) } catch { /* storage blocked */ }

export const getVenueToken = () => venueToken

export function setVenueToken(token: string | null) {
  venueToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage blocked: session lasts until reload */ }
}

/**
 * Every request carries the venue session token (when logged in) as the
 * x-venue-token header. The RLS policies in supabase/migrations/ read it to decide
 * whether the request may see and change bookings.
 */
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers)
      if (venueToken) headers.set('x-venue-token', venueToken)
      return fetch(input, { ...init, headers })
    },
  },
})

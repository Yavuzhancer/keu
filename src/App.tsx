import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { LangContext, initialLang, makeI18n, type Lang } from './i18n'
import { loadVenueInfo } from './lib/api'
import { useHashRoute, usePolled, type Route } from './lib/hooks'
import { BOOKING_DAYS } from './lib/rules'
import { dayKey, nextDays } from './lib/time'
import type { Booking } from './lib/types'
import { PlayerView } from './player/PlayerView'
import { initialSel, type Contact, type PlayerSel } from './player/state'
import { VenueView } from './venue/VenueView'

/** The one venue this build serves. */
const VENUE_SLUG = 'de-peper'

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const [route, go] = useHashRoute()
  const info = usePolled(VENUE_SLUG, () => loadVenueInfo(VENUE_SLUG), 60_000)
  const [sel, setSel] = useState<PlayerSel>(initialSel)
  const [contact, setContact] = useState<Contact>({ name: '', phone: '' })
  const [venueDay, setVenueDay] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const clearFocus = useCallback(() => setFocusId(null), [])
  const { t } = makeI18n(lang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('keu.lang', l) } catch { /* storage blocked */ }
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])

  const navigate = (r: Route) => { go(r); window.scrollTo(0, 0) }

  // "See it in the venue view" after booking: open that day and scroll to the booking.
  const seeInVenue = (b: Booking) => {
    setVenueDay(Math.max(0, nextDays(BOOKING_DAYS).findIndex(d => dayKey(d) === b.date)))
    setFocusId(b.id)
    navigate('venue')
  }

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className={`wrap${route === 'venue' ? ' wide' : ''}`}>
        <Header route={route} onRoute={navigate} />
        {!info.data ? (
          <p className="muted">{info.error ? t('netErr') : t('loading')}</p>
        ) : route === 'player' ? (
          <PlayerView info={info.data} sel={sel} setSel={setSel} contact={contact} setContact={setContact}
            onSeeVenue={seeInVenue} />
        ) : (
          <VenueView info={info.data} dayIdx={venueDay} setDayIdx={setVenueDay} focusId={focusId} clearFocus={clearFocus}
            reloadInfo={info.reload} />
        )}
      </div>
    </LangContext.Provider>
  )
}

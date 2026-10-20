import { createContext, useContext, useMemo } from 'react'
import type { Table } from './lib/types'
import { cap } from './lib/time'

export type Lang = 'en' | 'nl'

const en = {
  demo:'Concept demo', tabPlayer:'Book a table', tabVenue:'Venue view',
  openToday:'Open today {a}–{b}', priceAll:'{p} per hour.', priceFirst:'{p} per hour for {types}', priceNext:'{p} for {types}', and:'and',
  pool:'Pool', snooker:'Snooker', carom:'Billiards', nTables:'{n} tables',
  when:'When', today:'Today', howLong:'How long', h1:'1 hour', h15:'1½ hours', h2:'2 hours',
  pickTime:'Pick a time', free:'{n} free', full:'Full', noTimes:'No times left today. Pick another day.',
  pickTable:'Pick a table', poolTable:'Pool table {n}', snookerTable:'Snooker table {n}', caromTable:'Billiards table {n}',
  tFree:'Free', taken:'Taken', walkin:'Walk-in', yours:'Your table',
  heldNote:'{n} pool tables stay free for walk-ins.', heldNote1:'1 pool table stays free for walk-ins.',
  book:'Book table',
  hubTitle:'Full here?', hubBody:'Next step: see free tables at other pool spots in Delft, in the same app.',
  footer:"Concept demo. It isn't connected to {venue}'s real reservations, so nothing booked here is real. Prices and opening hours come from public info and may be out of date; table counts are an estimate.",
  yourName:'Your name', name:'Name', namePh:'e.g. Sanne', nameErr:"Add your name so the bar knows who's coming.",
  phone:'Phone number, for a reminder text', players:'Players',
  payment:'Payment', payBar:'Pay at the bar', payNow:'Prepay with iDEAL',
  prepayReq:'On Friday and Saturday evenings this bar asks you to prepay.', total:'Total',
  headline:'{table} is yours', playersN:'{n} players', paidBar:'pay at the bar', paidNow:'prepaid',
  reminder:"You'll get a reminder text 2 hours before. Can't make it? Cancel in the app so someone else can play.",
  demoNote:'This is a demo, so no real table was booked.',
  seeVenue:'See it in the venue view', done:'Done',
  vTitle:'Bookings', vSum:'{n} bookings for {p} players.', vSum1:'1 booking for {p} players.',
  vApp:'{a} came in through the app, the rest by phone or WhatsApp.', vApp1:'1 came in through the app, the rest by phone or WhatsApp.',
  vEmpty:'No bookings yet.',
  tapHint:'Tap an empty spot in a row to add a phone or WhatsApp booking.',
  lgBooked:'Booked', lgArrived:'Arrived', lgNoshow:'No-show', lgNew:'New from the app',
  settings:'Settings', holdLabel:'Pool tables kept free for walk-ins', holdHelp:'These tables never show up for online booking.',
  prepayLabel:'Prepayment on Friday and Saturday evenings', prepayHelp:'Fewer no-shows on your busiest nights.',
  via:'Booked via', viaApp:'app', viaPhone:'phone or WhatsApp', status:'Status',
  st_booked:'booked', st_arrived:'arrived', st_noshow:'no-show', st_cancelled:'cancelled',
  markArrived:'Mark as arrived', markNoShow:'Mark as no-show', cancelBooking:'Cancel booking',
  addTitle:'Add a booking', addSub:'{table}, from {a}', save:'Add booking', close:'Close',
  addNameErr:'Add a name for this booking.',
  overlapErr:"That runs into {name}'s booking at {t}. Pick a shorter time.",
  closeErr:'That runs past closing time ({t}). Pick a shorter time.',
  fewer:'Fewer', more:'More',
  // Added for the real app
  loading:'Loading…', closedToday:'Closed today',
  netErr:'Something went wrong. Check your connection and try again.',
  takenErr:'Someone just booked this table. Close this and pick another time or table.',
  payLater:"Online payment isn't live yet, so you'll pay at the bar.",
  closedDay:'Closed this day.', phoneShort:'Phone',
  overlapAny:'That runs into another booking. Pick a shorter time.',
  loginTitle:'Venue login', loginSub:'Bookings include names and phone numbers, so this part is for staff only.',
  pin:'Venue PIN or password', unlock:'Unlock', logout:'Log out',
  pinErr:"That didn't work. After 5 wrong tries, login locks for 5 minutes.",
  lastNote:'Online booking is for start times until {t}. Later, just walk in.',
  lastLabel:'Last start time for online bookings', lastHelp:'Later guests walk in. You can still add later bookings here.',
  earlier:'Earlier', later:'Later',
}

type Key = keyof typeof en

const nl: Record<Key, string> = {
  demo:'Conceptdemo', tabPlayer:'Tafel boeken', tabVenue:'Overzicht zaak',
  openToday:'Vandaag open {a}–{b}', priceAll:'{p} per uur.', priceFirst:'{p} per uur voor {types}', priceNext:'{p} voor {types}', and:'en',
  pool:'Pool', snooker:'Snooker', carom:'Biljart', nTables:'{n} tafels',
  when:'Wanneer', today:'Vandaag', howLong:'Hoe lang', h1:'1 uur', h15:'1½ uur', h2:'2 uur',
  pickTime:'Kies een tijd', free:'{n} vrij', full:'Vol', noTimes:'Vandaag geen tijden meer. Kies een andere dag.',
  pickTable:'Kies een tafel', poolTable:'Pooltafel {n}', snookerTable:'Snookertafel {n}', caromTable:'Biljarttafel {n}',
  tFree:'Vrij', taken:'Bezet', walkin:'Inloop', yours:'Jouw tafel',
  heldNote:'{n} pooltafels blijven vrij voor inloop.', heldNote1:'1 pooltafel blijft vrij voor inloop.',
  book:'Tafel boeken',
  hubTitle:'Hier vol?', hubBody:'Volgende stap: vrije tafels bij andere poolcafés in Delft zien, in dezelfde app.',
  footer:'Conceptdemo. Niet gekoppeld aan de echte reserveringen van {venue}, dus niets wat je hier boekt is echt. Prijzen en openingstijden komen uit openbare info en kunnen verouderd zijn; het aantal tafels is een schatting.',
  yourName:'Je naam', name:'Naam', namePh:'bijv. Sanne', nameErr:'Vul je naam in, dan weet de bar wie er komt.',
  phone:'Telefoonnummer, voor een herinnering per sms', players:'Spelers',
  payment:'Betalen', payBar:'Aan de bar betalen', payNow:'Vooraf betalen met iDEAL',
  prepayReq:'Op vrijdag- en zaterdagavond vraagt deze bar om vooraf te betalen.', total:'Totaal',
  headline:'{table} is voor jou', playersN:'{n} spelers', paidBar:'betalen aan de bar', paidNow:'vooraf betaald',
  reminder:'Je krijgt 2 uur van tevoren een sms. Kun je toch niet? Annuleer in de app, dan kan iemand anders spelen.',
  demoNote:'Dit is een demo, er is dus geen echte tafel geboekt.',
  seeVenue:'Bekijk het in het overzicht', done:'Klaar',
  vTitle:'Reserveringen', vSum:'{n} reserveringen voor {p} spelers.', vSum1:'1 reservering voor {p} spelers.',
  vApp:'{a} via de app, de rest via telefoon of WhatsApp.', vApp1:'1 via de app, de rest via telefoon of WhatsApp.',
  vEmpty:'Nog geen reserveringen.',
  tapHint:'Tik op een lege plek in een rij om een telefoon- of WhatsApp-reservering toe te voegen.',
  lgBooked:'Geboekt', lgArrived:'Binnen', lgNoshow:'Niet gekomen', lgNew:'Nieuw via de app',
  settings:'Instellingen', holdLabel:'Pooltafels vrijhouden voor inloop', holdHelp:'Deze tafels zijn nooit online te boeken.',
  prepayLabel:'Vooraf betalen op vrijdag- en zaterdagavond', prepayHelp:'Minder no-shows op je drukste avonden.',
  via:'Geboekt via', viaApp:'app', viaPhone:'telefoon of WhatsApp', status:'Status',
  st_booked:'geboekt', st_arrived:'binnen', st_noshow:'niet gekomen', st_cancelled:'geannuleerd',
  markArrived:'Markeer als binnen', markNoShow:'Markeer als niet gekomen', cancelBooking:'Reservering annuleren',
  addTitle:'Reservering toevoegen', addSub:'{table}, vanaf {a}', save:'Reservering toevoegen', close:'Sluiten',
  addNameErr:'Vul een naam in voor deze reservering.',
  overlapErr:'Dat loopt door in de reservering van {name} om {t}. Kies een kortere tijd.',
  closeErr:'Dat loopt door na sluitingstijd ({t}). Kies een kortere tijd.',
  fewer:'Minder', more:'Meer',
  loading:'Laden…', closedToday:'Vandaag gesloten',
  netErr:'Er ging iets mis. Controleer je verbinding en probeer het opnieuw.',
  takenErr:'Iemand heeft deze tafel net geboekt. Sluit dit en kies een andere tijd of tafel.',
  payLater:'Online betalen werkt nog niet, je betaalt aan de bar.',
  closedDay:'Op deze dag gesloten.', phoneShort:'Telefoon',
  overlapAny:'Dat loopt door in een andere reservering. Kies een kortere tijd.',
  loginTitle:'Inloggen zaak', loginSub:'Reserveringen bevatten namen en telefoonnummers, dus dit deel is alleen voor personeel.',
  pin:'Pincode of wachtwoord van de zaak', unlock:'Ontgrendelen', logout:'Uitloggen',
  pinErr:'Dat klopt niet. Na 5 foute pogingen is inloggen 5 minuten geblokkeerd.',
  lastNote:'Online reserveren kan voor starttijden tot en met {t}. Daarna loop je gewoon binnen.',
  lastLabel:'Laatste starttijd voor online reserveren', lastHelp:'Wie later komt, loopt binnen. Latere reserveringen kun je hier zelf toevoegen.',
  earlier:'Eerder', later:'Later',
}

const STRINGS: Record<Lang, Record<Key, string>> = { en, nl }

/** Everything that depends on the current language: strings, money, dates, table names. */
export function makeI18n(lang: Lang) {
  const loc = lang === 'nl' ? 'nl-NL' : 'en-GB'
  const t = (k: Key, v: Record<string, string | number> = {}) =>
    STRINGS[lang][k].replace(/\{(\w+)\}/g, (_, x: string) => String(v[x] ?? ''))
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, o).format(d)
  return {
    lang, t, fmt,
    money: (euros: number) => new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(euros),
    dayShort: (d: Date) => fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }),
    dayLong: (d: Date) => cap(fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })),
    durLabel: (m: number) => (m === 60 ? t('h1') : m === 90 ? t('h15') : t('h2')),
    tableName: (x: Table) => t(`${x.type}Table`, { n: x.number }),
    tableShort: (x: Table) => t(x.type) + ' ' + x.number,
  }
}

export type I18n = ReturnType<typeof makeI18n>

export const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
})

export function useI18n() {
  const { lang, setLang } = useContext(LangContext)
  return { ...useMemo(() => makeI18n(lang), [lang]), setLang }
}

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('keu.lang')
    if (saved === 'en' || saved === 'nl') return saved
  } catch { /* storage blocked: fall through */ }
  return navigator.language.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

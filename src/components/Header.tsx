import { useI18n } from '../i18n'
import type { Route } from '../lib/hooks'

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#fff" stroke="#15211B" strokeWidth="2" />
      <circle cx="20.5" cy="11" r="3.4" fill="#2B66AE" />
    </svg>
  )
}

export function Header({ route, onRoute }: { route: Route; onRoute: (r: Route) => void }) {
  const { t, lang, setLang } = useI18n()
  return (
    <>
      <header className="top">
        <div className="brand"><Logo /><span className="word">Keu</span><span className="demo">{t('demo')}</span></div>
        <div className="lang" role="group" aria-label="Language">
          <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
          <button aria-pressed={lang === 'nl'} onClick={() => setLang('nl')}>NL</button>
        </div>
      </header>
      <nav className="views">
        <button aria-pressed={route === 'player'} onClick={() => onRoute('player')}>{t('tabPlayer')}</button>
        <button aria-pressed={route === 'venue'} onClick={() => onRoute('venue')}>{t('tabVenue')}</button>
      </nav>
    </>
  )
}

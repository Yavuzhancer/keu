import { useEffect, useState, type ComponentProps, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { SESSION_LOST, hasVenueSession, venueLogin, venueLogout } from '../lib/api'
import { VenueView } from './VenueView'

type Props = Omit<ComponentProps<typeof VenueView>, 'onLogout'>

/** Shows the venue view only with a valid venue session; otherwise the PIN screen. */
export function VenueGate(props: Props) {
  const { t } = useI18n()
  const venue = props.info.venue
  const [state, setState] = useState<'checking' | 'out' | 'in'>('checking')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<'pin' | 'net' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    hasVenueSession(venue.id).then(ok => { if (live) setState(ok ? 'in' : 'out') }, () => { if (live) setState('out') })
    const lost = () => setState('out')
    window.addEventListener(SESSION_LOST, lost)
    return () => { live = false; window.removeEventListener(SESSION_LOST, lost) }
  }, [venue.id])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !pin) return
    setBusy(true)
    setErr(null)
    try {
      if (await venueLogin(venue.slug, pin)) { setPin(''); setState('in') }
      else setErr('pin')
    } catch {
      setErr('net')
    }
    setBusy(false)
  }

  async function logout() {
    await venueLogout().catch(() => {})
    setState('out')
  }

  if (state === 'checking') return <p className="muted">{t('loading')}</p>
  if (state === 'in') return <VenueView {...props} onLogout={logout} />

  return (
    <>
      <div className="vhead">
        <h1>{t('loginTitle')}</h1>
        <p className="muted vdate">{t('loginSub')}</p>
      </div>
      <form className="card login" onSubmit={submit}>
        <label className="fld">
          <span>{t('pin')}</span>
          <input type="password" autoComplete="current-password" value={pin} autoFocus
            onChange={e => { setPin(e.target.value); setErr(null) }} />
          {err && <em className="err">{t(err === 'pin' ? 'pinErr' : 'netErr')}</em>}
        </label>
        <button className="btn" type="submit" disabled={busy || !pin}>{t('unlock')}</button>
      </form>
      <p className="foot">{t('footer', { venue: venue.name })}</p>
    </>
  )
}

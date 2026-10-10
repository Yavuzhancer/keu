import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data now, again every `pollMs` while the tab is visible, and when the tab
 * becomes visible again. Changing `key` triggers a fresh load. Pass key=null to pause.
 */
export function usePolled<T>(key: string | null, load: () => Promise<T>, pollMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const loadRef = useRef(load)
  const seq = useRef(0)
  useEffect(() => { loadRef.current = load })

  const reload = useCallback(async () => {
    const n = ++seq.current
    try {
      const d = await loadRef.current()
      if (n === seq.current) { setData(d); setError(null) }
    } catch (e) {
      if (n === seq.current) setError(e)
    }
  }, [])

  useEffect(() => {
    if (key == null) return
    reload()
    const visible = () => document.visibilityState === 'visible'
    const id = setInterval(() => { if (visible()) reload() }, pollMs)
    const onVis = () => { if (visible()) reload() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [key, pollMs, reload])

  return { data, error, reload }
}

/** The current time, refreshed every 30 seconds so "now" lines and past slots stay right. */
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function useViewportWidth() {
  const [w, setW] = useState(() => document.documentElement.clientWidth)
  useEffect(() => {
    let t: number | undefined
    const on = () => { clearTimeout(t); t = window.setTimeout(() => setW(document.documentElement.clientWidth), 150) }
    window.addEventListener('resize', on)
    return () => { clearTimeout(t); window.removeEventListener('resize', on) }
  }, [])
  return w
}

export type Route = 'player' | 'venue'

const readRoute = (): Route => (location.hash.replace(/^#\/?/, '').startsWith('venue') ? 'venue' : 'player')

/** Hash routing (#/ and #/venue) so the app works on GitHub Pages without server rewrites. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute)
  useEffect(() => {
    const on = () => setRoute(readRoute())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((r: Route) => { location.hash = r === 'venue' ? '#/venue' : '#/' }, [])
  return [route, go]
}

/** Toggles a class on <body> while `on` is true (used for the sticky bar and open sheets). */
export function useBodyClass(name: string, on: boolean) {
  useEffect(() => {
    if (!on) return
    document.body.classList.add(name)
    return () => document.body.classList.remove(name)
  }, [name, on])
}

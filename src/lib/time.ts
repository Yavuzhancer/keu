/** Minutes from midnight → "HH:MM". Values past 1440 wrap into the next night. */
export const hm = (m: number) =>
  String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')

/** Local date → "YYYY-MM-DD", the format Postgres uses for `date`. */
export const dayKey = (d: Date) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

/** "YYYY-MM-DD" → local midnight. */
export const parseDay = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes()

/** Today plus the next n-1 days, each at local midnight. */
export function nextDays(n: number, from = new Date()): Date[] {
  const d0 = new Date(from)
  d0.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(d0)
    d.setDate(d0.getDate() + i)
    return d
  })
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

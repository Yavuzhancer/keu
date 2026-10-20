import type { Table } from '../lib/types'

/** Top-down pool, snooker or carom table: wooden rail, lit cloth, pockets (not on carom), table number. */
export function TableSvg({ table }: { table: Table }) {
  const sn = table.type === 'snooker'
  const W = sn ? 320 : 180, H = sn ? 160 : 100, r = sn ? 15 : 12, pr = sn ? 6.5 : 7.5
  const iw = W - 2 * r, ih = H - 2 * r, gid = 'g' + table.id
  const carom = table.type === 'carom'
  const pockets = carom ? [] : [[r, r], [W / 2, r - 1.5], [W - r, r], [r, H - r], [W / 2, H - r + 1.5], [W - r, H - r]]
  // Carom: white, yellow and red ball, clear of the number in the middle
  const balls: [number, number, string][] = [[r + iw * 0.17, H * 0.34, '#F4F1E8'], [r + iw * 0.24, H * 0.66, '#F4C21B'], [r + iw * 0.83, H * 0.5, '#C23A2E']]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <radialGradient id={gid} cx="50%" cy="42%" r="65%">
          <stop offset="0" stopColor="#1F8E66" />
          <stop offset=".6" stopColor="#0F6B4C" />
          <stop offset="1" stopColor="#0A4C36" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} rx={r} fill="#6A4127" />
      <rect x={r} y={r} width={iw} height={ih} rx="3" fill={`url(#${gid})`} />
      {carom ? (
        balls.map(([cx, cy, fill]) => <circle key={fill} cx={cx} cy={cy} r="4.5" fill={fill} />)
      ) : sn ? (
        <line x1={r + iw * 0.22} y1={r} x2={r + iw * 0.22} y2={H - r} stroke="rgba(255,255,255,.35)" strokeWidth="1.2" />
      ) : (
        <>
          <circle cx={r + iw * 0.25} cy={H / 2} r="2" fill="rgba(255,255,255,.55)" />
          <circle cx={r + iw * 0.75} cy={H / 2} r="2" fill="rgba(255,255,255,.55)" />
        </>
      )}
      {pockets.map(([a, b], i) => <circle key={i} cx={a} cy={b} r={pr} fill="#0D0D0D" />)}
      <text className="tb-n" x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central">{table.number}</text>
    </svg>
  )
}

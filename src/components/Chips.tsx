/** A row of pill buttons where exactly one value is selected. */
export function Chips<T extends string | number>({
  values, value, onPick, label = String,
}: {
  values: readonly T[]
  value: T
  onPick: (v: T) => void
  label?: (v: T) => string
}) {
  return (
    <div className="chips">
      {values.map(v => (
        <button key={v} className="chip" aria-pressed={v === value} onClick={() => onPick(v)}>{label(v)}</button>
      ))}
    </div>
  )
}

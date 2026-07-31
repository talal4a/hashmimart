import { IconMinus, IconPlus } from './Icons'

export default function QuantityControl({ value, onChange, min = 1, max = 999, size = 'md' }) {
  const decrement = () => onChange(Math.max(min, value - 1))
  const increment = () => onChange(Math.min(max, value + 1))

  return (
    <div className={`qty-control qty-control--${size}`}>
      <button type="button" className="qty-btn" onClick={decrement} disabled={value <= min} aria-label="Decrease quantity">
        <IconMinus />
      </button>
      <span className="qty-value" aria-live="polite">{value}</span>
      <button type="button" className="qty-btn" onClick={increment} disabled={value >= max} aria-label="Increase quantity">
        <IconPlus />
      </button>
    </div>
  )
}

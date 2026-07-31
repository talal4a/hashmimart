import Logo from './Logo'

// Branded full-screen loading state used by route guards while auth resolves.
// Replaces the plain "Loading..." text with the brand mark and a subtle pulse.
export default function PageLoader({ label = 'Loading' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Logo size={44} className="page-loader__logo" />
      <span className="page-loader__label">{label}</span>
    </div>
  )
}

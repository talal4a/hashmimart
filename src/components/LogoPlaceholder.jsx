import Logo from './Logo'

// Retained for compatibility: renders the real brand mark at a named size.
// (Previously showed a "LOGO" text box placeholder.)
export default function LogoPlaceholder({ size = 'md' }) {
  const sizes = { sm: 28, md: 36, lg: 60 }
  return <Logo size={sizes[size] || sizes.md} />
}

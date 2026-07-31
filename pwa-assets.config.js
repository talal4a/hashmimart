import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    // Transparent favicon/PWA icons so the mark sits on the browser tab and
    // launcher without a white card behind it.
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
      resizeOptions: { background: { r: 0, g: 0, b: 0, alpha: 0 }, fit: 'contain' },
    },
    // Maskable MUST stay opaque: Android crops it to a shape and fills any
    // transparency with a system colour, which looks broken.
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
    // iOS also composites onto black if the touch icon is transparent.
    apple: {
      sizes: [180],
      padding: 0.3,
      resizeOptions: { background: '#ffffff', fit: 'contain' },
    },
  },
  images: ['public/logo-source.png'],
})

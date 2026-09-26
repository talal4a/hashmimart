const CATEGORIES_KEY = 'hashmi-network-categories'

const DEFAULT_CATEGORIES = [
  { id: 'cat-retail', name: 'retail', createdAt: '2025-01-01T00:00:00.000Z' },
]

// Shopping modes the store no longer offers. Rows may still exist in the
// shopping_modes table (and in older localStorage caches), so every reader
// filters them out — see isRetiredMode.
const RETIRED_MODES = new Set(['wholesale'])

export function isRetiredMode(name) {
  return RETIRED_MODES.has(name)
}

export function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      const active = Array.isArray(data)
        ? data.filter((c) => !isRetiredMode(c?.name))
        : []
      if (active.length > 0) return active
    }
  } catch {
    // localStorage data may be absent or corrupted
  }
  saveCategories(DEFAULT_CATEGORIES)
  return [...DEFAULT_CATEGORIES]
}

export function saveCategories(categories) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
}

export function generateCategoryId() {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function validateCategoryName(name, existingCategories) {
  const trimmed = name.trim()
  if (!trimmed) return 'Category name cannot be empty'
  const exists = existingCategories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (exists) return 'Category already exists'
  return null
}

export function getCategoryDisplayName(name) {
  if (name === 'retail') return 'Retail'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getCategoryDescription(name) {
  if (name === 'retail') return 'Everyday essentials for home — shop by category'
  return `Browse ${getCategoryDisplayName(name)} products`
}

export function getCategoryBadge(name) {
  if (name === 'retail') return { text: 'For Home', className: '' }
  return null
}

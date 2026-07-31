const CATEGORIES_KEY = 'hashmi-network-categories'

const DEFAULT_CATEGORIES = [
  { id: 'cat-retail', name: 'retail', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'cat-wholesale', name: 'wholesale', createdAt: '2025-01-01T00:00:00.000Z' },
]

export function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.length > 0) return data
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
  if (name === 'wholesale') return 'Wholesale'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getCategoryDescription(name) {
  if (name === 'retail') return 'Everyday essentials for home — shop by item'
  if (name === 'wholesale') return 'Bulk quantities at better rates for businesses'
  return `Browse ${getCategoryDisplayName(name)} products`
}

export function getCategoryBadge(name) {
  if (name === 'retail') return { text: 'For Home', className: '' }
  if (name === 'wholesale') return { text: 'For Business', className: 'category-badge-wholesale' }
  return null
}

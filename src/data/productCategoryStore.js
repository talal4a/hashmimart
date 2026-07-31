const STORAGE_KEY = 'hashmi-network-product-categories'

const DEFAULT_CATEGORIES = [
  { id: 'pc-dairy', name: 'Dairy', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-bakery', name: 'Bakery', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-rice', name: 'Rice', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-beverages', name: 'Beverages', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-snacks', name: 'Snacks', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-vegetables', name: 'Vegetables', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-fruits', name: 'Fruits', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-meat', name: 'Meat', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-cooking-oil', name: 'Cooking Oil', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'pc-staples', name: 'Staples', createdAt: '2025-01-01T00:00:00.000Z' },
]

export function loadProductCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch {
    // localStorage data may be absent or corrupted
  }
  saveProductCategories(DEFAULT_CATEGORIES)
  return [...DEFAULT_CATEGORIES]
}

export function saveProductCategories(categories) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export function generateProductCategoryId() {
  return `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function validateProductCategoryName(name, existingCategories) {
  const trimmed = name.trim()
  if (!trimmed) return 'Category name cannot be empty'
  const exists = existingCategories.some(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  )
  if (exists) return 'Category already exists'
  return null
}

/* ── Product category tree ──
   Product categories are two levels deep: main categories (parentId null)
   and their subcategories (parentId → a main category). Products point at
   either level by name. These helpers keep that tree logic out of pages. */

export function getMainCategories(categories) {
  return categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSubcategories(categories, parentId) {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* Names of a category and all of its subcategories — the set of
   productCategory values that belong on that category's page. */
export function getCategoryFamilyNames(categories, categoryId) {
  const self = categories.find((c) => c.id === categoryId);
  if (!self) return new Set();
  return new Set([
    self.name,
    ...getSubcategories(categories, categoryId).map((c) => c.name),
  ]);
}

/* Main categories first, each followed by its subcategories — the order
   the admin list and the product form's category picker use. */
export function getCategoryTree(categories) {
  return getMainCategories(categories).flatMap((main) => [
    { ...main, depth: 0 },
    ...getSubcategories(categories, main.id).map((sub) => ({
      ...sub,
      depth: 1,
    })),
  ]);
}

/* A subcategory whose parent was deleted (or never loaded) is shown as a
   main category rather than disappearing from every list. */
export function normalizeCategoryParents(categories) {
  const ids = new Set(categories.map((c) => c.id));
  return categories.map((c) =>
    c.parentId && !ids.has(c.parentId) ? { ...c, parentId: null } : c,
  );
}

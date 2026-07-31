// Single source of truth for role-based access. Both the admin nav and the
// route guards read from here so the two can never drift out of sync.

export const ROLES = {
  SUPERADMIN: "superadmin",
  ORDERMANAGER: "ordermanager",
  USER: "user",
};

export const ADMIN_SECTIONS = [
  { key: "orders", path: "/admin/orders", label: "Orders" },
  { key: "products", path: "/admin/products", label: "Products" },
  {
    key: "productCategories",
    path: "/admin/product-categories",
    label: "Product Categories",
  },
  { key: "discounts", path: "/admin/discounts", label: "Discounts" },
  { key: "wishlist", path: "/admin/wishlist", label: "Wishlist" },
];

// Array order is the tab order rendered for that role.
const SECTIONS_BY_ROLE = {
  [ROLES.SUPERADMIN]: [
    "orders",
    "products",
    "productCategories",
    "discounts",
    "wishlist",
  ],
  [ROLES.ORDERMANAGER]: ["orders"],
};

export const isStaff = (role) =>
  role === ROLES.SUPERADMIN || role === ROLES.ORDERMANAGER;

export const canAccessSection = (role, key) =>
  (SECTIONS_BY_ROLE[role] ?? []).includes(key);

export function sectionsForRole(role) {
  return (SECTIONS_BY_ROLE[role] ?? [])
    .map((key) => ADMIN_SECTIONS.find((s) => s.key === key))
    .filter(Boolean);
}

// Map a URL slug (the kebab-case tail of an admin path, e.g. "product-categories"
// from /admin/product-categories) to its section object. Returns undefined for an
// unknown slug so callers can treat it as a 403.
export function sectionBySlug(slug) {
  if (!slug) return undefined;
  return ADMIN_SECTIONS.find((s) => s.path === `/admin/${slug}`);
}

// Where a role lands after login, and where "go back" points from a 403.
export function landingPathForRole(role) {
  return isStaff(role) ? "/admin/orders" : "/";
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { isStaff as roleIsStaff } from "../lib/permissions";
import { INITIAL_PRODUCTS } from "../data/products";
import {
  isRetiredMode,
  loadCategories as loadLocalCategories,
  saveCategories as saveLocalCategories,
} from "../data/categoryStore";
import {
  DEFAULT_STORE_SETTINGS,
  computeOrderTotals,
  settingsFromRow,
  settingsToRow,
} from "../lib/pricing";
import { normalizeCategoryParents } from "../lib/categories";

const CART_KEY = "hashmi-network-cart";
const SESSION_KEY = "hashmi-session";
const PRODUCTS_KEY = "hashmi-network-products";
const PRODUCT_CATS_KEY = "hashmi-network-product-cats";
const SETTINGS_KEY = "hashmi-store-settings";
// sessionStorage: survives a refresh on checkout, gone when the app closes.
const DIRECT_ORDER_KEY = "hashmi-direct-order-text";
// Feature flag, not yet wired to a reader. Kept deliberately so the
// retention work has a single switch to turn on.
// eslint-disable-next-line no-unused-vars
const ENABLE_ORDER_RETENTION = false;

const StoreContext = createContext(null);

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    // Carts saved before wholesale was retired may still hold its items.
    if (raw) return JSON.parse(raw).filter((i) => !isRetiredMode(i.category));
  } catch {
    // localStorage data may be absent or corrupted
  }
  return [];
}

function loadJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // storage may be unavailable, or the data absent or corrupted
  }
  return fallback;
}

function saveJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — the in-memory state still works
  }
}

function persistCategories(categories) {
  saveJson(localStorage, PRODUCT_CATS_KEY, categories);
  return categories;
}

function loadDirectOrderText() {
  try {
    return sessionStorage.getItem(DIRECT_ORDER_KEY) || "";
  } catch {
    return "";
  }
}

// A column or table the database doesn't have yet (migration not run):
// PostgREST says PGRST204 / PGRST205, Postgres itself 42703 / 42P01.
function isMissingColumn(error) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

function isMissingTable(error) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

const MIGRATION_FILE = "supabase/store-settings-text-orders-subcategories.sql";

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function loadLocalProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage data may be absent or corrupted
  }
  return INITIAL_PRODUCTS;
}

function saveLocalProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const SESSION_ID = getSessionId();

function createOrderId() {
  return `HN-${Date.now().toString(36).toUpperCase()}`;
}

// ---- Lookup caches for FK mapping ----
let modeIdBySlug = null;
let catIdByName = null;

async function ensureLookups() {
  if (!modeIdBySlug) {
    const { data } = await supabase.from("shopping_modes").select("id, slug");
    modeIdBySlug = Object.fromEntries((data || []).map((m) => [m.slug, m.id]));
  }
  if (!catIdByName) {
    const { data } = await supabase
      .from("product_categories")
      .select("id, name");
    catIdByName = Object.fromEntries((data || []).map((c) => [c.name, c.id]));
  }
  return { modeIdBySlug, catIdByName };
}

function flattenProduct(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.shopping_mode?.slug,
    productCategory: p.product_category?.name,
    productCategoryId: p.product_category_id ?? null,
    price: Number(p.price),
    salePrice: p.sale_price != null ? Number(p.sale_price) : null,
    unit: p.unit,
    image: p.image,
    imageUrl: p.image_url,
    description: p.description,
    inStock: p.in_stock,
  };
}

function mapCategoryRow(c) {
  return {
    id: c.id,
    name: c.name,
    parentId: c.parent_id ?? null,
    createdAt: c.created_at,
  };
}

// Shared by loadOrders and loadRecentOrders. The price-breakdown columns and
// order_text come from the store-settings migration; on a database without it
// they are simply absent and read as null.
function mapOrderRow(o, items) {
  const numOrNull = (v) => (v == null ? null : Number(v));
  return {
    id: o.display_id,
    dbId: o.id,
    userId: o.user_id,
    status: o.status,
    createdAt: o.created_at,
    customer: {
      fullName: o.customer_name,
      phone: o.customer_phone,
      society: o.customer_society,
      address: o.customer_address,
    },
    items,
    total: Number(o.total),
    subtotal: numOrNull(o.subtotal),
    deliveryCharge: numOrNull(o.delivery_charge),
    discountAmount: numOrNull(o.discount_amount),
    paymentMethod: o.payment_method,
    estimatedDelivery: o.estimated_delivery_minutes,
    isVoiceOrder: o.is_voice_order || false,
    audioUrl: o.audio_url || null,
    orderText: o.order_text || null,
  };
}

function mapOrderItemRow(item) {
  return {
    productId: item.product_id,
    name: item.product_name,
    price: Number(item.product_price),
    unit: item.product_unit,
    image: item.product_image,
    imageUrl: item.product_image_url,
    category: item.shopping_mode,
    productCategory: item.product_category,
    quantity: item.quantity,
  };
}

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [products, setProducts] = useState(loadLocalProducts);
  const [categories, setCategories] = useState(loadLocalCategories);
  const [productCategories, setProductCategories] = useState(() =>
    loadJson(localStorage, PRODUCT_CATS_KEY, []),
  );
  const [productCategoriesLoading, setProductCategoriesLoading] = useState(
    () => loadJson(localStorage, PRODUCT_CATS_KEY, []).length === 0,
  );
  const [societies, setSocieties] = useState([]);
  // Direct Order list (voice → text or typed), carried to checkout.
  const [directOrderText, setDirectOrderTextState] =
    useState(loadDirectOrderText);
  const [storeSettings, setStoreSettings] = useState(() => ({
    ...DEFAULT_STORE_SETTINGS,
    ...loadJson(localStorage, SETTINGS_KEY, {}),
  }));
  const [toast, setToast] = useState(null);
  // Loading flags drive skeleton states. Seed products from cache presence so
  // returning users (who already have local data) skip the skeleton flash.
  const [productsLoading, setProductsLoading] = useState(
    () => loadLocalProducts().length === 0,
  );
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [notifsLoading, setNotifsLoading] = useState(true);

  // Which notification feed this session sees. StoreProvider sits outside
  // AuthProvider, so useAuth() isn't reachable here — resolve the role
  // straight from Supabase instead. Staff (superadmin/ordermanager) get the
  // "staff" feed; everyone else gets "customer".
  const [audience, setAudience] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveAudience(user) {
      if (!user) return "customer";
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      return roleIsStaff(data?.role) ? "staff" : "customer";
    }

    supabase.auth.getSession().then(async (response) => {
      const next = await resolveAudience(response?.data?.session?.user ?? null);
      if (!cancelled) setAudience(next);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const next = await resolveAudience(session?.user ?? null);
      if (!cancelled) setAudience(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // ---- Load all data from Supabase on mount ----
  useEffect(() => {
    // Hold off until the role is known, or the first pass would query the
    // wrong feed and briefly show staff rows to a customer.
    if (audience === null) return;

    let cancelled = false;

    async function fetchWithRetry(url, retries = 2) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await url;
        } catch (err) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
    }

    async function loadProducts() {
      try {
        const { data } = await supabase
          .from("products")
          .select(
            "*, shopping_mode:shopping_modes(slug), product_category:product_categories(name)",
          )
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (data && data.length > 0) {
          const flat = data.map(flattenProduct);
          setProducts(flat);
          saveLocalProducts(flat);
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    async function loadModes() {
      try {
        const res = await fetchWithRetry(
          supabase
            .from("shopping_modes")
            .select("*")
            .order("created_at", { ascending: false }),
        );
        const data = res?.data ?? null;
        if (cancelled) return;
        if (data && data.length > 0) {
          const mapped = data
            .map((m) => ({ id: m.id, name: m.slug }))
            .filter((m) => !isRetiredMode(m.name));
          setCategories(mapped);
          saveLocalCategories(mapped);
          modeIdBySlug = Object.fromEntries(data.map((m) => [m.slug, m.id]));
        }
      } catch {
        // fetch failed after retries, using cached/default categories
      }
    }

    async function loadProductCats() {
      try {
        const { data } = await supabase
          .from("product_categories")
          .select("*")
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (data) {
          const mapped = normalizeCategoryParents(data.map(mapCategoryRow));
          setProductCategories(mapped);
          saveJson(localStorage, PRODUCT_CATS_KEY, mapped);
          catIdByName = Object.fromEntries(data.map((c) => [c.name, c.id]));
        }
      } finally {
        if (!cancelled) setProductCategoriesLoading(false);
      }
    }

    async function loadSettings() {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled) return;
      // No table yet (migration not run) → keep the defaults.
      if (error || !data) return;
      const next = settingsFromRow(data);
      setStoreSettings(next);
      saveJson(localStorage, SETTINGS_KEY, next);
    }

    async function loadSocieties() {
      const { data } = await supabase
        .from("societies")
        .select("*")
        .order("name", { ascending: true });
      if (cancelled) return;
      if (data) {
        setSocieties(
          data.map((s) => ({
            id: s.id,
            name: s.name,
            createdAt: s.created_at,
          })),
        );
      }
    }

    async function loadWishlist() {
      try {
        const { data: rows } = await supabase
          .from("wishlist_items")
          .select("product_id")
          .eq("session_id", SESSION_ID);
        if (cancelled) return;
        if (rows && rows.length > 0) {
          const ids = rows.map((r) => r.product_id);
          const { data: wishProducts } = await supabase
            .from("products")
            .select(
              "*, shopping_mode:shopping_modes(slug), product_category:product_categories(name)",
            )
            .in("id", ids);
          if (wishProducts) {
            const wishlistData = wishProducts
              .filter((p) => !isRetiredMode(p.shopping_mode?.slug))
              .map((p) => {
                const f = flattenProduct(p);
                return {
                  productId: f.id,
                  name: f.name,
                  price: f.price,
                  salePrice: f.salePrice,
                  unit: f.unit,
                  image: f.image,
                  imageUrl: f.imageUrl,
                  category: f.category,
                  productCategory: f.productCategory,
                };
              });
            setWishlist(wishlistData);
            // Save to localStorage as backup
            localStorage.setItem(
              "hashmi-wishlist",
              JSON.stringify(wishlistData),
            );
            return;
          }
        }
      } catch (error) {
        console.error("Failed to load wishlist from Supabase:", error);
      }

      // Fallback to localStorage
      try {
        const raw = localStorage.getItem("hashmi-wishlist");
        if (raw) {
          const parsed = JSON.parse(raw);
          setWishlist(parsed);
        }
      } catch {
        // localStorage data may be absent or corrupted
      }
    }

    async function loadOrders() {
      try {
        let query = supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        // Only filter out hidden orders for staff/admin users
        if (audience === "staff") {
          query = query.eq("hidden_by_admin", false);
        }

        const { data: ordersData } = await query;
        if (cancelled || !ordersData || ordersData.length === 0) {
          if (ordersData && ordersData.length === 0) {
            try {
              const raw = localStorage.getItem("hashmi-network-store");
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.orders) setOrders(parsed.orders);
              }
            } catch {
              // localStorage data may be absent or corrupted
            }
          }
          return;
        }
        const orderIds = ordersData.map((o) => o.id);
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        if (cancelled) return;
        const itemsByOrder = {};
        for (const item of itemsData || []) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
          itemsByOrder[item.order_id].push(mapOrderItemRow(item));
        }
        setOrders(
          ordersData.map((o) => mapOrderRow(o, itemsByOrder[o.id] || [])),
        );
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    }

    async function loadNotifs() {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("*, orders(display_id)")
          .eq("audience", audience)
          .order("created_at", { ascending: false });
        if (cancelled || !data) return;
        setNotifications(
          data.map((n) => ({
            id: n.id,
            orderId: n.orders?.display_id,
            message: n.message,
            is_read: n.is_read,
            createdAt: n.created_at,
          })),
        );
      } finally {
        if (!cancelled) setNotifsLoading(false);
      }
    }

    loadProducts();
    loadModes();
    loadProductCats();
    loadSettings();
    loadSocieties();
    loadWishlist();
    loadOrders();
    loadNotifs();

    // Live-update the bell without a page refresh. payload.new has no joined
    // display_id, so re-read the row with its order. The filter keeps staff
    // and customer feeds separate — without it each side sees the other's.
    const notifChannel = supabase
      .channel(`notifications-feed:${audience}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `audience=eq.${audience}`,
        },
        async (payload) => {
          if (cancelled) return;
          const { data: row } = await supabase
            .from("notifications")
            .select("*, orders(display_id)")
            .eq("id", payload.new.id)
            .single();
          if (cancelled || !row) return;
          setNotifications((prev) =>
            // updateOrderStatus already inserted this optimistically.
            prev.some((n) => n.id === row.id)
              ? prev
              : [
                  {
                    id: row.id,
                    orderId: row.orders?.display_id,
                    message: row.message,
                    is_read: row.is_read,
                    createdAt: row.created_at,
                  },
                  ...prev,
                ],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(notifChannel);
    };
  }, [audience]);

  // ---- Cart helpers (local state + localStorage, no Supabase) ----
  const addToCart = useCallback(
    (product, quantity = 1) => {
      if (quantity < 1) return;
      setCart((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        let next;
        if (existing) {
          next = prev.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        } else {
          next = [
            ...prev,
            {
              productId: product.id,
              name: product.name,
              price: product.salePrice ?? product.price,
              originalPrice: product.price,
              unit: product.unit,
              image: product.image,
              imageUrl: product.imageUrl,
              category: product.category,
              productCategory: product.productCategory,
              quantity,
            },
          ];
        }
        saveCart(next);
        setToast({ message: "Added to cart", type: "success" });
        setTimeout(() => setToast(null), 3000);
        return next;
      });
    },
    [setToast],
  );

  const updateCartQuantity = useCallback((productId, quantity) => {
    setCart((prev) => {
      let next;
      if (quantity < 1) {
        next = prev.filter((item) => item.productId !== productId);
      } else {
        next = prev.map((item) =>
          item.productId === productId ? { ...item, quantity } : item,
        );
      }
      saveCart(next);
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => {
      const next = prev.filter((item) => item.productId !== productId);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    saveCart([]);
  }, []);

  // ---- Wishlist (Supabase wishlist_items) ----
  const toggleWishlist = useCallback(
    async (product) => {
      const exists = wishlist.some((item) => item.productId === product.id);

      if (exists) {
        try {
          await supabase
            .from("wishlist_items")
            .delete()
            .eq("session_id", SESSION_ID)
            .eq("product_id", product.id);
        } catch (error) {
          console.error("Failed to remove from Supabase wishlist:", error);
        }
        setWishlist((prev) => {
          const next = prev.filter((item) => item.productId !== product.id);
          localStorage.setItem("hashmi-wishlist", JSON.stringify(next));
          return next;
        });
        setToast({ message: "Removed from wishlist", type: "info" });
        setTimeout(() => setToast(null), 3000);
      } else {
        try {
          await supabase
            .from("wishlist_items")
            .insert({ session_id: SESSION_ID, product_id: product.id });
        } catch (error) {
          console.error("Failed to add to Supabase wishlist:", error);
        }
        setWishlist((prev) => {
          const next = [
            ...prev,
            {
              productId: product.id,
              name: product.name,
              price: product.price,
              salePrice: product.salePrice,
              unit: product.unit,
              image: product.image,
              imageUrl: product.imageUrl,
              category: product.category,
              productCategory: product.productCategory,
            },
          ];
          localStorage.setItem("hashmi-wishlist", JSON.stringify(next));
          return next;
        });
        setToast({ message: "Added to wishlist", type: "success" });
        setTimeout(() => setToast(null), 3000);
      }
    },
    [wishlist, setToast],
  );

  const isInWishlist = useCallback(
    (productId) => wishlist.some((item) => item.productId === productId),
    [wishlist],
  );

  // ---- Direct Order text (voice → text, or typed) ----
  const setDirectOrderText = useCallback((text) => {
    setDirectOrderTextState(text);
    try {
      if (text) sessionStorage.setItem(DIRECT_ORDER_KEY, text);
      else sessionStorage.removeItem(DIRECT_ORDER_KEY);
    } catch {
      // sessionStorage unavailable — the in-memory copy still reaches checkout
    }
  }, []);

  // ---- Orders (Supabase orders + order_items) ----
  // A normal order is priced from the cart with the admin's delivery fee and
  // store discount. A Direct Order (`orderText`) carries the customer's list
  // instead of line items; staff price it afterwards, so its total starts at 0.
  const placeOrder = useCallback(
    async (customerInfo, { orderText = null } = {}) => {
      const displayId = createOrderId();
      const listText = orderText?.trim() || null;
      const isTextOrder = Boolean(listText);

      const subtotal = isTextOrder
        ? 0
        : cart.reduce((sum, item) => {
            const finalPrice =
              item.salePrice && item.salePrice > 0
                ? item.salePrice
                : item.price;
            return sum + finalPrice * item.quantity;
          }, 0);
      const totals = isTextOrder
        ? null
        : computeOrderTotals(subtotal, storeSettings);
      const orderTotal = totals ? totals.total : 0;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in before placing an order.");

      const basePayload = {
        display_id: displayId,
        customer_name: customerInfo.fullName,
        customer_phone: customerInfo.phone,
        customer_email: user.email,
        user_id: user.id,
        customer_city: customerInfo.city || "Lahore",
        customer_society: customerInfo.society || null,
        customer_address: customerInfo.address || null,
        total: orderTotal,
        payment_method: customerInfo.paymentMethod || "Cash on Delivery",
        is_voice_order: false,
      };
      const extraPayload = isTextOrder
        ? { order_text: listText }
        : {
            subtotal: totals.subtotal,
            discount_amount: totals.discount,
            delivery_charge: totals.deliveryCharge,
          };

      let { data: orderRow, error: orderError } = await supabase
        .from("orders")
        .insert({ ...basePayload, ...extraPayload })
        .select()
        .single();

      if (orderError && isMissingColumn(orderError)) {
        console.error(
          `placeOrder: orders table is missing new columns — run ${MIGRATION_FILE} in Supabase.`,
          orderError,
        );
        // Without order_text there is nowhere to keep the customer's list, so
        // a Direct Order can't be saved. A cart order only loses its stored
        // price breakdown (the total is still correct), so retry without it.
        if (isTextOrder) {
          throw new Error(
            "Voice Order is temporarily unavailable. Please add items to your cart instead, or try again later.",
          );
        }
        ({ data: orderRow, error: orderError } = await supabase
          .from("orders")
          .insert(basePayload)
          .select()
          .single());
      }

      if (orderError) {
        console.error("placeOrder: failed to create order", orderError);
        throw new Error(orderError.message);
      }

      if (!isTextOrder) {
        const orderItems = cart.map((item) => ({
          order_id: orderRow.id,
          product_id: item.productId,
          product_name: item.name,
          product_price: item.price,
          product_unit: item.unit,
          product_image: item.image || null,
          product_image_url: item.imageUrl || null,
          product_category: item.productCategory || null,
          shopping_mode: item.category || null,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) {
          console.error("placeOrder: failed to save order items", itemsError);
          await supabase.from("orders").delete().eq("id", orderRow.id);
          
          if (itemsError.message.includes("foreign key constraint")) {
            throw new Error("One or more items in your cart are no longer available in the store. Please clear your cart and add items again.");
          }
          
          throw new Error(itemsError.message);
        }
      }

      // Alert staff that an order came in. Fire-and-forget: a failed alert
      // must never lose an order that Supabase already accepted.
      const { error: staffNotifErr } = await supabase
        .from("notifications")
        .insert({
          order_id: orderRow.id,
          audience: "staff",
          message: isTextOrder
            ? `New Voice Order #${displayId} from ${customerInfo.fullName} — list to price`
            : `New order #${displayId} from ${customerInfo.fullName} — Rs ${orderTotal}`,
          is_read: false,
        });
      if (staffNotifErr) {
        console.error("placeOrder: staff notification failed", staffNotifErr);
      }

      const order = {
        id: displayId,
        dbId: orderRow.id,
        userId: user.id,
        status: "pending",
        createdAt: orderRow.created_at,
        customer: customerInfo,
        items: isTextOrder ? [] : cart.map((item) => ({ ...item })),
        total: orderTotal,
        subtotal: totals ? totals.subtotal : null,
        deliveryCharge: totals ? totals.deliveryCharge : null,
        discountAmount: totals ? totals.discount : null,
        paymentMethod: customerInfo.paymentMethod || "Cash on Delivery",
        estimatedDelivery: null,
        isVoiceOrder: false,
        audioUrl: null,
        orderText: listText,
      };

      setOrders((prev) => [order, ...prev]);
      if (isTextOrder) {
        setDirectOrderText("");
      } else {
        setCart([]);
        saveCart([]);
      }

      return order;
    },
    [cart, storeSettings, setDirectOrderText],
  );

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    try {
      // 1. Ensure we have a valid ID passed in
      if (!orderId) {
        throw new Error("Order ID is missing or undefined");
      }

      if (!["pending", "confirmed", "delivered", "cancelled"].includes(newStatus)) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      // 2. Update directly in Supabase using display_id (since that's what the UI uses)
      const { data: orderRow, error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("display_id", orderId)
        .select()
        .single();

      if (error) throw error;

      // 3. If Supabase returns no updated rows, check RLS or ID
      if (!orderRow) {
        throw new Error(
          `Order with display_id ${orderId} was not found in database or permission denied.`,
        );
      }

      // 4. Update local state so UI updates instantly
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          String(order.id) === String(orderId)
            ? {
                ...order,
                status: newStatus,
                updated_at: new Date().toISOString(),
              }
            : order,
        ),
      );

      console.log(`Order ${orderId} status updated to ${newStatus}`);

      // 5. Create notification for confirmed/delivered/cancelled orders
      if (
        newStatus === "confirmed" ||
        newStatus === "delivered" ||
        newStatus === "cancelled"
      ) {
        let message = `Your order #${orderRow.display_id} was cancelled.`;
        if (newStatus === "confirmed") {
          message = `Your order #${orderRow.display_id} has been confirmed.`;
        } else if (newStatus === "delivered") {
          message = `Your order #${orderRow.display_id} has been delivered.`;
        }

        const { data: notifRow, error: notifErr } = await supabase
          .from("notifications")
          .insert({
            user_id: orderRow.user_id,
            order_id: orderRow.id,
            audience: "customer",
            message,
            is_read: false,
          })
          .select("*, orders(display_id)")
          .single();

        // A failed notification must not roll back a successful status change.
        if (notifErr) {
          console.error(
            "updateOrderStatus: notification insert failed",
            notifErr,
          );
        } else if (notifRow) {
          setNotifications((prev) =>
            // Realtime may have delivered this already on the staff session.
            prev.some((n) => n.id === notifRow.id)
              ? prev
              : [
                  {
                    id: notifRow.id,
                    orderId: notifRow.orders?.display_id,
                    message: notifRow.message,
                    is_read: notifRow.is_read,
                    createdAt: notifRow.created_at,
                  },
                  ...prev,
                ],
          );
        }

        let staffMessage = `Order #${orderRow.display_id} was cancelled.`;
        if (newStatus === "confirmed") {
          staffMessage = `Order #${orderRow.display_id} was confirmed.`;
        } else if (newStatus === "delivered") {
          staffMessage = `Order #${orderRow.display_id} was delivered.`;
        }

        // Staff copy, so the team has a record of the outcome too.
        const { error: staffErr } = await supabase
          .from("notifications")
          .insert({
            order_id: orderRow.id,
            audience: "staff",
            message: staffMessage,
            is_read: false,
          });
        if (staffErr) {
          console.error(
            "updateOrderStatus: staff notification failed",
            staffErr,
          );
        }
      }
    } catch (err) {
      console.error("updateOrderStatus Error:", err.message);
      throw err;
    }
  }, []);

  const deleteOrders = useCallback(
    async (dbIds) => {
      const { data, error } = await supabase
        .from("orders")
        .update({ hidden_by_admin: true })
        .in("id", dbIds)
        .in("status", ["delivered", "cancelled"])
        .select();

      if (error) {
        console.error("deleteOrders failed", error);
        throw new Error(error.message);
      }

      const hidden = data || [];
      /* hidden_by_admin only hides the order from the staff queue — the
         customer keeps it. loadOrders applies that filter for staff alone, so
         this optimistic prune must do the same, or hiding an order would also
         strip it from the customer's dashboard until the next reload. */
      if (audience === "staff") {
        const hiddenIds = new Set(hidden.map((o) => o.display_id));
        setOrders((prev) => prev.filter((o) => !hiddenIds.has(o.id)));
      }
      return hidden.length;
    },
    [audience],
  );

  const cancelUserOrder = useCallback(async (orderId) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("display_id", orderId);

    if (error) {
      console.error("cancelUserOrder failed", error);
      throw new Error(error.message);
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)),
    );
  }, []);

  // ---- Notifications (Supabase notifications) ----
  const markNotificationRead = useCallback(async (notificationId) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("markNotificationRead failed", error);
      return { error: error.message };
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    return {};
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return {};

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (error) {
      console.error("markAllNotificationsRead failed", error);
      return { error: error.message };
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    return { count: unreadIds.length };
  }, [notifications]);

  const deleteNotification = useCallback(async (notificationId) => {
    // .select() catches the RLS case: a blocked delete is not an error, it
    // just matches no visible row, so `error` stays null and we would drop
    // the row locally while it survived in the database.
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .select("id");

    if (error) {
      console.error("deleteNotification failed", error);
      return { error: error.message };
    }

    if (!data || data.length === 0) {
      console.error("deleteNotification affected 0 rows (likely RLS)");
      return {
        error:
          "The database rejected this delete. Check the notifications RLS policy for your role.",
      };
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    return {};
  }, []);

  const clearAllNotifications = useCallback(async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return { count: 0 };

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .in("id", ids)
      .select("id");

    if (error) {
      console.error("clearAllNotifications failed", error);
      return { error: error.message };
    }

    const removed = data || [];
    if (removed.length === 0) {
      return {
        error:
          "The database rejected this delete. Check the notifications RLS policy for your role.",
      };
    }

    // Only drop what the database actually removed — a partial delete would
    // otherwise leave the UI claiming rows are gone that are still there.
    const removedIds = new Set(removed.map((r) => r.id));
    setNotifications((prev) => prev.filter((n) => !removedIds.has(n.id)));
    return { count: removed.length };
  }, [notifications]);

  const loadRecentOrders = useCallback(async () => {
    try {
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      // Only filter out hidden orders for staff/admin users
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (roleIsStaff(data?.role)) {
          query = query.eq("hidden_by_admin", false);
        }
      }

      const { data: ordersData } = await query;
      if (!ordersData || ordersData.length === 0) {
        return [];
      }
      const orderIds = ordersData.map((o) => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      const itemsByOrder = {};
      for (const item of itemsData || []) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(mapOrderItemRow(item));
      }
      return ordersData.map((o) => mapOrderRow(o, itemsByOrder[o.id] || []));
    } catch (error) {
      console.error("loadRecentOrders failed", error);
      return [];
    }
  }, []);

  // ---- Product helpers ----
  // What customers can see. `products` keeps everything for the admin
  // dashboard, including products filed under a retired shopping mode
  // (wholesale), which the shop no longer offers.
  const shopProducts = useMemo(
    () => products.filter((p) => !isRetiredMode(p.category)),
    [products],
  );

  const getProductsByCategory = useCallback(
    (category) =>
      shopProducts.filter((p) => p.category === category && p.inStock),
    [shopProducts],
  );

  const getProductById = useCallback(
    (id) => shopProducts.find((p) => p.id === id),
    [shopProducts],
  );

  // ---- Product CRUD (Supabase + localStorage fallback) ----
  const addProduct = useCallback(async (product) => {
    const lookups = await ensureLookups();
    const newProduct = {
      name: product.name,
      shopping_mode_id: lookups.modeIdBySlug[product.category] || null,
      product_category_id: lookups.catIdByName[product.productCategory] || null,
      price: Number(product.price),
      unit: product.unit || "piece",
      image: product.image || null,
      image_url: product.imageUrl || null,
      in_stock: true,
    };

    if (import.meta.env.DEV)
      console.log("Adding product to Supabase:", newProduct);

    const { data, error } = await supabase
      .from("products")
      .insert(newProduct)
      .select(
        "*, shopping_mode:shopping_modes(slug), product_category:product_categories(name)",
      )
      .single();

    if (error) {
      console.error("Supabase insert product failed:", error);
      // No local fallback: inventing a crypto.randomUUID() here produced a
      // product that looked saved, survived refresh, and existed on no other
      // device. A failed insert must surface as a failure.
      return { error: error.message || "Failed to save product" };
    }

    if (!data) {
      console.error("Supabase insert product returned no row (likely RLS)");
      return {
        error:
          "The database rejected this product. Check the products RLS policy for your role.",
      };
    }

    const flat = flattenProduct(data);
    setProducts((prev) => {
      const next = [...prev, flat];
      saveLocalProducts(next);
      return next;
    });
    return { product: flat };
  }, []);

  const updateProduct = useCallback(async (id, updates) => {
    const dbUpdates = {};

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.salePrice !== undefined)
      dbUpdates.sale_price = updates.salePrice;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.image !== undefined) dbUpdates.image = updates.image;
    if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
    if (updates.inStock !== undefined) dbUpdates.in_stock = updates.inStock;

    // Always include shopping_mode_id if category is provided
    if (updates.category !== undefined) {
      const { modeIdBySlug } = await ensureLookups();
      const modeId = modeIdBySlug[updates.category];
      if (import.meta.env.DEV)
        console.log(
          "Shopping mode lookup:",
          updates.category,
          "->",
          modeId,
          modeIdBySlug,
        );
      dbUpdates.shopping_mode_id = modeId;
    }

    if (updates.productCategory !== undefined) {
      const { catIdByName } = await ensureLookups();
      dbUpdates.product_category_id =
        catIdByName[updates.productCategory] || null;
    }

    if (import.meta.env.DEV)
      console.log("Updating product with dbUpdates:", dbUpdates);

    const { data, error } = await supabase
      .from("products")
      .update(dbUpdates)
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Supabase update failed:", error);
      return { error: error.message || "Failed to update product" };
    }

    // An RLS-blocked update is not an error: it just matches no visible row.
    if (!data || data.length === 0) {
      console.error("Supabase update affected 0 rows (likely RLS):", id);
      return {
        error:
          "The database rejected this edit. Check the products RLS policy for your role.",
      };
    }

    const local =
      dbUpdates.product_category_id !== undefined
        ? { ...updates, productCategoryId: dbUpdates.product_category_id }
        : updates;
    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...local } : p));
      saveLocalProducts(next);
      return next;
    });
    return {};
  }, []);

  const deleteProduct = useCallback(async (id) => {
    // .select() is what makes a blocked delete detectable. An RLS denial is
    // not an error — it just hides the row from the statement, so Postgres
    // reports success with 0 rows affected and `error` stays null. Without
    // this the UI would claim success while the product lives on in the DB.
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Supabase Delete Error:", error.message);
      return { error: error.message || "Failed to delete from database" };
    }

    if (!data || data.length === 0) {
      console.error("Supabase delete affected 0 rows (likely RLS):", id);
      return {
        error:
          "The database rejected this delete. Check the products RLS policy for your role.",
      };
    }

    // Only update local state if database delete succeeded
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveLocalProducts(next);
      return next;
    });
    return {};
  }, []);

  const toggleProductStock = useCallback(
    async (id) => {
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const newStock = !product.inStock;

      const { data, error } = await supabase
        .from("products")
        .update({ in_stock: newStock })
        .eq("id", id)
        .select("id");

      if (error) {
        console.error("Supabase toggleStock failed:", error);
        return { error: error.message || "Failed to update stock" };
      }

      // Flipping local state on a rejected write would show an item as
      // out-of-stock to staff while customers could still order it.
      if (!data || data.length === 0) {
        console.error("toggleStock affected 0 rows (likely RLS):", id);
        return {
          error:
            "The database rejected this change. Check the products RLS policy for your role.",
        };
      }

      setProducts((prev) => {
        const next = prev.map((p) =>
          p.id === id ? { ...p, inStock: newStock } : p,
        );
        saveLocalProducts(next);
        return next;
      });
      return {};
    },
    [products],
  );

  // ---- Product Category CRUD (Supabase) ----
  // Two levels only: a subcategory's parent must be a main category, and a
  // category that has subcategories can't itself become a subcategory.
  const validateParent = useCallback(
    (parentId, selfId = null) => {
      if (!parentId) return null;
      const parent = productCategories.find((c) => c.id === parentId);
      if (!parent) return "Parent category not found";
      if (parent.id === selfId) return "A category can't be its own parent";
      if (parent.parentId) return "Subcategories can't have subcategories";
      if (selfId && productCategories.some((c) => c.parentId === selfId)) {
        return "This category has subcategories, so it must stay a main category";
      }
      return null;
    },
    [productCategories],
  );

  const addProductCategory = useCallback(
    async (name, parentId = null) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "Category name cannot be empty" };
      const duplicate = productCategories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Category already exists" };
      const parentError = validateParent(parentId);
      if (parentError) return { error: parentError };

      const tempId = crypto.randomUUID();
      const tempCat = {
        id: tempId,
        name: trimmed,
        parentId: parentId || null,
        createdAt: new Date().toISOString(),
      };
      setProductCategories((prev) => [...prev, tempCat]);

      // parent_id is only sent for subcategories, so main categories keep
      // working on a database that hasn't run the subcategory migration.
      const { data, error } = await supabase
        .from("product_categories")
        .insert(parentId ? { name: trimmed, parent_id: parentId } : { name: trimmed })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert category failed:", error);
        // Roll back the optimistic row. Keeping it would leave a category
        // with a fake UUID that products can't actually be filed under.
        setProductCategories((prev) => prev.filter((c) => c.id !== tempId));
        if (isMissingColumn(error)) {
          return {
            error: `Subcategories need a database update — run ${MIGRATION_FILE} in Supabase.`,
          };
        }
        return { error: error.message || "Failed to save category" };
      }

      if (!data) {
        console.error("Insert category returned no row (likely RLS)");
        setProductCategories((prev) => prev.filter((c) => c.id !== tempId));
        return {
          error:
            "The database rejected this category. Check its RLS policy for your role.",
        };
      }

      // Replace temp ID with real UUID
      const dbCat = mapCategoryRow(data);
      setProductCategories((prev) =>
        persistCategories(prev.map((c) => (c.id === tempId ? dbCat : c))),
      );
      catIdByName = null;
      return { category: dbCat };
    },
    [productCategories, validateParent],
  );

  // `parentId` is optional: undefined leaves the parent as it is, null makes
  // the category a main category, an id moves it under that category.
  const editProductCategory = useCallback(
    async (id, newName, parentId) => {
      const trimmed = newName.trim();
      if (!trimmed) return { error: "Category name cannot be empty" };
      const duplicate = productCategories.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Category already exists" };

      const old = productCategories.find((c) => c.id === id);
      if (!old) return { error: "Category not found" };
      const oldName = old.name;

      const nextParent = parentId === undefined ? old.parentId : parentId || null;
      const parentChanged = nextParent !== old.parentId;
      if (parentChanged) {
        const parentError = validateParent(nextParent, id);
        if (parentError) return { error: parentError };
      }

      setProductCategories((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, name: trimmed, parentId: nextParent } : c,
        ),
      );
      catIdByName = null;

      const { error } = await supabase
        .from("product_categories")
        .update(
          parentChanged
            ? { name: trimmed, parent_id: nextParent }
            : { name: trimmed },
        )
        .eq("id", id);

      if (error) {
        console.error("Supabase update category failed:", error);
        setProductCategories((prev) =>
          prev.map((c) => (c.id === id ? old : c)),
        );
        if (isMissingColumn(error)) {
          return {
            error: `Subcategories need a database update — run ${MIGRATION_FILE} in Supabase.`,
          };
        }
        return { error: error.message };
      }

      setProductCategories((prev) => persistCategories(prev));
      setProducts((prev) => {
        const next = prev.map((p) =>
          p.productCategory === oldName
            ? { ...p, productCategory: trimmed }
            : p,
        );
        saveLocalProducts(next);
        return next;
      });

      return {};
    },
    [productCategories, validateParent],
  );

  const deleteProductCategory = useCallback(
    async (id) => {
      const cat = productCategories.find((c) => c.id === id);
      if (!cat) return {};
      const hasProducts = products.some((p) => p.productCategory === cat.name);
      if (hasProducts) return { error: "Cannot delete: category has products" };
      const hasSubcategories = productCategories.some((c) => c.parentId === id);
      if (hasSubcategories) {
        return { error: "Cannot delete: delete or move its subcategories first" };
      }

      setProductCategories((prev) => prev.filter((c) => c.id !== id));
      catIdByName = null;

      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Supabase delete category failed:", error);
        setProductCategories((prev) => [...prev, cat]);
        return { error: error.message };
      }

      setProductCategories((prev) => persistCategories(prev));
      return {};
    },
    [productCategories, products],
  );

  // ---- Store settings: delivery fee + store-wide discount (admin) ----
  const refreshStoreSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return;
    const next = settingsFromRow(data);
    setStoreSettings(next);
    saveJson(localStorage, SETTINGS_KEY, next);
  }, []);

  const updateStoreSettings = useCallback(
    async (changes) => {
      const next = { ...storeSettings, ...changes };
      // .select() makes an RLS-blocked update detectable: it is not an
      // error, it just matches no row.
      const { data, error } = await supabase
        .from("store_settings")
        .update({ ...settingsToRow(next), updated_at: new Date().toISOString() })
        .eq("id", 1)
        .select();

      if (error) {
        console.error("updateStoreSettings failed", error);
        if (isMissingTable(error) || isMissingColumn(error)) {
          return {
            error: `Store settings need a database update — run ${MIGRATION_FILE} in Supabase.`,
          };
        }
        return { error: error.message || "Failed to save settings" };
      }
      if (!data || data.length === 0) {
        return {
          error:
            "The database rejected this change. Only a superadmin can change prices — or run the migration to create the settings row.",
        };
      }

      const saved = settingsFromRow(data[0]);
      setStoreSettings(saved);
      saveJson(localStorage, SETTINGS_KEY, saved);
      return { settings: saved };
    },
    [storeSettings],
  );

  // ---- Society CRUD (Supabase) ----
  const addSociety = useCallback(
    async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "Society name cannot be empty" };
      const duplicate = societies.some(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Society already exists" };

      const tempId = crypto.randomUUID();
      const tempSociety = {
        id: tempId,
        name: trimmed,
        createdAt: new Date().toISOString(),
      };
      setSocieties((prev) =>
        [...prev, tempSociety].sort((a, b) => a.name.localeCompare(b.name)),
      );

      const { data, error } = await supabase
        .from("societies")
        .insert({ name: trimmed })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert society failed:", error);
        setSocieties((prev) => prev.filter((s) => s.id !== tempId));
        return { error: error.message || "Failed to save society" };
      }

      if (!data) {
        console.error("Insert society returned no row (likely RLS)");
        setSocieties((prev) => prev.filter((s) => s.id !== tempId));
        return {
          error:
            "The database rejected this society. Check its RLS policy for your role.",
        };
      }

      const dbSociety = {
        id: data.id,
        name: data.name,
        createdAt: data.created_at,
      };
      setSocieties((prev) =>
        prev.map((s) => (s.id === tempId ? dbSociety : s)),
      );
      return { society: dbSociety };
    },
    [societies],
  );

  const editSociety = useCallback(
    async (id, newName) => {
      const trimmed = newName.trim();
      if (!trimmed) return { error: "Society name cannot be empty" };
      const duplicate = societies.some(
        (s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Society already exists" };

      const oldName = societies.find((s) => s.id === id)?.name;
      if (!oldName) return { error: "Society not found" };

      setSocieties((prev) =>
        prev
          .map((s) => (s.id === id ? { ...s, name: trimmed } : s))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      const { error } = await supabase
        .from("societies")
        .update({ name: trimmed })
        .eq("id", id);

      if (error) {
        console.error("Supabase update society failed:", error);
        setSocieties((prev) =>
          prev
            .map((s) => (s.id === id ? { ...s, name: oldName } : s))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        return { error: error.message };
      }

      return {};
    },
    [societies],
  );

  const deleteSociety = useCallback(
    async (id) => {
      const society = societies.find((s) => s.id === id);
      if (!society) return {};

      setSocieties((prev) => prev.filter((s) => s.id !== id));

      const { error } = await supabase.from("societies").delete().eq("id", id);

      if (error) {
        console.error("Supabase delete society failed:", error);
        setSocieties((prev) =>
          [...prev, society].sort((a, b) => a.name.localeCompare(b.name)),
        );
        return { error: error.message };
      }

      return {};
    },
    [societies],
  );

  // ---- Derived values ----
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const finalPrice =
          item.salePrice && item.salePrice > 0 ? item.salePrice : item.price;
        return sum + finalPrice * item.quantity;
      }, 0),
    [cart],
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read),
    [notifications],
  );

  // ---- Context value ----
  const value = useMemo(
    () => ({
      cart,
      wishlist,
      orders,
      notifications,
      products,
      shopProducts,
      categories,
      productCategories,
      productCategoriesLoading,
      productsLoading,
      ordersLoading,
      notifsLoading,
      cartCount,
      cartTotal,
      unreadNotifications,
      directOrderText,
      setDirectOrderText,
      storeSettings,
      refreshStoreSettings,
      updateStoreSettings,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      isInWishlist,
      placeOrder,
      updateOrderStatus,
      deleteOrders,
      cancelUserOrder,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      clearAllNotifications,
      loadRecentOrders,
      getProductsByCategory,
      getProductById,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      addProductCategory,
      editProductCategory,
      deleteProductCategory,
      societies,
      addSociety,
      editSociety,
      deleteSociety,
      toast,
      setToast,
    }),
    [
      cart,
      wishlist,
      orders,
      notifications,
      products,
      shopProducts,
      categories,
      productCategories,
      productCategoriesLoading,
      productsLoading,
      ordersLoading,
      notifsLoading,
      cartCount,
      cartTotal,
      unreadNotifications,
      directOrderText,
      setDirectOrderText,
      storeSettings,
      refreshStoreSettings,
      updateStoreSettings,
      toast,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      toggleWishlist,
      isInWishlist,
      placeOrder,
      updateOrderStatus,
      deleteOrders,
      cancelUserOrder,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      clearAllNotifications,
      loadRecentOrders,
      getProductsByCategory,
      getProductById,
      addProduct,
      updateProduct,
      deleteProduct,
      toggleProductStock,
      addProductCategory,
      editProductCategory,
      deleteProductCategory,
      societies,
      addSociety,
      editSociety,
      deleteSociety,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

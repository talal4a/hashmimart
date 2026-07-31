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
  loadCategories as loadLocalCategories,
  saveCategories as saveLocalCategories,
} from "../data/categoryStore";

const CART_KEY = "hashmi-network-cart";
const SESSION_KEY = "hashmi-session";
const PRODUCTS_KEY = "hashmi-network-products";
// Feature flag, not yet wired to a reader. Kept deliberately so the
// retention work has a single switch to turn on.
// eslint-disable-next-line no-unused-vars
const ENABLE_ORDER_RETENTION = false;

const StoreContext = createContext(null);

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage data may be absent or corrupted
  }
  return [];
}

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
    price: Number(p.price),
    salePrice: p.sale_price != null ? Number(p.sale_price) : null,
    unit: p.unit,
    image: p.image,
    imageUrl: p.image_url,
    description: p.description,
    inStock: p.in_stock,
    wholesaleOptions: p.wholesale_options || undefined,
  };
}

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(loadCart);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [products, setProducts] = useState(loadLocalProducts);
  const [categories, setCategories] = useState(loadLocalCategories);
  const [productCategories, setProductCategories] = useState([]);
  const [voiceOrderAudio, setVoiceOrderAudio] = useState(null);
  const [voiceOrderAddress, setVoiceOrderAddress] = useState("");
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
          const mapped = data.map((m) => ({ id: m.id, name: m.slug }));
          setCategories(mapped);
          saveLocalCategories(mapped);
          modeIdBySlug = Object.fromEntries(data.map((m) => [m.slug, m.id]));
        }
      } catch {
        // fetch failed after retries, using cached/default categories
      }
    }

    async function loadProductCats() {
      const { data } = await supabase
        .from("product_categories")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (data) {
        setProductCategories(data.map((c) => ({ id: c.id, name: c.name })));
        catIdByName = Object.fromEntries(data.map((c) => [c.name, c.id]));
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
            const wishlistData = wishProducts.map((p) => {
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
          itemsByOrder[item.order_id].push({
            productId: item.product_id,
            name: item.product_name,
            price: Number(item.product_price),
            unit: item.product_unit,
            image: item.product_image,
            imageUrl: item.product_image_url,
            category: item.shopping_mode,
            productCategory: item.product_category,
            quantity: item.quantity,
          });
        }
        setOrders(
          ordersData.map((o) => ({
            id: o.display_id,
            dbId: o.id,
            userId: o.user_id,
            status: o.status,
            createdAt: o.created_at,
            customer: {
              fullName: o.customer_name,
              phone: o.customer_phone,
              address: o.customer_address,
            },
            items: itemsByOrder[o.id] || [],
            total: Number(o.total),
            paymentMethod: o.payment_method,
            estimatedDelivery: o.estimated_delivery_minutes,
            isVoiceOrder: o.is_voice_order || false,
            audioUrl: o.audio_url || null,
          })),
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
            read: n.is_read,
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
                    read: row.is_read,
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

  // ---- Orders (Supabase orders + order_items) ----
  const placeOrder = useCallback(
    async (
      customerInfo,
      { isVoiceOrder = false, voiceAudioBlob = null } = {},
    ) => {
      const displayId = createOrderId();
      const orderTotal = isVoiceOrder
        ? 0
        : cart.reduce((sum, item) => {
            const finalPrice =
              item.salePrice && item.salePrice > 0
                ? item.salePrice
                : item.price;
            return sum + finalPrice * item.quantity;
          }, 0);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in before placing an order.");

      let audioUrl = null;
      if (isVoiceOrder && voiceAudioBlob) {
        // Order notes are kept at the bucket root. The 'search/' prefix in this
        // same bucket is disposable and gets deleted by /api/voice-search —
        // never store an order recording under it.
        const fileName = `${crypto.randomUUID()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("voice-notes")
          .upload(fileName, voiceAudioBlob, {
            contentType: "audio/webm",
            cacheControl: "3600",
          });

        if (uploadError) {
          console.error("Failed to upload voice note", uploadError);
          throw new Error("Failed to upload voice note.");
        }

        const { data: publicUrlData } = supabase.storage
          .from("voice-notes")
          .getPublicUrl(fileName);

        audioUrl = publicUrlData?.publicUrl || null;
      }

      const orderPayload = {
        display_id: displayId,
        customer_name: customerInfo.fullName,
        customer_phone: customerInfo.phone,
        customer_email: user.email,
        user_id: user.id,
        customer_city: customerInfo.city || "Lahore",
        customer_address: customerInfo.address || null,
        total: orderTotal,
        payment_method: customerInfo.paymentMethod || "Cash on Delivery",
        is_voice_order: isVoiceOrder,
        audio_url: audioUrl,
      };

      const { data: orderRow, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) {
        console.error("placeOrder: failed to create order", orderError);
        throw new Error(orderError.message);
      }

      if (!isVoiceOrder) {
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
          message: `New order #${displayId} from ${customerInfo.fullName} — Rs ${orderTotal}`,
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
        items: isVoiceOrder ? [] : cart.map((item) => ({ ...item })),
        total: orderTotal,
        paymentMethod: customerInfo.paymentMethod || "Cash on Delivery",
        estimatedDelivery: null,
        isVoiceOrder,
        audioUrl,
      };

      setOrders((prev) => [order, ...prev]);
      if (!isVoiceOrder) {
        setCart([]);
        saveCart([]);
      } else {
        setVoiceOrderAudio(null);
        setVoiceOrderAddress("");
      }

      return order;
    },
    [cart],
  );

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    if (!["pending", "delivered", "cancelled"].includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const { data: orderRow } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("display_id", orderId)
      .select()
      .single();

    if (!orderRow) {
      console.error("updateOrderStatus: order not found");
      throw new Error("Order not found");
    }

    if (newStatus === "delivered" || newStatus === "cancelled") {
      const message =
        newStatus === "delivered"
          ? `Your order #${orderRow.display_id} has been delivered.`
          : `Your order #${orderRow.display_id} was cancelled.`;

      const { data: notifRow, error: notifErr } = await supabase
        .from("notifications")
        .insert({
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
                  read: notifRow.is_read,
                  createdAt: notifRow.created_at,
                },
                ...prev,
              ],
        );
      }

      // Staff copy, so the team has a record of the outcome too.
      const { error: staffErr } = await supabase.from("notifications").insert({
        order_id: orderRow.id,
        audience: "staff",
        message:
          newStatus === "delivered"
            ? `Order #${orderRow.display_id} was delivered.`
            : `Order #${orderRow.display_id} was cancelled.`,
        is_read: false,
      });
      if (staffErr) {
        console.error("updateOrderStatus: staff notification failed", staffErr);
      }
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
  }, []);

  const deleteOrders = useCallback(async (dbIds) => {
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
    const hiddenIds = new Set(hidden.map((o) => o.display_id));
    setOrders((prev) => prev.filter((o) => !hiddenIds.has(o.id)));
    return hidden.length;
  }, []);

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
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
    return {};
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return {};

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);

    if (error) {
      console.error("markAllNotificationsRead failed", error);
      return { error: error.message };
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
        itemsByOrder[item.order_id].push({
          productId: item.product_id,
          name: item.product_name,
          price: Number(item.product_price),
          unit: item.product_unit,
          image: item.product_image,
          imageUrl: item.product_image_url,
          category: item.shopping_mode,
          productCategory: item.product_category,
          quantity: item.quantity,
        });
      }
      return ordersData.map((o) => ({
        id: o.display_id,
        dbId: o.id,
        userId: o.user_id,
        status: o.status,
        createdAt: o.created_at,
        customer: {
          fullName: o.customer_name,
          phone: o.customer_phone,
          address: o.customer_address,
        },
        items: itemsByOrder[o.id] || [],
        total: Number(o.total),
        paymentMethod: o.payment_method,
        estimatedDelivery: o.estimated_delivery_minutes,
        isVoiceOrder: o.is_voice_order || false,
        audioUrl: o.audio_url || null,
      }));
    } catch (error) {
      console.error("loadRecentOrders failed", error);
      return [];
    }
  }, []);

  // ---- Product helpers ----
  const getProductsByCategory = useCallback(
    (category) => products.filter((p) => p.category === category && p.inStock),
    [products],
  );

  const getProductById = useCallback(
    (id) => products.find((p) => p.id === id),
    [products],
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
    if (updates.wholesaleOptions !== undefined) {
      dbUpdates.wholesale_options = updates.wholesaleOptions || null;
    }

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

    setProducts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
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
  const addProductCategory = useCallback(
    async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return { error: "Category name cannot be empty" };
      const duplicate = productCategories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Category already exists" };

      const tempId = crypto.randomUUID();
      const tempCat = {
        id: tempId,
        name: trimmed,
        createdAt: new Date().toISOString(),
      };
      setProductCategories((prev) => [...prev, tempCat]);

      const { data, error } = await supabase
        .from("product_categories")
        .insert({ name: trimmed })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert category failed:", error);
        // Roll back the optimistic row. Keeping it would leave a category
        // with a fake UUID that products can't actually be filed under.
        setProductCategories((prev) => prev.filter((c) => c.id !== tempId));
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
      const dbCat = {
        id: data.id,
        name: data.name,
        createdAt: data.created_at,
      };
      setProductCategories((prev) =>
        prev.map((c) => (c.id === tempId ? dbCat : c)),
      );
      catIdByName = null;
      return { category: dbCat };
    },
    [productCategories],
  );

  const editProductCategory = useCallback(
    async (id, newName) => {
      const trimmed = newName.trim();
      if (!trimmed) return { error: "Category name cannot be empty" };
      const duplicate = productCategories.some(
        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) return { error: "Category already exists" };

      const oldName = productCategories.find((c) => c.id === id)?.name;
      if (!oldName) return { error: "Category not found" };

      setProductCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
      );
      catIdByName = null;

      const { error } = await supabase
        .from("product_categories")
        .update({ name: trimmed })
        .eq("id", id);

      if (error) {
        console.error("Supabase update category failed:", error);
        setProductCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: oldName } : c)),
        );
        return { error: error.message };
      }

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
    [productCategories],
  );

  const deleteProductCategory = useCallback(
    async (id) => {
      const cat = productCategories.find((c) => c.id === id);
      if (!cat) return {};
      const hasProducts = products.some((p) => p.productCategory === cat.name);
      if (hasProducts) return { error: "Cannot delete: category has products" };

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

      return {};
    },
    [productCategories, products],
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
    () => notifications.filter((n) => !n.read),
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
      categories,
      productCategories,
      productsLoading,
      ordersLoading,
      notifsLoading,
      cartCount,
      cartTotal,
      unreadNotifications,
      voiceOrderAudio,
      setVoiceOrderAudio,
      voiceOrderAddress,
      setVoiceOrderAddress,
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
      toast,
      setToast,
    }),
    [
      cart,
      wishlist,
      orders,
      notifications,
      products,
      categories,
      productCategories,
      productsLoading,
      ordersLoading,
      notifsLoading,
      cartCount,
      cartTotal,
      unreadNotifications,
      voiceOrderAudio,
      setVoiceOrderAudio,
      voiceOrderAddress,
      setVoiceOrderAddress,
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

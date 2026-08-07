import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { isStaff as roleIsStaff, ROLES } from "../lib/permissions";
const AuthContext = createContext(null);
async function fetchProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async (response) => {
      const session = response?.data?.session ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        const p = await fetchProfile(nextUser.id);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password, fullName, phone) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    if (error) throw error;

    // Brand-new account → show the one-time Direct Order spotlight on the
    // home page the first time they land there (immediately when the session
    // is returned, or on first login after email confirmation). The flag is
    // consumed the moment the spotlight is dismissed, so it only ever shows
    // once per browser.
    try {
      localStorage.setItem("hashmi-direct-order-spotlight", "1");
    } catch {
      // Storage unavailable — the spotlight simply won't show. Not fatal.
    }

    return data;
  }, []);

  const logIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Check if email is verified
    if (data.user && !data.user.email_confirmed_at) {
      throw new Error("Please confirm your email address before logging in.");
    }

    // Sync anonymous wishlist items to user account on login
    try {
      const sessionId = localStorage.getItem("session_id");
      if (sessionId && data.user) {
        const { data: wishlistItems } = await supabase
          .from("wishlist_items")
          .select("product_id")
          .eq("session_id", sessionId);

        if (wishlistItems && wishlistItems.length > 0) {
          // Migrate session wishlist to user wishlist
          for (const item of wishlistItems) {
            await supabase.from("wishlist_items").upsert({
              user_id: data.user.id,
              product_id: item.product_id,
              session_id: null,
            });
          }
          // Clear session wishlist after migration
          await supabase
            .from("wishlist_items")
            .delete()
            .eq("session_id", sessionId);
        }
      }
    } catch (e) {
      console.warn("Failed to sync wishlist on login:", e);
    }

    return data;
  }, []);

  const logOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear localStorage data on logout to prevent data leakage
    try {
      localStorage.removeItem("hashmi-wishlist");
      localStorage.removeItem("hashmi-network-store");
      localStorage.removeItem("cart");
      localStorage.removeItem("products");
      localStorage.removeItem("session_id");
    } catch (e) {
      console.warn("Failed to clear localStorage on logout:", e);
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    // Set VITE_BASE_URL (e.g. https://hashminetwork.com) in the Vercel
    // environment so the email link always points at the live domain — never
    // at a developer's localhost.
    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const value = {
    user,
    profile,
    session,
    loading,
    isAuthenticated: !!user && !!profile,
    isSuperadmin: profile?.role === "superadmin",
    isOrdermanager: profile?.role === ROLES.ORDERMANAGER,
    isStaff: roleIsStaff(profile?.role),
    signUp,
    logIn,
    logOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

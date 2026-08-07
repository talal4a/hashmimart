import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ChatProvider } from "./context/ChatContext";
import Layout from "./components/Layout";
import SplashScreen from "./components/SplashScreen";
import PageLoader from "./components/PageLoader";
import CategoriesPage from "./pages/CategoriesPage";
import ProductsPage, { getProductsTitle } from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import WishlistPage from "./pages/WishlistPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderStatusPage from "./pages/OrderStatusPage";
import NotificationsPage from "./pages/NotificationsPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MyOrdersPage from "./pages/MyOrdersPage";
import MyOrderDetailPage from "./pages/MyOrderDetailPage";
// /support is the Groq-powered AI assistant. The human agent chat lives on in
// pages/SupportChatPage.jsx + ChatPage.jsx and is still served by the admin
// panel — it is only unrouted for customers, not removed.
import AiSupportChatPage from "./pages/AiSupportChatPage";
import DirectOrderPage from "./pages/DirectOrderPage";
import { isStaff as roleIsStaff, landingPathForRole } from "./lib/permissions";

function ProductsRoute() {
  const { category } = useParams();
  return (
    <Layout title={getProductsTitle(category)} showBack backTo="/">
      <ProductsPage key={category ?? "all"} />
    </Layout>
  );
}

function ProtectedRoute({ role, staff, children }) {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <PageLoader />;
  if (!user || !profile) {
    const redirect = loc.pathname + loc.search;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }
  if (role && profile.role !== role) return <Navigate to="/" replace />;
  // Any staff role (superadmin or ordermanager) may enter; per-section access is
  // enforced inside AdminDashboard so a disallowed section shows a 403 rather
  // than silently bouncing to the storefront.
  if (staff && !roleIsStaff(profile.role)) return <Navigate to="/" replace />;

  return children;
}

function GuestRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (user && profile) {
    return <Navigate to={landingPathForRole(profile.role)} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignUpPage />
          </GuestRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        }
      />
      {/* Landing page for the email reset link. Not a GuestRoute: the link
          signs the user in with a recovery session, so this route must stay
          accessible once that session exists. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <Layout>
            <CategoriesPage />
          </Layout>
        }
      />
      <Route path="/products" element={<ProductsRoute />} />
      <Route path="/products/:category" element={<ProductsRoute />} />
      <Route
        path="/product/:productId"
        element={
          <Layout title="Product Details" showBack backTo="/">
            <ProductDetailPage />
          </Layout>
        }
      />
      <Route
        path="/cart"
        element={
          <Layout title="Cart" showBack backTo="/">
            <CartPage />
          </Layout>
        }
      />
      <Route
        path="/wishlist"
        element={
          <Layout title="Wishlist" showBack backTo="/">
            <WishlistPage />
          </Layout>
        }
      />
      <Route
        path="/checkout"
        element={
          <Layout title="Checkout" showBack backTo="/cart">
            <CheckoutPage />
          </Layout>
        }
      />
      <Route
        path="/order/:orderId"
        element={
          <Layout title="Order Status" showBack backTo="/">
            <OrderStatusPage />
          </Layout>
        }
      />
      <Route
        path="/notifications"
        element={
          <Layout title="Notifications" showBack backTo="/">
            <NotificationsPage />
          </Layout>
        }
      />
      <Route
        path="/my-orders"
        element={
          <ProtectedRoute>
            <Layout title="My Orders" showBack backTo="/">
              <MyOrdersPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-orders/:orderId"
        element={
          <ProtectedRoute>
            <Layout title="Order Detail" showBack backTo="/my-orders">
              <MyOrderDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <Layout title="Support Chat" showBack backTo="/">
              <AiSupportChatPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/direct-order"
        element={
          <ProtectedRoute>
            <Layout title="Direct Order" showBack backTo="/">
              <DirectOrderPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute staff>
            <AdminIndexRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/:section"
        element={
          <ProtectedRoute staff>
            <Layout>
              <AdminDashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Bare /admin has no section of its own — send each role to its landing
// section (superadmin & ordermanager both land on Orders).
function AdminIndexRedirect() {
  const { profile } = useAuth();
  return <Navigate to={landingPathForRole(profile?.role)} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SplashScreen />
      <StoreProvider>
        <BrowserRouter>
          <AuthProvider>
            <ChatProvider>
              <AppRoutes />
            </ChatProvider>
          </AuthProvider>
        </BrowserRouter>
      </StoreProvider>
    </ThemeProvider>
  );
}

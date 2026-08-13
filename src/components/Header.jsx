import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import {
  IconBack,
  IconBell,
  IconCart,
  IconHeart,
  IconMenu,
  IconX,
} from "./Icons";
import Logo from "./Logo";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { landingPathForRole } from "../lib/permissions";

export default function Header({ title, showBack = false, backTo = "/" }) {
  const { cartCount, unreadNotifications, wishlist } = useStore();
  const { isAuthenticated, isStaff, profile, logOut } = useAuth();
  const { unreadCount } = useChat();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const menuRef = useRef(null);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    if (menuOpen || profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, profileDropdownOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logOut();
  };

  if (isAdmin) {
    return (
      <header className="header header--admin">
        <div className="header__brand">
          <Logo className="header-logo" />
          <div className="header__brand-text">
            <span className="header__subtitle">Admin Dashboard</span>
          </div>
        </div>
        <Link to="/" className="header__link header__link--desktop">
          Customer App
        </Link>
        <button
          type="button"
          className="header__icon-btn header__menu-btn"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
        </button>
        <div
          ref={menuRef}
          className={`header__dropdown ${menuOpen ? "header__dropdown--open" : ""}`}
        >
          <Link
            to="/"
            className="header__dropdown-link"
            onClick={() => setMenuOpen(false)}
          >
            Customer App
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="header">
      <div className="header__left">
        {!showBack && <Logo className="header-logo" />}
        {showBack && (
          <Link to={backTo} className="header__icon-btn" aria-label="Go back">
            <IconBack />
          </Link>
        )}
        <div className="header__titles">
          {title && <h1 className="header__page-title">{title}</h1>}
        </div>
      </div>

      <nav className="header__nav" aria-label="Main navigation">
        <Link
          to="/notifications"
          className="header__icon-btn"
          aria-label="Notifications"
        >
          <IconBell />
          {unreadNotifications.length > 0 && (
            <span className="badge">{unreadNotifications.length}</span>
          )}
        </Link>
        <Link to="/wishlist" className="header__icon-btn" aria-label="Wishlist">
          <IconHeart />
          {wishlist.length > 0 && (
            <span className="badge">{wishlist.length}</span>
          )}
        </Link>
        <Link to="/cart" className="header__icon-btn" aria-label="Cart">
          <IconCart size={20} />
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </Link>
        {isAuthenticated && (
          <div ref={profileDropdownRef} className="profile-dropdown-container">
            <button
              type="button"
              className="header__icon-btn profile-btn"
              aria-label="Profile"
              onClick={() => setProfileDropdownOpen((v) => !v)}
            >
              <User size={20} />
            </button>
            {profileDropdownOpen && (
              <div className="profile-dropdown">
                {isStaff && (
                  <Link
                    to={landingPathForRole(profile?.role)}
                    className="profile-dropdown-item"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
                <Link
                  to="/my-orders"
                  className="profile-dropdown-item"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  My Orders
                </Link>
                <Link
                  to="/direct-order"
                  className="profile-dropdown-item"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Direct Orders
                </Link>
                <Link
                  to="/privacy-policy"
                  className="profile-dropdown-item"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms"
                  className="profile-dropdown-item"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Terms & Conditions
                </Link>
                <Link
                  to="/delete-account"
                  className="profile-dropdown-item profile-dropdown-item--logout"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  Delete Account
                </Link>
                <button
                  type="button"
                  className="profile-dropdown-item profile-dropdown-item--logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="header__icon-btn header__menu-btn"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <IconX size={20} /> : <IconMenu size={20} />}
        </button>

        <div
          ref={menuRef}
          className={`header__dropdown ${menuOpen ? "header__dropdown--open" : ""}`}
        >
          {isAuthenticated ? (
            <>
              <Link to="/support" className="header__dropdown-link">
                Support
                {unreadCount > 0 && (
                  <span className="header__dropdown-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="header__dropdown-link">
                Login
              </Link>
              <Link to="/signup" className="header__dropdown-link">
                Sign Up
              </Link>
            </>
          )}
          <Link
            to="/privacy-policy"
            className="header__dropdown-link"
            onClick={() => setMenuOpen(false)}
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="header__dropdown-link"
            onClick={() => setMenuOpen(false)}
          >
            Terms & Conditions
          </Link>
        </div>

        <div className="header__links-desktop">
          {isAuthenticated ? (
            <>
              <Link to="/support" className="header__link">
                Support
                {unreadCount > 0 && (
                  <span className="header__link-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="header__link">
                Login
              </Link>
              <Link to="/signup" className="header__link">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

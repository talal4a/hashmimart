import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatPrice } from "../data/products";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, cartTotal, placeOrder, voiceOrderAudio, voiceOrderAddress } =
    useStore();
  const { profile, user } = useAuth();

  // Initialize form with user data
  const [form, setForm] = useState(() => ({
    fullName: profile?.full_name || user?.user_metadata?.full_name || "",
    phone: profile?.phone || user?.user_metadata?.phone || "",
    email: user?.email || "",
    address: voiceOrderAddress || "",
  }));

  const [paymentMethod, setPaymentMethod] = useState("Cash on Delivery");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (cart.length === 0 && !voiceOrderAudio) navigate("/cart");
  }, [cart.length, voiceOrderAudio, navigate]);

  if (cart.length === 0 && !voiceOrderAudio) return null;

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required";
    if (!form.phone.trim()) next.phone = "Phone number is required";
    else if (!/^03\d{9}$/.test(form.phone.replace(/\s/g, ""))) {
      next.phone = "Enter a valid Pakistani mobile (03XX XXXXXXX)";
    }
    if (!form.address.trim()) next.address = "Delivery address is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const isVoiceOrder = !!voiceOrderAudio;
      const order = await placeOrder(
        {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          city: "Lahore",
          address: form.address.trim(),
          paymentMethod,
        },
        {
          isVoiceOrder,
          voiceAudioBlob: voiceOrderAudio,
        },
      );
      navigate(`/order/${order.id}`);
    } catch (err) {
      console.error("CheckoutPage: placeOrder failed", err);
      setSubmitError(err.message || "Failed to place order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="add-item-page">
      {/* Page Header */}
      <div className="add-item-header">
        <div className="add-item-title-area">
          <div className="add-item-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h1 className="add-item-title">Checkout</h1>
          <p className="add-item-subtitle">Complete your order details</p>
        </div>
      </div>

      <div className="add-item-content">
        {/* Left Column - Form */}
        <div className="add-item-form">
          {/* Section 01: Delivery Details */}
          <div className="add-item-section">
            <div className="add-item-section-badge">01</div>
            <h3 className="add-item-section-title">Delivery Details</h3>

            {submitError && (
              <p
                className="add-item-error-text"
                style={{ color: "#ef4444", marginBottom: "1rem" }}
              >
                {submitError}
              </p>
            )}

            <div className="add-item-field">
              <label className="add-item-label">Full Name</label>
              <input
                id="fullName"
                type="text"
                className="add-item-input"
                placeholder="Enter your full name"
                value={form.fullName}
                onChange={update("fullName")}
                autoComplete="name"
              />
              {errors.fullName && (
                <span
                  className="add-item-error-text"
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {errors.fullName}
                </span>
              )}
            </div>

            <div className="add-item-field">
              <label className="add-item-label">Phone Number</label>
              <input
                id="phone"
                type="tel"
                className="add-item-input"
                placeholder="03XX XXXXXXX"
                value={form.phone}
                onChange={update("phone")}
                autoComplete="tel"
              />
              {errors.phone && (
                <span
                  className="add-item-error-text"
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {errors.phone}
                </span>
              )}
            </div>

            <div className="add-item-field">
              <label className="add-item-label">Email (optional)</label>
              <input
                id="email"
                type="email"
                className="add-item-input"
                placeholder="for order updates"
                value={form.email}
                onChange={update("email")}
                autoComplete="email"
              />
            </div>

            <div className="add-item-field">
              <label className="add-item-label">City</label>
              <input
                type="text"
                className="add-item-input"
                value="Lahore"
                readOnly
                disabled
                style={{ backgroundColor: "#f1f5f9" }}
              />
            </div>

            <div className="add-item-field">
              <label className="add-item-label">Delivery Address</label>
              <textarea
                id="address"
                className="add-item-input"
                rows={3}
                placeholder="House No, Street, Block, Area, Landmark"
                value={form.address}
                onChange={update("address")}
              />
              {errors.address && (
                <span
                  className="add-item-error-text"
                  style={{
                    color: "#ef4444",
                    fontSize: "0.85rem",
                    marginTop: "0.25rem",
                  }}
                >
                  {errors.address}
                </span>
              )}
            </div>
          </div>

          {/* Section 02: Payment Method */}
          <div className="add-item-section">
            <div className="add-item-section-badge">02</div>
            <h3 className="add-item-section-title">Payment Method</h3>

            <div className="add-item-grid" style={{ marginTop: "1rem" }}>
              <label
                className={`add-item-payment-card ${paymentMethod === "Cash on Delivery" ? "add-item-payment-card--active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                  border: `2px solid ${paymentMethod === "Cash on Delivery" ? "#06b6d4" : "#e2e8f0"}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  background: "white",
                  transition: "all 0.2s ease",
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  value="Cash on Delivery"
                  checked={paymentMethod === "Cash on Delivery"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: "20px",
                    height: "20px",
                    accentColor: "#06b6d4",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: "600", fontSize: "1rem" }}>
                    Cash on Delivery
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Pay with cash when your order arrives
                  </span>
                </div>
              </label>

              <label
                className={`add-item-payment-card ${paymentMethod === "JazzCash" ? "add-item-payment-card--active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem",
                  border: `2px solid ${paymentMethod === "JazzCash" ? "#ed1c24" : "#e2e8f0"}`,
                  borderRadius: "12px",
                  cursor: "pointer",
                  background: "white",
                  transition: "all 0.2s ease",
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  value="JazzCash"
                  checked={paymentMethod === "JazzCash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: "20px",
                    height: "20px",
                    accentColor: "#ed1c24",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "1rem",
                      color: "#ed1c24",
                    }}
                  >
                    JazzCash
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                    Pay securely via JazzCash transfer
                  </span>
                </div>
              </label>
            </div>

            {paymentMethod === "JazzCash" && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "1.25rem",
                  background: "rgba(237, 28, 36, 0.05)",
                  border: "1px solid rgba(237, 28, 36, 0.2)",
                  borderRadius: "12px",
                }}
              >
                <h4
                  style={{
                    color: "#ed1c24",
                    marginBottom: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: "700",
                  }}
                >
                  JazzCash Payment Instructions
                </h4>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "#64748b",
                    lineHeight: "1.5",
                    marginBottom: "1rem",
                  }}
                >
                  Please transfer your total order amount to the following
                  JazzCash account before placing the order.
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "white",
                    padding: "1rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "#64748b",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Account Number
                    </span>
                    <strong
                      style={{ fontSize: "1.2rem", letterSpacing: "1px" }}
                    >
                      0308 7696420
                    </strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "#64748b",
                        marginBottom: "0.2rem",
                      }}
                    >
                      Account Title
                    </span>
                    <strong>Hashmi Mart</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="add-item-preview">
          <div className="add-item-preview-card">
            <div className="add-item-preview-header">
              <h4>Order Summary</h4>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>

            <div className="add-item-preview-content" style={{ flex: 1 }}>
              {voiceOrderAudio ? (
                <div style={{ textAlign: "center", padding: "1rem" }}>
                  <p
                    style={{
                      color: "#64748b",
                      marginBottom: "1rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    Your order will be fulfilled based on this voice note.
                  </p>
                  <audio
                    controls
                    src={URL.createObjectURL(voiceOrderAudio)}
                    style={{
                      width: "100%",
                      height: "40px",
                      borderRadius: "8px",
                    }}
                  />
                  <div
                    style={{
                      marginTop: "1.5rem",
                      padding: "1rem",
                      background: "#f8fafc",
                      borderRadius: "8px",
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: "0.9rem" }}>
                      Total
                    </span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "1.5rem",
                        color: "#06b6d4",
                        marginTop: "0.25rem",
                      }}
                    >
                      To be decided
                    </strong>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      maxHeight: "300px",
                      overflowY: "auto",
                      marginBottom: "1rem",
                    }}
                  >
                    {cart.map((item) => (
                      <div
                        key={item.productId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.75rem 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontWeight: "500",
                              fontSize: "0.95rem",
                              marginBottom: "0.25rem",
                            }}
                          >
                            {item.name}
                          </p>
                          <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                            Qty: {item.quantity} × {formatPrice(item.price)}
                          </p>
                        </div>
                        <strong style={{ fontSize: "1rem", color: "#06b6d4" }}>
                          {formatPrice(item.price * item.quantity)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "1rem",
                      background:
                        "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
                      borderRadius: "8px",
                      border: "1px solid #06b6d4",
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: "0.9rem" }}>
                      Total
                    </span>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "1.8rem",
                        color: "#06b6d4",
                        marginTop: "0.25rem",
                      }}
                    >
                      {formatPrice(cartTotal)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div className="add-item-preview-actions">
              <button
                type="submit"
                className="add-item-submit-btn"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Placing Order..." : "Place Order"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="add-item-cancel-link"
              >
                Back to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

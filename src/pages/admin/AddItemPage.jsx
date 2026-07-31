import { useState } from "react";
import { IconBack, IconEye } from "../../components/Icons";
import { uploadProductImage, validateImageFile } from "../../lib/uploadImage";

export default function AddItemPage({
  product,
  onSave,
  onCancel,
  productCategories,
}) {
  const isEditing = !!product;

  // Form state - initialize from product when editing
  const [formData, setFormData] = useState(() => ({
    name: product?.name || "",
    category: product?.category || "retail",
    productCategory: product?.productCategory || "",
    price: product?.price || "",
    stock: product?.stock || 0,
    imageUrl: product?.imageUrl || "",
    unit: product?.unit || "piece",
  }));

  const [searchQuery, setSearchQuery] = useState("");
  const [photoTab, setPhotoTab] = useState("find"); // 'find' or 'upload'
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const isFormValid = formData.name && formData.category && formData.price;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid && onSave) {
      onSave(formData);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadError("");
      setUploadingImage(true);
      validateImageFile(file);
      const imageUrl = await uploadProductImage(file);
      setFormData((prev) => ({ ...prev, imageUrl: imageUrl }));
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      setSearchError("");
      const apiKey = import.meta.env.VITE_UNSPLASH_API_KEY;
      if (!apiKey) {
        throw new Error(
          "API key not found. Please check your .env.local file.",
        );
      }
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=12`,
        {
          headers: {
            Authorization: `Client-ID ${apiKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to search images. Check your API key.");
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectImage = (imageUrl) => {
    setFormData((prev) => ({ ...prev, imageUrl: imageUrl }));
  };

  return (
    <div className="add-item-page">
      {/* Page Header */}
      <div className="add-item-header">
        <button onClick={handleCancel} className="add-item-back">
          <IconBack size={16} />
          Back to items
        </button>
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </div>
          <div className="add-item-title-text">
            <h1 className="add-item-title">
              {isEditing ? "Edit Item" : "Create Item"}
            </h1>
            <p className="add-item-subtitle">
              {isEditing
                ? "Update product details"
                : "Add a new product to your menu"}
            </p>
          </div>
        </div>
      </div>

      <div className="add-item-content">
        {/* Left Column - Form */}
        <div className="add-item-form">
          {/* Section 01: Basic Information */}
          <div className="add-item-section">
            <div className="add-item-section-badge">01</div>
            <h3 className="add-item-section-title">Basic Information</h3>

            <div className="add-item-field">
              <label className="add-item-label">Product Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="add-item-input"
                placeholder="Enter product name"
                maxLength={200}
              />
              <span className="add-item-char-count">
                {formData.name.length}/200
              </span>
            </div>

            <div className="add-item-grid">
              <div className="add-item-field">
                <label className="add-item-label">Product Category</label>
                <select
                  name="productCategory"
                  value={formData.productCategory}
                  onChange={handleChange}
                  className="add-item-select"
                >
                  <option value="">Select category</option>
                  {productCategories?.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="add-item-field">
                <label className="add-item-label">Shopping Mode</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="add-item-select"
                >
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                </select>
              </div>

              <div className="add-item-field">
                <label className="add-item-label">Price</label>
                <div className="add-item-input-wrapper">
                  <span className="add-item-currency">Rs</span>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    className="add-item-input"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="add-item-field">
                <label className="add-item-label">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="add-item-input"
                  placeholder="piece, kg, pack, etc."
                />
              </div>

              <div className="add-item-field">
                <label className="add-item-label">Stock Quantity</label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  className="add-item-input"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Section 02: Product Photo */}
          <div className="add-item-section">
            <div className="add-item-section-badge">02</div>
            <h3 className="add-item-section-title">Product Photo</h3>

            <div className="add-item-tabs">
              <button
                className={`add-item-tab ${photoTab === "find" ? "add-item-tab--active" : ""}`}
                onClick={() => setPhotoTab("find")}
              >
                Find free photo
              </button>
              <button
                className={`add-item-tab ${photoTab === "upload" ? "add-item-tab--active" : ""}`}
                onClick={() => setPhotoTab("upload")}
              >
                Upload your own
              </button>
            </div>

            {photoTab === "find" ? (
              <>
                <div className="add-item-search-bar">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="add-item-input"
                    placeholder="Search for photos..."
                    onKeyDown={(e) => e.key === "Enter" && handleImageSearch()}
                  />
                  <button
                    className="add-item-search-btn"
                    onClick={handleImageSearch}
                    disabled={searching}
                  >
                    {searching ? "Searching..." : "Search"}
                  </button>
                </div>
                <p className="add-item-helper-text">Powered by Unsplash</p>
                {searchError && (
                  <p
                    className="add-item-error-text"
                    style={{ color: "#ef4444", marginTop: "0.5rem" }}
                  >
                    {searchError}
                  </p>
                )}
                {searchResults.length > 0 ? (
                  <div className="add-item-photo-grid">
                    {searchResults.map((photo) => (
                      <button
                        type="button"
                        key={photo.id}
                        onClick={() => handleSelectImage(photo.urls.regular)}
                        aria-pressed={formData.imageUrl === photo.urls.regular}
                        className={`add-item-photo-option ${
                          formData.imageUrl === photo.urls.regular
                            ? "add-item-photo-option--selected"
                            : ""
                        }`}
                      >
                        <img
                          src={photo.urls.thumb}
                          alt={photo.alt_description || "Photo"}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="add-item-photo-area">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p>Search for a photo to add</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                  style={{ display: "none" }}
                />
                <div
                  className="add-item-photo-area"
                  onClick={() =>
                    document.getElementById("image-upload").click()
                  }
                  style={{ cursor: uploadingImage ? "not-allowed" : "pointer" }}
                >
                  {uploadingImage ? (
                    <p>Uploading...</p>
                  ) : (
                    <>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p>Click to upload an image</p>
                    </>
                  )}
                </div>
                {uploadError && (
                  <p
                    className="add-item-error-text"
                    style={{ color: "#ef4444", marginTop: "0.5rem" }}
                  >
                    {uploadError}
                  </p>
                )}
                {formData.imageUrl && (
                  <div style={{ marginTop: "1rem" }}>
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      style={{
                        maxWidth: "200px",
                        maxHeight: "200px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="add-item-preview">
          <div className="add-item-preview-card">
            <div className="add-item-preview-header">
              <h4>Preview</h4>
              <IconEye size={16} />
            </div>

            <div className="add-item-preview-image">
              {formData.imageUrl ? (
                <img
                  src={formData.imageUrl}
                  alt={formData.name || "Product"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "8px",
                  }}
                />
              ) : (
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              )}
            </div>

            <div className="add-item-preview-content">
              <h3 className="add-item-preview-name">
                {formData.name || "Product name"}
              </h3>
              <p className="add-item-preview-category">
                {formData.category || "No category"}
              </p>
              <div className="add-item-preview-price-row">
                <span className="add-item-preview-price">
                  Rs{formData.price || "0.00"}
                </span>
                <span className="add-item-preview-stock">
                  Stock: {formData.stock}
                </span>
              </div>
            </div>

            <div className="add-item-preview-actions">
              <button
                className="add-item-submit-btn"
                disabled={!isFormValid}
                onClick={handleSubmit}
              >
                {isEditing ? "Update Item" : "Create Item"}
              </button>
              <button onClick={handleCancel} className="add-item-cancel-link">
                Cancel and go back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

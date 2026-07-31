import { useEffect } from "react";
import { createPortal } from "react-dom";

// Shared confirmation modal. Replaces per-page inline-styled dialogs and the
// jarring native window.confirm(). Closes on Escape; confirm button can be
// styled as danger (default) or neutral.
export default function ConfirmDialog({
  message,
  title,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);

    // Lock body scroll when modal opens
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore body scroll when modal closes
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  const modalContent = (
    <div
      className="confirm-dialog__overlay"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="confirm-dialog__title">{title}</h3>}
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

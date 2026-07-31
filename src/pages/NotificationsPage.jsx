import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { IconBell, IconCheckAll, IconTrash } from "../components/Icons";
import { ListSkeleton } from "../components/Skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import { timeAgo, fullTimestamp } from "../lib/formatTime";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
];

export default function NotificationsPage() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    notifsLoading,
  } = useStore();
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Row-level deletes are immediate — the row is recoverable from the order
  // itself, so a modal per notification would be friction without benefit.
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const visible = useMemo(
    () =>
      filter === "unread" ? notifications.filter((n) => !n.read) : notifications,
    [notifications, filter],
  );

  const handleMarkAll = async () => {
    setBusy(true);
    const result = await markAllNotificationsRead();
    setBusy(false);
    if (result?.error) setError(result.error);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    const result = await deleteNotification(id);
    setDeletingId(null);
    if (result?.error) setError(result.error);
  };

  const handleClearAll = async () => {
    setConfirmClear(false);
    setBusy(true);
    const result = await clearAllNotifications();
    setBusy(false);
    if (result?.error) setError(result.error);
  };

  if (notifsLoading && notifications.length === 0) {
    return (
      <div className="notif-page">
        <header className="notif-page__head">
          <h1 className="notif-page__title">Notifications</h1>
        </header>
        <ListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="notif-page">
      <header className="notif-page__head">
        <div className="notif-page__heading">
          <h1 className="notif-page__title">Notifications</h1>
          {unreadCount > 0 && (
            <span className="notif-page__count">{unreadCount} new</span>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="notif-page__toolbar">
            <div className="notif-tabs" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={`notif-tab ${filter === f.key ? "notif-tab--active" : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  {f.key === "unread" && unreadCount > 0 && (
                    <span className="notif-tab__badge">{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="notif-page__tools">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-toolbtn"
                  onClick={handleMarkAll}
                  disabled={busy}
                >
                  <IconCheckAll size={16} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                className="notif-toolbtn notif-toolbtn--danger"
                onClick={() => setConfirmClear(true)}
                disabled={busy}
              >
                <IconTrash size={16} />
                Clear all
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="notif-page__error" role="alert">
            {error}
          </p>
        )}
      </header>

      {visible.length === 0 ? (
        <div className="notif-empty">
          <span className="notif-empty__icon">
            <IconBell size={32} />
          </span>
          <h2 className="notif-empty__title">
            {filter === "unread" ? "You're all caught up" : "No notifications yet"}
          </h2>
          <p className="notif-empty__text">
            {filter === "unread"
              ? "Every notification has been read."
              : "Updates about your orders will show up here."}
          </p>
          {filter === "unread" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFilter("all")}
            >
              View all
            </button>
          ) : (
            <Link to="/" className="btn btn-secondary">
              Start shopping
            </Link>
          )}
        </div>
      ) : (
        <ul className="notif-list">
          {visible.map((notif) => (
            <li
              key={notif.id}
              className={`notif-card ${notif.read ? "" : "notif-card--unread"} ${
                deletingId === notif.id ? "notif-card--deleting" : ""
              }`}
            >
              {/* The whole row is the click target for marking read; the order
                  link and delete are separate controls so they don't nest. */}
              <button
                type="button"
                className="notif-card__main"
                onClick={() => !notif.read && markNotificationRead(notif.id)}
                aria-label={
                  notif.read ? notif.message : `Mark as read: ${notif.message}`
                }
              >
                <span className="notif-card__icon" aria-hidden="true">
                  <IconBell size={18} />
                </span>
                <span className="notif-card__body">
                  <span className="notif-card__message">{notif.message}</span>
                  <span className="notif-card__meta">
                    {notif.orderId && (
                      <span className="notif-card__order">
                        Order #{notif.orderId}
                      </span>
                    )}
                    {notif.createdAt && (
                      <time
                        dateTime={notif.createdAt}
                        title={fullTimestamp(notif.createdAt)}
                      >
                        {timeAgo(notif.createdAt)}
                      </time>
                    )}
                  </span>
                </span>
                {!notif.read && (
                  <span className="notif-card__dot" aria-label="Unread" />
                )}
              </button>

              <div className="notif-card__actions">
                {notif.orderId && (
                  <Link
                    to={`/order/${notif.orderId}`}
                    className="notif-card__link"
                    onClick={() => !notif.read && markNotificationRead(notif.id)}
                  >
                    View order
                  </Link>
                )}
                <button
                  type="button"
                  className="notif-card__delete"
                  onClick={() => handleDelete(notif.id)}
                  disabled={deletingId === notif.id}
                  aria-label="Delete notification"
                  title="Delete notification"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear all notifications?"
          message={`This permanently deletes all ${notifications.length} notification${
            notifications.length === 1 ? "" : "s"
          }. This cannot be undone.`}
          confirmLabel="Clear all"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}

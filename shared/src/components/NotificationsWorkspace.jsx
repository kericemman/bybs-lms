import { ArrowRight, Bell, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { SafeHtml } from "./SafeHtml.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const PREVIEW_LIMIT = 180;

function formatDateTime(value) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function humanize(value = "") {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function stripHtml(value = "") {
  const text = String(value || "");

  if (typeof document !== "undefined") {
    const element = document.createElement("div");
    element.innerHTML = text;
    return element.textContent || element.innerText || "";
  }

  return text.replace(/<[^>]*>/g, " ");
}

function truncatePreview(value = "", limit = PREVIEW_LIMIT) {
  const normalized = stripHtml(value).replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) return normalized;

  return `${normalized.slice(0, limit - 3).trimEnd()}...`;
}

function isExternalUrl(value = "") {
  return /^https?:\/\//i.test(value);
}

export function NotificationsWorkspace({
  description,
  emptyDescription,
  emptyTitle = "No notifications yet",
  listNotifications,
  markNotificationRead,
  title = "Notifications"
}) {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [error, setError] = useState("");

  async function loadNotifications() {
    const response = await listNotifications();
    const nextNotifications = response.data || [];
    setNotifications(nextNotifications);

    if (selectedNotification) {
      const refreshedSelection = nextNotifications.find((notification) => notification._id === selectedNotification._id);
      setSelectedNotification(refreshedSelection || null);
    }
  }

  useEffect(() => {
    loadNotifications().catch((loadError) => setError(loadError.message));
    // listNotifications is a stable API method from each portal service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedNotification || typeof window === "undefined") return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSelectedNotification(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedNotification]);

  const selectedPreview = useMemo(
    () => truncatePreview(selectedNotification?.previewText || selectedNotification?.message || ""),
    [selectedNotification]
  );

  async function openNotification(notification) {
    setError("");
    setSelectedNotification(notification);

    if (notification.readStatus) return;

    try {
      const response = await markNotificationRead(notification._id);
      const updatedNotification = response?.data || { ...notification, readStatus: true };

      setNotifications((currentNotifications) =>
        currentNotifications.map((currentNotification) =>
          currentNotification._id === notification._id
            ? { ...currentNotification, ...updatedNotification, readStatus: true }
            : currentNotification
        )
      );
      setSelectedNotification((currentSelection) =>
        currentSelection?._id === notification._id
          ? { ...currentSelection, ...updatedNotification, readStatus: true }
          : currentSelection
      );
    } catch (markError) {
      setError(markError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader description={description} title={title} />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {selectedNotification ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bybs-navy/50 px-4 py-6"
          onClick={() => setSelectedNotification(null)}
        >
          <section
            aria-labelledby={`notification-title-${selectedNotification._id}`}
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex flex-col gap-3 border-b border-bybs-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-bybs-navy" id={`notification-title-${selectedNotification._id}`}>
                    {selectedNotification.title}
                  </h2>
                  <StatusBadge
                    label={selectedNotification.readStatus ? "Read" : "New"}
                    status={selectedNotification.readStatus ? "reviewed" : "pending"}
                  />
                </div>
                <p className="mt-1 text-xs text-bybs-muted">{formatDateTime(selectedNotification.createdAt)}</p>
                {selectedNotification.targetLabel || selectedNotification.type ? (
                  <p className="mt-2 text-sm text-bybs-muted">
                    {selectedNotification.targetLabel || humanize(selectedNotification.type)}
                  </p>
                ) : null}
              </div>
              <Button icon={X} onClick={() => setSelectedNotification(null)} size="sm" type="button" variant="ghost">
                Close
              </Button>
            </div>

            <div className="max-h-[calc(90vh-96px)] space-y-4 overflow-y-auto p-4 sm:p-5">
              {selectedPreview ? (
                <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-body">{selectedPreview}</p>
              ) : null}

              <SafeHtml className="max-w-none text-sm leading-6 text-bybs-body" html={selectedNotification.message} />

              {selectedNotification.ctaLabel && selectedNotification.ctaUrl ? (
                <Button
                  as="a"
                  href={selectedNotification.ctaUrl}
                  icon={ExternalLink}
                  rel={isExternalUrl(selectedNotification.ctaUrl) ? "noreferrer" : undefined}
                  target={isExternalUrl(selectedNotification.ctaUrl) ? "_blank" : undefined}
                  variant="secondary"
                >
                  {selectedNotification.ctaLabel}
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {!notifications.length ? (
        <EmptyState description={emptyDescription} icon={Bell} title={emptyTitle} />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const preview = truncatePreview(notification.previewText || notification.message);

            return (
              <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={notification._id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-bybs-navy">{notification.title}</h2>
                      <StatusBadge
                        label={notification.readStatus ? "Read" : "New"}
                        status={notification.readStatus ? "reviewed" : "pending"}
                      />
                    </div>
                    {preview ? <p className="mt-2 text-sm leading-6 text-bybs-body">{preview}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-bybs-muted">
                      <span>{formatDateTime(notification.createdAt)}</span>
                      {notification.type ? <span>{humanize(notification.type)}</span> : null}
                      {notification.targetLabel ? <span>{notification.targetLabel}</span> : null}
                    </div>
                  </div>
                  <Button
                    className="h-auto px-2 py-1 text-xs"
                    icon={ArrowRight}
                    onClick={() => openNotification(notification)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Click to Open
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { ArrowRight, Bell, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogAccessibility } from "../hooks/useDialogAccessibility.js";
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
  const requestedNotificationId = useMemo(
    () => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("notification") || "",
    []
  );
  const deepLinkOpenedRef = useRef(false);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const notificationDialogRef = useDialogAccessibility({
    isOpen: Boolean(selectedNotification),
    onClose: () => setSelectedNotification(null)
  });

  async function loadNotifications() {
    const response = await listNotifications(requestedNotificationId ? { notification: requestedNotificationId } : undefined);
    const nextNotifications = response.data || [];
    setNotifications(nextNotifications);

    if (selectedNotification) {
      const refreshedSelection = nextNotifications.find((notification) => notification._id === selectedNotification._id);
      setSelectedNotification(refreshedSelection || null);
    }
  }

  useEffect(() => {
    loadNotifications()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
    // listNotifications is a stable API method from each portal service.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoading || !requestedNotificationId || deepLinkOpenedRef.current) return;

    const requestedNotification = notifications.find(
      (notification) => notification._id === requestedNotificationId
    );

    if (requestedNotification) {
      deepLinkOpenedRef.current = true;
      openNotification(requestedNotification);
    }
  }, [isLoading, notifications, requestedNotificationId]);

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
      window.dispatchEvent(new CustomEvent("bybs:notification-read", { detail: { id: notification._id } }));
    } catch (markError) {
      setError(markError.message);
    }
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader description={description} title={title} />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}

      {selectedNotification ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bybs-navy/50 px-3 py-4 sm:px-4 sm:py-6"
          onClick={() => setSelectedNotification(null)}
        >
          <div className="flex min-h-full items-center justify-center">
            <section
              aria-labelledby={`notification-title-${selectedNotification._id}`}
              aria-modal="true"
              className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]"
              onClick={(event) => event.stopPropagation()}
              ref={notificationDialogRef}
              role="dialog"
              tabIndex="-1"
            >
              <div className="shrink-0 border-b border-bybs-border p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
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
                  <Button aria-label="Close notification" icon={X} onClick={() => setSelectedNotification(null)} size="icon" title="Close notification" type="button" variant="ghost" />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
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
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted" role="status">
          Loading notifications...
        </div>
      ) : !notifications.length ? (
        <EmptyState description={emptyDescription} icon={Bell} title={emptyTitle} />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const preview = truncatePreview(notification.previewText || notification.message);

            return (
              <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={notification._id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-base font-semibold text-bybs-navy">{notification.title}</h2>
                      <StatusBadge
                        label={notification.readStatus ? "Read" : "New"}
                        status={notification.readStatus ? "reviewed" : "pending"}
                      />
                    </div>
                    {preview ? <p className="mt-2 break-words text-sm leading-6 text-bybs-body">{preview}</p> : null}
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

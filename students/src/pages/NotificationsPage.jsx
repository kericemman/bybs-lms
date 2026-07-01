import { Bell, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, SafeHtml, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  async function loadNotifications() {
    const response = await studentApi.listNotifications();
    setNotifications(response.data);
  }

  useEffect(() => {
    loadNotifications().catch((loadError) => setError(loadError.message));
  }, []);

  async function markRead(notification) {
    setError("");
    try {
      await studentApi.markNotificationRead(notification._id);
      await loadNotifications();
    } catch (markError) {
      setError(markError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Read announcements, assignment reminders, booking updates, and platform messages."
        title="Notifications"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {!notifications.length ? (
        <EmptyState
          description="Updates from BYBS will appear here."
          icon={Bell}
          title="No notifications yet"
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={notification._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-bybs-navy">{notification.title}</h2>
                    <StatusBadge label={notification.readStatus ? "Read" : "New"} status={notification.readStatus ? "reviewed" : "pending"} />
                  </div>
                  <SafeHtml className="mt-2 text-sm text-bybs-body" html={notification.message} />
                  <p className="mt-2 text-xs text-bybs-muted">{formatDateTime(notification.createdAt)}</p>
                </div>
                {!notification.readStatus ? (
                  <Button icon={CheckCircle} onClick={() => markRead(notification)} size="sm" type="button" variant="secondary">
                    Mark read
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

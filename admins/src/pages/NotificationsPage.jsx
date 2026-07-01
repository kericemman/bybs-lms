import { useEffect, useState } from "react";
import { DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .listNotifications()
      .then((response) => setNotifications(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Audit announcements, reminders, and system notifications delivered to users."
        title="Notifications"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          { key: "title", header: "Notification" },
          { key: "recipient", header: "Recipient", render: (row) => relatedTitle(row.recipient) },
          { key: "type", header: "Type" },
          { key: "channel", header: "Channel", render: (row) => row.channel || "platform" },
          {
            key: "readStatus",
            header: "Read",
            render: (row) => <StatusBadge label={row.readStatus ? "Read" : "Unread"} tone={row.readStatus ? "success" : "neutral"} />
          },
          { key: "createdAt", header: "Created", render: (row) => formatDateTime(row.createdAt) }
        ]}
        emptyDescription="Sent notifications will appear here."
        rows={notifications}
      />
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

function isAdminRecipient(notification) {
  return ["admin", "adminManager", "superAdmin"].includes(notification.recipient?.role);
}

function isExternalUrl(value = "") {
  return /^https?:\/\//i.test(value);
}

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
          { key: "createdAt", header: "Created", render: (row) => formatDateTime(row.createdAt) },
          {
            key: "action",
            header: "Action",
            render: (row) => row.ctaUrl && isAdminRecipient(row) ? (
              <Button
                as="a"
                href={row.ctaUrl}
                icon={ExternalLink}
                rel={isExternalUrl(row.ctaUrl) ? "noreferrer" : undefined}
                size="sm"
                target={isExternalUrl(row.ctaUrl) ? "_blank" : undefined}
                variant="secondary"
              >
                {row.ctaLabel || "Open"}
              </Button>
            ) : "Recipient portal"
          }
        ]}
        emptyDescription="Sent notifications will appear here."
        rows={notifications}
      />
    </div>
  );
}

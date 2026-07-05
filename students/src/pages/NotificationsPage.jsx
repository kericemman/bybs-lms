import { NotificationsWorkspace } from "@bybs/shared";
import { studentApi } from "../services/api.js";

export function NotificationsPage() {
  return (
    <NotificationsWorkspace
      description="Preview announcements, assignment reminders, booking updates, and platform messages before opening the full note."
      emptyDescription="Updates from BYBS will appear here."
      listNotifications={studentApi.listNotifications}
      markNotificationRead={studentApi.markNotificationRead}
    />
  );
}

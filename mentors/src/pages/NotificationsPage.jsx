import { NotificationsWorkspace } from "@bybs/shared";
import { mentorApi } from "../services/api.js";

export function NotificationsPage() {
  return (
    <NotificationsWorkspace
      description="Preview booking requests, report feedback, forum replies, platform updates, and mentor alerts before opening the full note."
      emptyDescription="Mentor updates from BYBS and mentee activity will appear here."
      listNotifications={mentorApi.listNotifications}
      markNotificationRead={mentorApi.markNotificationRead}
    />
  );
}

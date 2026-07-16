import { AppShell, Button, ChangePasswordPanel, ProgressBar } from "@bybs/shared";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { studentNavItems } from "../routes/navigation.jsx";
import { studentApi } from "../services/api.js";

export function StudentLayout({ children }) {
  const { changePassword, logout, user } = useAuth();
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    function handleNotificationRead() {
      setUnreadNotifications((current) => Math.max(current - 1, 0));
    }

    window.addEventListener("bybs:notification-read", handleNotificationRead);

    Promise.all([studentApi.progress(), studentApi.dashboard()])
      .then(([progressResponse, dashboardResponse]) => {
        setProgress(progressResponse.data?.progress || 0);
        setUnreadNotifications(dashboardResponse.data?.summary?.unreadNotifications || 0);
      })
      .catch(() => {
        setProgress(0);
        setUnreadNotifications(0);
      });

    return () => window.removeEventListener("bybs:notification-read", handleNotificationRead);
  }, []);

  return (
    <AppShell
      activePath={location.pathname}
      globalSearch={(search) => studentApi.globalSearch({ search })}
      navItems={studentNavItems}
      notificationCount={unreadNotifications}
      notificationsHref="/app/notifications"
      onSignOut={logout}
      portalName="Mentee Portal"
      profileHref="/app/profile"
      searchPlaceholder="Search assignments, sessions, materials..."
      sidebarFooter={
        <div>
          <p className="mb-3 text-sm font-medium text-bybs-navy">Fellowship progress</p>
          <ProgressBar label="Completed" value={progress} />
          <Button
            aria-label="Sign out"
            className="mt-4 w-full"
            icon={LogOut}
            onClick={logout}
            size="sm"
            type="button"
            variant="secondary"
          >
            Sign out
          </Button>
        </div>
      }
      user={user}
    >
      {user?.passwordResetRequired ? (
        <div className="mb-6">
          <ChangePasswordPanel
            force
            onChangePassword={changePassword}
            title="Temporary password must be changed"
          />
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}

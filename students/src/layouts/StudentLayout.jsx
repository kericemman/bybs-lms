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

  useEffect(() => {
    studentApi.progress()
      .then((response) => setProgress(response.data?.progress || 0))
      .catch(() => setProgress(0));
  }, []);

  return (
    <AppShell
      activePath={location.pathname}
      navItems={studentNavItems}
      notificationsHref="/app/notifications"
      portalName="Student Portal"
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

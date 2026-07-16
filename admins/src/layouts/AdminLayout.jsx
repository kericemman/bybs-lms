import { AppShell, Button, ChangePasswordPanel, StatusBadge } from "@bybs/shared";
import { LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { adminNavItems } from "../routes/navigation.jsx";
import { hasRole } from "../utils/permissions.js";

export function AdminLayout({ children }) {
  const { changePassword, logout, user } = useAuth();
  const location = useLocation();
  const visibleNavItems = adminNavItems.filter((item) => !item.roles || hasRole(user, item.roles));

  return (
    <AppShell
      activePath={location.pathname}
      navItems={visibleNavItems}
      notificationsHref={hasRole(user, ["admin", "superAdmin"]) ? "/notifications" : undefined}
      onSignOut={logout}
      portalName="Admin Portal"
      profileHref="/profile"
      sidebarFooter={
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-bybs-navy">System status</p>
              <p className="text-xs text-bybs-muted">Core services ready</p>
            </div>
            <StatusBadge status="active" />
          </div>
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

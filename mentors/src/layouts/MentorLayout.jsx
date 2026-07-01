import { AppShell, Button, ChangePasswordPanel, ProgressBar } from "@bybs/shared";
import { LogOut } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { mentorNavItems } from "../routes/navigation.jsx";

export function MentorLayout({ children }) {
  const { changePassword, logout, user } = useAuth();
  const location = useLocation();

  return (
    <AppShell
      activePath={location.pathname}
      navItems={mentorNavItems}
      portalName="Mentor Portal"
      sidebarFooter={
        <div>
          <p className="mb-3 text-sm font-medium text-bybs-navy">Cohort health</p>
          <ProgressBar label="Engagement" value={0} />
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

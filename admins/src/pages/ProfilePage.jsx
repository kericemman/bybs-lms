import { Card, ChangePasswordPanel, PageHeader, ROLE_LABELS, SectionHeader } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProfilePage() {
  const { changePassword, user } = useAuth();
  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "Admin";

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review the signed-in admin account details."
        title="Profile"
      />
      <Card>
        <SectionHeader title="Admin account" />
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-bybs-muted">Name</dt>
            <dd className="mt-1 text-sm font-medium text-bybs-navy">{user?.name || "Admin"}</dd>
          </div>
          <div>
            <dt className="text-sm text-bybs-muted">Email</dt>
            <dd className="mt-1 text-sm font-medium text-bybs-navy">{user?.email || "Not available"}</dd>
          </div>
          <div>
            <dt className="text-sm text-bybs-muted">Role</dt>
            <dd className="mt-1 text-sm font-medium text-bybs-navy">{roleLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-bybs-muted">Status</dt>
            <dd className="mt-1 text-sm font-medium text-bybs-navy">{user?.status || "active"}</dd>
          </div>
        </dl>
      </Card>
      <ChangePasswordPanel
        description="Use a strong password and update temporary credentials before production access."
        force={user?.passwordResetRequired}
        onChangePassword={changePassword}
      />
    </div>
  );
}

import { Card, PageHeader, SectionHeader, StatusBadge } from "@bybs/shared";

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Control platform-level settings, security defaults, and future integrations."
        title="Settings"
      />
      <Card>
        <SectionHeader
          description="These settings will become editable once the rest of the admin workflows are complete."
          title="Platform settings"
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md bg-bybs-pale p-4">
            <p className="text-sm font-medium text-bybs-navy">Authentication</p>
            <div className="mt-2"><StatusBadge label="JWT enabled" status="active" /></div>
          </div>
          <div className="rounded-md bg-bybs-pale p-4">
            <p className="text-sm font-medium text-bybs-navy">Admin alerts</p>
            <p className="mt-2 text-sm text-bybs-body">Email-ready error and delay monitoring</p>
          </div>
          <div className="rounded-md bg-bybs-pale p-4">
            <p className="text-sm font-medium text-bybs-navy">File storage</p>
            <p className="mt-2 text-sm text-bybs-body">External storage pending</p>
          </div>
          <div className="rounded-md bg-bybs-pale p-4">
            <p className="text-sm font-medium text-bybs-navy">Email</p>
            <p className="mt-2 text-sm text-bybs-body">Resend pending</p>
          </div>
          <div className="rounded-md bg-bybs-pale p-4">
            <p className="text-sm font-medium text-bybs-navy">Calendar</p>
            <p className="mt-2 text-sm text-bybs-body">Internal calendar first</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

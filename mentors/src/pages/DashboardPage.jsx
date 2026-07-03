import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  FileText,
  Send,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  QuickAction,
  SectionHeader,
  StatCard,
  StatusBadge
} from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate, formatDateTime } from "../utils/format.js";

const emptyDashboard = {
  summary: {
    assignedStudents: 0,
    assignedModules: 0,
    pendingReviews: 0,
    upcomingSessions: 0,
    atRiskStudents: 0
  },
  modules: [],
  attention: []
};

export function DashboardPage() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [error, setError] = useState("");

  useEffect(() => {
    mentorApi
      .dashboard()
      .then((response) => setDashboard(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  const { summary, modules, attention } = dashboard;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button as="a" href="/bookings" icon={Send}>
              View bookings
            </Button>
            <Button as="a" href="/reports" icon={FileText} variant="secondary">
              Submit report
            </Button>
          </>
        }
        description="See the students, submissions, and bookings that need mentor attention."
        title="Mentor dashboard"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Assigned students" tone="blue" value={summary.assignedStudents} />
        <StatCard icon={FileText} label="Assigned modules" tone="blue" value={summary.assignedModules} />
        <StatCard icon={ClipboardCheck} label="Pending reviews" tone="gold" value={summary.pendingReviews} />
        <StatCard icon={CalendarCheck} label="Upcoming sessions" tone="blue" value={summary.upcomingSessions} />
      </div>

      <Card>
        <SectionHeader
          action={
            <Button as="a" href="/modules" icon={BookOpen} size="sm" variant="secondary">
              Open modules
            </Button>
          }
          description="Modules assigned by Admin, with dates to guide sessions, assignments, and progress tracking."
          title="My modules"
        />
        <DataTable
          columns={[
            { key: "title", header: "Module" },
            { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
            { key: "dates", header: "Dates", render: (row) => row.startDate || row.endDate ? `${formatDate(row.startDate)} - ${formatDate(row.endDate)}` : "Not set" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <Button as="a" href={`/modules?module=${row._id}`} icon={Eye} size="sm" variant="secondary">
                  View
                </Button>
              )
            }
          ]}
          emptyDescription="Modules assigned to you by Admin will appear here."
          emptyTitle="No modules assigned"
          rows={modules}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionHeader
            description={`${summary.atRiskStudents} student(s) currently need closer attention.`}
            title="Needs attention"
          />
          <DataTable
            columns={[
              { key: "name", header: "Student" },
              { key: "reason", header: "Reason" },
              { key: "date", header: "Date", render: (row) => formatDateTime(row.date) },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />
              }
            ]}
            emptyDescription="Submission reviews and booking requests that need attention will appear here."
            rows={attention}
          />
        </Card>

        <div className="space-y-4">
          <QuickAction
            actionLabel="Upload"
            description="Add slides, documents, recordings, and assignment breakdowns after each session."
            icon={FileText}
            onClick={() => { window.location.href = "/session-work"; }}
            title="Session work"
          />
          <QuickAction
            actionLabel="Review"
            description="Score submissions, leave feedback, and request revisions."
            icon={ClipboardCheck}
            onClick={() => { window.location.href = "/reviews"; }}
            title="Assignment reviews"
          />
          <QuickAction
            actionLabel="Open"
            description="Approve, decline, or complete mentor session bookings."
            icon={CalendarCheck}
            onClick={() => { window.location.href = "/bookings"; }}
            title="1:1 sessions"
          />
        </div>
      </div>
    </div>
  );
}

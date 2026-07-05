import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
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
import { formatCatDateTime, formatDate, formatDateTime } from "../utils/format.js";

const emptyDashboard = {
  summary: {
    assignedStudents: 0,
    assignedModules: 0,
    pendingReviews: 0,
    upcomingSessions: 0,
    attendancePendingSessions: 0,
    atRiskStudents: 0
  },
  modules: [],
  nextSessions: [],
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

  const { summary, modules, nextSessions = [], attention } = dashboard;

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
        description="See the mentees, submissions, and bookings that need mentor attention."
        title="Mentor dashboard"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Assigned mentees" tone="blue" value={summary.assignedStudents} />
        <StatCard icon={FileText} label="Assigned modules" tone="blue" value={summary.assignedModules} />
        <StatCard icon={ClipboardCheck} label="Pending reviews" tone="gold" value={summary.pendingReviews} />
        <StatCard icon={CalendarCheck} label="Upcoming sessions" tone="blue" value={summary.upcomingSessions} />
        <StatCard icon={ClipboardList} label="Attendance pending" tone="gold" value={summary.attendancePendingSessions || 0} />
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

      <Card>
        <SectionHeader
          description="Sessions are scheduled by Admin for Saturday or Sunday, 2:00 PM - 4:00 PM CAT."
          title="Upcoming module sessions"
        />
        <DataTable
          columns={[
            { key: "title", header: "Session" },
            { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
            { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
            { key: "mentor", header: "Mentor", render: (row) => row.module?.assignedMentor?.name || "Assigned mentor" },
            { key: "startsAt", header: "Date", render: (row) => formatCatDateTime(row.startsAt) },
            {
              key: "attendance",
              header: "Attendance",
              render: (row) => (
                <Button as="a" href={`/attendance?session=${row._id}`} icon={ClipboardList} size="sm" variant="secondary">
                  Mark
                </Button>
              )
            }
          ]}
          emptyDescription="Admin scheduled module sessions will appear here."
          emptyTitle="No upcoming sessions"
          rows={nextSessions}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionHeader
            description={`${summary.atRiskStudents} mentee(s) currently need closer attention.`}
            title="Needs attention"
          />
          <DataTable
            columns={[
              { key: "name", header: "Mentee" },
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
            actionLabel="Mark"
            description="Open your session attendance links and record who joined after each class."
            icon={ClipboardList}
            onClick={() => { window.location.href = "/attendance"; }}
            title="Attendance"
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

import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Send,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AddToCalendarButton,
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

function sessionCalendarEvent(session) {
  return {
    id: session._id,
    title: `BYBS session: ${session.title}`,
    description: `${session.module?.title || "Module session"} for ${session.cohort?.title || "BYBS cohort"}.`,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    location: session.zoomLink || "BYBS LMS",
    url: session.zoomLink || ""
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    mentorApi
      .dashboard()
      .then((response) => setDashboard(response.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setIsLoading(false));
  }, []);

  const { summary, modules, nextSessions = [], attention } = dashboard;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button icon={Send} onClick={() => navigate("/bookings")} type="button">
              View bookings
            </Button>
            <Button icon={FileText} onClick={() => navigate("/reports")} type="button" variant="secondary">
              Submit report
            </Button>
          </>
        }
        description="See the mentees, submissions, and bookings that need mentor attention."
        title="Mentor dashboard"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-bybs-border bg-white text-sm text-bybs-muted" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-bybs-blue" aria-hidden="true" />
          Loading your dashboard...
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard icon={Users} label="Assigned mentees" onClick={() => navigate("/students")} tone="blue" value={summary.assignedStudents} />
        <StatCard icon={FileText} label="Assigned modules" onClick={() => navigate("/modules")} tone="blue" value={summary.assignedModules} />
        <StatCard icon={ClipboardCheck} label="Pending reviews" onClick={() => navigate("/reviews")} tone="gold" value={summary.pendingReviews} />
        <StatCard icon={CalendarCheck} label="Upcoming sessions" onClick={() => navigate("/attendance")} tone="blue" value={summary.upcomingSessions} />
        <StatCard icon={ClipboardList} label="Attendance pending" onClick={() => navigate("/attendance")} tone="gold" value={summary.attendancePendingSessions || 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <SectionHeader
            description="Pending assignment reviews and booking requests."
            title="Needs attention"
          />
          <DataTable
            columns={[
              { key: "name", header: "Mentee" },
              { key: "reason", header: "Reason" },
              { key: "date", header: "Date", render: (row) => formatDateTime(row.date) },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "action",
                header: "Action",
                render: (row) => (
                  <Button
                    icon={Eye}
                    onClick={() => navigate(row.kind === "booking" ? "/bookings" : "/reviews")}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Open
                  </Button>
                )
              }
            ]}
            emptyDescription="New assignment submissions and booking requests will appear here."
            emptyTitle="Nothing needs your attention"
            rows={attention}
          />
        </Card>

        <div className="space-y-4">
          <QuickAction
            actionLabel="Upload"
            description="Add slides, documents, recordings, and assignment breakdowns after each session."
            icon={FileText}
            onClick={() => navigate("/session-work")}
            title="Session work"
          />
          <QuickAction
            actionLabel="Review"
            description="Score submissions, leave feedback, and request revisions."
            icon={ClipboardCheck}
            onClick={() => navigate("/reviews")}
            title="Assignment reviews"
          />
          <QuickAction
            actionLabel="Mark"
            description="Record who joined your recent classes."
            icon={ClipboardList}
            onClick={() => navigate("/attendance")}
            title="Attendance"
          />
          <QuickAction
            actionLabel="Open"
            description="Approve, decline, or complete mentor session bookings."
            icon={CalendarCheck}
            onClick={() => navigate("/bookings")}
            title="1:1 sessions"
          />
        </div>
      </div>

      <Card>
        <SectionHeader
          description="Sessions scheduled by Admin for Saturday or Sunday, 2:00 PM–4:00 PM CAT."
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
              key: "calendar",
              header: "Calendar",
              render: (row) => <AddToCalendarButton event={sessionCalendarEvent(row)} fileName={`bybs-session-${row._id}`} />
            },
            {
              key: "attendance",
              header: "Attendance",
              render: (row) => (
                <Button icon={ClipboardList} onClick={() => navigate(`/attendance?session=${row._id}`)} size="sm" type="button" variant="secondary">
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

      <Card>
        <SectionHeader
          action={
            <Button icon={BookOpen} onClick={() => navigate("/modules")} size="sm" type="button" variant="secondary">
              Open modules
            </Button>
          }
          description="Dates and cohort context for the modules assigned to you."
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
                <Button icon={Eye} onClick={() => navigate(`/modules?module=${row._id}`)} size="sm" type="button" variant="secondary">
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
        </>
      ) : null}
    </div>
  );
}

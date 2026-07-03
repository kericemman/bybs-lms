import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Plus,
  Send,
  Users
} from "lucide-react";
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
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnnouncementComposer } from "../components/AnnouncementComposer.jsx";
import { adminApi } from "../services/api.js";

const recentActivity = [
  { id: 1, item: "Cohort 4 orientation", owner: "Admin team", status: "scheduled" },
  { id: 2, item: "Week 1 assignment", owner: "Mentor team", status: "published" },
  { id: 3, item: "Login support queue", owner: "Support", status: "pending" }
];

export function DashboardPage() {
  const navigate = useNavigate();
  const composerRef = useRef(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [summary, setSummary] = useState({
    students: 0,
    mentors: 0,
    cohorts: 0,
    pendingReviews: 0,
    supportTickets: 0
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    adminApi
      .dashboard()
      .then((response) => {
        if (isMounted) {
          setSummary(response.totals);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(requestError.message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function openComposer() {
    setIsComposerOpen(true);
    window.requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button icon={Plus} onClick={() => navigate("/cohorts")} type="button">
              Create cohort
            </Button>
            <Button icon={Send} onClick={openComposer} type="button" variant="secondary">
              Send announcement
            </Button>
          </>
        }
        description="Track platform health, cohort activity, and items that need admin attention."
        title="Admin dashboard"
      />

      {error ? (
        <p className="rounded-md bg-bybs-gold/30 px-4 py-3 text-sm text-bybs-navy">
          {error}. Start the backend API and sign in with a seeded admin account to load live data.
        </p>
      ) : null}

      {isComposerOpen ? (
        <div ref={composerRef}>
          <AnnouncementComposer
            onCancel={() => setIsComposerOpen(false)}
            title="Send announcement from dashboard"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={GraduationCap} label="Active mentees" tone="blue" value={summary.students} />
        <StatCard icon={Users} label="Mentors" tone="blue" value={summary.mentors} />
        <StatCard icon={BookOpen} label="Current cohorts" tone="blue" value={summary.cohorts} />
        <StatCard icon={ClipboardCheck} label="Pending reviews" tone="gold" value={summary.pendingReviews} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <SectionHeader
            description="This will become the live stream of assignments, reports, bookings, and system events."
            title="Recent activity"
          />
          <DataTable
            columns={[
              { key: "item", header: "Item" },
              { key: "owner", header: "Owner" },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />
              }
            ]}
            rows={recentActivity}
          />
        </Card>

        <div className="space-y-4">
          <QuickAction
            actionLabel="Review"
            description="Check unresolved tickets, assignment issues, and access problems."
            icon={AlertTriangle}
            onClick={() => navigate("/support")}
            title="Support queue"
          />
          <QuickAction
            actionLabel="Prepare"
            description="Create modules, sessions, resources, and assignments for a cohort."
            icon={BookOpen}
            onClick={() => navigate("/modules")}
            title="Cohort setup"
          />
        </div>
      </div>
    </div>
  );
}

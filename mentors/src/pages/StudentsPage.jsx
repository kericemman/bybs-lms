import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button, DataTable, PageHeader, ProgressBar, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "B"}${parts[1]?.[0] || ""}`.toUpperCase();
}

export function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    mentorApi
      .listStudents()
      .then((response) => setStudents(response.data))
      .catch((requestError) => setError(requestError.message));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="View assigned mentees, progress, submissions, attendance, notes, and risk status."
        title="Assigned mentees"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          {
            key: "name",
            header: "Mentee",
            render: (row) => (
              <Link className="inline-flex min-w-52 items-center gap-3 rounded-md transition hover:text-bybs-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale" to={`/students/${row.id}`}>
                {row.profileImage ? (
                  <img alt={row.name} className="h-10 w-10 rounded-full border border-bybs-border object-cover" src={row.profileImage} />
                ) : (
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-bybs-border bg-bybs-pale text-sm font-semibold text-bybs-blue">
                    {initials(row.name)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-bybs-navy">{row.name}</span>
                  <span className="block truncate text-xs text-bybs-muted">{row.email}</span>
                </span>
              </Link>
            )
          },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          {
            key: "progress",
            header: "Progress",
            render: (row) => <div className="w-44"><ProgressBar value={row.progress} /></div>
          },
          { key: "submissions", header: "Submissions", render: (row) => `${row.submittedCount}/${row.totalAssignments}` },
          { key: "lastSubmissionAt", header: "Last submission", render: (row) => formatDate(row.lastSubmissionAt) },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Button as={Link} icon={Eye} size="sm" to={`/students/${row.id}`} variant="secondary">
                View
              </Button>
            )
          }
        ]}
        emptyDescription="Mentees assigned to you or your cohort will appear here."
        rows={students}
      />
    </div>
  );
}

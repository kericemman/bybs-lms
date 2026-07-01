import { useEffect, useState } from "react";
import { DataTable, PageHeader, ProgressBar, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

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
        description="View assigned students, progress, submissions, attendance, notes, and risk status."
        title="Assigned students"
      />
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          { key: "name", header: "Student" },
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
          }
        ]}
        emptyDescription="Students assigned to you or your cohort will appear here."
        rows={students}
      />
    </div>
  );
}

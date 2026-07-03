import { Eye, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, SafeHtml, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

function initialForm(overrides = {}) {
  return {
    period: "weekly",
    activeStudentCount: "",
    studentsDoingWell: [],
    studentsAtRisk: [],
    assignmentCompletionSummary: "",
    attendanceConcerns: "",
    observations: "",
    recommendations: "",
    supportNeeded: "",
    ...overrides
  };
}

function entityId(value) {
  return String(value?._id || value?.id || value || "");
}

function selectedValues(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

function formFromReport(report) {
  return initialForm({
    period: report.period || "weekly",
    activeStudentCount: report.activeStudentCount ?? "",
    studentsDoingWell: (report.studentsDoingWell || []).map(entityId),
    studentsAtRisk: (report.studentsAtRisk || []).map(entityId),
    assignmentCompletionSummary: report.assignmentCompletionSummary || "",
    attendanceConcerns: report.attendanceConcerns || "",
    observations: report.observations || "",
    recommendations: report.recommendations || "",
    supportNeeded: report.supportNeeded || ""
  });
}

function peopleList(people = []) {
  return people.map((person) => person.name || person.email).filter(Boolean).join(", ") || "None listed";
}

function reportPayload(form) {
  return {
    ...form,
    activeStudentCount: form.activeStudentCount === "" ? undefined : Number(form.activeStudentCount)
  };
}

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [editingReport, setEditingReport] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const [reportResponse, studentResponse] = await Promise.all([
      mentorApi.listReports(),
      mentorApi.listStudents()
    ]);
    setReports(reportResponse.data);
    setStudents(studentResponse.data);
    setViewingReport((current) =>
      current ? reportResponse.data.find((report) => report._id === current._id) || current : current
    );
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(report) {
    setEditingReport(report);
    setViewingReport(report);
    setForm(formFromReport(report));
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingReport(null);
    setForm(initialForm());
    setError("");
    setFeedback("");
  }

  async function submitReport(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      if (editingReport) {
        const response = await mentorApi.updateReport(editingReport._id, reportPayload(form));
        setFeedback("Report updated and sent back for admin review.");
        setViewingReport(response.data);
        setEditingReport(null);
      } else {
        const response = await mentorApi.createReport(reportPayload(form));
        setFeedback("Report submitted.");
        setViewingReport(response.data);
      }

      setForm(initialForm());
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Submit, review, and update weekly or monthly reports covering mentee progress, risks, and support needs."
        title="Reports"
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitReport}>
          {editingReport ? (
            <div className="rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase text-bybs-blue">Editing report</p>
                  <h2 className="mt-1 text-lg font-semibold text-bybs-navy">
                    {editingReport.period} report · {editingReport.cohort?.title || "Cohort"}
                  </h2>
                  <p className="mt-1 text-sm text-bybs-body">Updates will return this report to Submitted for admin review.</p>
                </div>
                <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                  Cancel edit
                </Button>
              </div>
            </div>
          ) : null}

          <FormField label="Period">
            <select className={inputClassName} onChange={(event) => updateField("period", event.target.value)} value={form.period}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </FormField>
          <FormField label="Active mentee count">
            <input className={inputClassName} min="0" onChange={(event) => updateField("activeStudentCount", event.target.value)} placeholder={`${students.length}`} type="number" value={form.activeStudentCount} />
          </FormField>
          <FormField hint="Hold Command or Ctrl to select more than one." label="Mentees doing well">
            <select className={`${inputClassName} h-28`} multiple onChange={(event) => updateField("studentsDoingWell", selectedValues(event))} value={form.studentsDoingWell}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </FormField>
          <FormField hint="Hold Command or Ctrl to select more than one." label="Mentees at risk">
            <select className={`${inputClassName} h-28`} multiple onChange={(event) => updateField("studentsAtRisk", selectedValues(event))} value={form.studentsAtRisk}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </FormField>
          <div className="lg:col-span-2">
            <FormField label="Assignment completion summary">
              <textarea className={textAreaClassName} onChange={(event) => updateField("assignmentCompletionSummary", event.target.value)} value={form.assignmentCompletionSummary} />
            </FormField>
          </div>
          <FormField label="Attendance concerns">
            <textarea className={textAreaClassName} onChange={(event) => updateField("attendanceConcerns", event.target.value)} value={form.attendanceConcerns} />
          </FormField>
          <FormField label="Observations">
            <textarea className={textAreaClassName} onChange={(event) => updateField("observations", event.target.value)} value={form.observations} />
          </FormField>
          <FormField label="Recommendations">
            <textarea className={textAreaClassName} onChange={(event) => updateField("recommendations", event.target.value)} value={form.recommendations} />
          </FormField>
          <div className="lg:col-span-3">
            <FormField label="Support needed">
              <textarea className={textAreaClassName} onChange={(event) => updateField("supportNeeded", event.target.value)} value={form.supportNeeded} />
            </FormField>
          </div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting} icon={editingReport ? Pencil : Plus} type="submit">
              {isSubmitting ? (editingReport ? "Updating..." : "Submitting...") : editingReport ? "Update report" : "Submit report"}
            </Button>
            {editingReport ? (
              <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {viewingReport ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-bybs-blue">Report detail</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">
                {viewingReport.period} report · {viewingReport.cohort?.title || "Cohort"}
              </h2>
              <p className="mt-1 text-sm text-bybs-body">Submitted {formatDateTime(viewingReport.submittedAt || viewingReport.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={viewingReport.reviewStatus || "submitted"} />
              <Button icon={Pencil} onClick={() => startEdit(viewingReport)} size="sm" type="button" variant="secondary">
                Edit
              </Button>
              <Button icon={X} onClick={() => setViewingReport(null)} size="sm" type="button" variant="ghost">
                Close
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-md bg-bybs-pale p-4">
              <p className="text-sm font-semibold text-bybs-navy">Mentees doing well</p>
              <p className="mt-1 text-sm text-bybs-body">{peopleList(viewingReport.studentsDoingWell)}</p>
            </div>
            <div className="rounded-md bg-bybs-blush p-4">
              <p className="text-sm font-semibold text-bybs-navy">Mentees at risk</p>
              <p className="mt-1 text-sm text-bybs-body">{peopleList(viewingReport.studentsAtRisk)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              ["Assignment completion", viewingReport.assignmentCompletionSummary],
              ["Attendance concerns", viewingReport.attendanceConcerns],
              ["Observations", viewingReport.observations],
              ["Recommendations", viewingReport.recommendations],
              ["Support needed", viewingReport.supportNeeded]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border p-4" key={label}>
                <p className="text-sm font-semibold text-bybs-navy">{label}</p>
                <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={value || "None listed"} />
              </div>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-bybs-navy">Admin comments and clarification</p>
            {!viewingReport.adminComments?.length ? (
              <p className="mt-2 rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-body">No admin comments yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {viewingReport.adminComments.map((comment) => (
                  <article className="rounded-md border border-bybs-border p-4" key={comment._id || comment.createdAt}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-bybs-navy">{comment.admin?.name || "Admin"}</p>
                      <StatusBadge label={comment.action === "clarification" ? "Clarification" : comment.status} status={comment.status || "reviewed"} />
                    </div>
                    <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={comment.message} />
                    <p className="mt-2 text-xs text-bybs-muted">{formatDateTime(comment.createdAt)}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <DataTable
        columns={[
          { key: "period", header: "Period" },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
          { key: "reviewStatus", header: "Review", render: (row) => <StatusBadge status={row.reviewStatus || "submitted"} /> },
          { key: "activeStudentCount", header: "Active mentees" },
          { key: "studentsAtRisk", header: "At risk", render: (row) => row.studentsAtRisk?.length || 0 },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt || row.createdAt) },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button icon={Eye} onClick={() => setViewingReport(row)} size="sm" type="button" variant="secondary">
                  View
                </Button>
                <Button icon={Pencil} onClick={() => startEdit(row)} size="sm" type="button" variant="secondary">
                  Edit
                </Button>
              </div>
            )
          }
        ]}
        emptyDescription="Mentor reports will be listed here after submission."
        emptyTitle="No reports submitted"
        rows={reports}
      />
    </div>
  );
}

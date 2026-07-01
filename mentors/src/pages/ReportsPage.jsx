import { FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

function initialForm() {
  return {
    period: "weekly",
    activeStudentCount: "",
    studentsDoingWell: [],
    studentsAtRisk: [],
    assignmentCompletionSummary: "",
    attendanceConcerns: "",
    observations: "",
    recommendations: "",
    supportNeeded: ""
  };
}

function selectedValues(event) {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(() => initialForm());
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
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  async function submitReport(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await mentorApi.createReport({
        ...form,
        activeStudentCount: form.activeStudentCount === "" ? undefined : Number(form.activeStudentCount)
      });
      setFeedback("Report submitted.");
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
        description="Submit weekly or monthly reports covering student progress, risks, and support needs."
        title="Reports"
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitReport}>
          <FormField label="Period">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))} value={form.period}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </FormField>
          <FormField label="Active student count">
            <input className={inputClassName} min="0" onChange={(event) => setForm((current) => ({ ...current, activeStudentCount: event.target.value }))} placeholder={`${students.length}`} type="number" value={form.activeStudentCount} />
          </FormField>
          <FormField hint="Hold Command or Ctrl to select more than one." label="Students doing well">
            <select className={`${inputClassName} h-28`} multiple onChange={(event) => setForm((current) => ({ ...current, studentsDoingWell: selectedValues(event) }))} value={form.studentsDoingWell}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </FormField>
          <FormField hint="Hold Command or Ctrl to select more than one." label="Students at risk">
            <select className={`${inputClassName} h-28`} multiple onChange={(event) => setForm((current) => ({ ...current, studentsAtRisk: selectedValues(event) }))} value={form.studentsAtRisk}>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </FormField>
          <div className="lg:col-span-2">
            <FormField label="Assignment completion summary">
              <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, assignmentCompletionSummary: event.target.value }))} value={form.assignmentCompletionSummary} />
            </FormField>
          </div>
          <FormField label="Attendance concerns">
            <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, attendanceConcerns: event.target.value }))} value={form.attendanceConcerns} />
          </FormField>
          <FormField label="Observations">
            <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))} value={form.observations} />
          </FormField>
          <FormField label="Recommendations">
            <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, recommendations: event.target.value }))} value={form.recommendations} />
          </FormField>
          <div className="lg:col-span-3">
            <FormField label="Support needed">
              <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, supportNeeded: event.target.value }))} value={form.supportNeeded} />
            </FormField>
          </div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="lg:col-span-3">
            <Button disabled={isSubmitting} icon={Plus} type="submit">{isSubmitting ? "Submitting..." : "Submit report"}</Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "period", header: "Period" },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
          { key: "activeStudentCount", header: "Active students" },
          { key: "studentsAtRisk", header: "At risk", render: (row) => row.studentsAtRisk?.length || 0 },
          { key: "submittedAt", header: "Submitted", render: (row) => formatDateTime(row.submittedAt || row.createdAt) },
          { key: "supportNeeded", header: "Support needed", wrap: true, render: (row) => row.supportNeeded || "None listed" }
        ]}
        emptyDescription="Mentor reports will be listed here after submission."
        emptyTitle="No reports submitted"
        rows={reports}
      />
    </div>
  );
}

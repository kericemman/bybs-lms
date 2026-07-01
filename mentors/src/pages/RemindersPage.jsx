import { Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

const targetOptions = [
  { value: "notSubmitted", label: "Students who have not submitted" },
  { value: "lateSubmission", label: "Students with late submissions" },
  { value: "needsRevision", label: "Students needing revision" },
  { value: "allAssigned", label: "All assigned students in the cohort" }
];

function initialForm() {
  return {
    assignment: "",
    target: "notSubmitted",
    title: "",
    message: ""
  };
}

function reminderMessage(assignment) {
  if (!assignment) {
    return "Please complete and submit your assignment. Reach out if you are blocked or need clarification.";
  }

  return `Please complete and submit "${assignment.title}" by ${formatDate(assignment.dueDate)}. Reach out if you are blocked or need clarification.`;
}

export function RemindersPage() {
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    mentorApi
      .listAssignments({ status: "published" })
      .then((response) => {
        setAssignments(response.data);
        const firstAssignment = response.data[0];
        setForm((current) => ({
          ...current,
          assignment: current.assignment || firstAssignment?._id || "",
          message: current.message || reminderMessage(firstAssignment)
        }));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment._id === form.assignment),
    [assignments, form.assignment]
  );

  function updateAssignment(assignmentId) {
    const assignment = assignments.find((item) => item._id === assignmentId);
    setForm((current) => ({
      ...current,
      assignment: assignmentId,
      title: current.title || (assignment ? `Reminder: ${assignment.title}` : ""),
      message: reminderMessage(assignment)
    }));
  }

  async function submitReminder(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      const response = await mentorApi.sendAssignmentReminder({
        assignment: form.assignment,
        target: form.target,
        title: form.title.trim(),
        message: form.message.trim()
      });
      setFeedback(`Reminder sent to ${response.data.sent} student(s).`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Send focused reminders so students complete, revise, and submit assignments on time."
        title="Assignment reminders"
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitReminder}>
          <FormField label="Assignment">
            <select className={inputClassName} onChange={(event) => updateAssignment(event.target.value)} required value={form.assignment}>
              <option value="">Choose assignment</option>
              {assignments.map((assignment) => (
                <option key={assignment._id} value={assignment._id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Reminder target">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} value={form.target}>
              {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField label="Reminder title">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={selectedAssignment ? `Reminder: ${selectedAssignment.title}` : "Reminder title"}
              value={form.title}
            />
          </FormField>
          <div className="lg:col-span-3">
            <FormField label="Message">
              <textarea
                className={`${textAreaClassName} min-h-32`}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                required
                value={form.message}
              />
            </FormField>
          </div>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}

          <div className="lg:col-span-3">
            <Button disabled={isSubmitting || !assignments.length} icon={Send} type="submit">
              {isSubmitting ? "Sending..." : "Send reminder"}
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Assignment", wrap: true },
          { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
          { key: "dueDate", header: "Due", render: (row) => formatDate(row.dueDate) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> }
        ]}
        emptyDescription="Published assignments will appear here after session work is posted."
        emptyTitle="No published assignments"
        rows={assignments}
      />
    </div>
  );
}

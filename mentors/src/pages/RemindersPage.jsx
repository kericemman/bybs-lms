import { Pencil, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddToCalendarButton, Button, Card, DataTable, PageHeader, SectionHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

const targetOptions = [
  { value: "notSubmitted", label: "Mentees who have not submitted" },
  { value: "lateSubmission", label: "Mentees with late submissions" },
  { value: "needsRevision", label: "Mentees needing revision" },
  { value: "allAssigned", label: "All assigned mentees in the cohort" }
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

function targetLabel(value) {
  return targetOptions.find((option) => option.value === value)?.label || value || "Selected mentees";
}

function htmlToText(value = "") {
  const html = String(value || "");
  if (!html) return "";

  if (typeof document === "undefined") {
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  element.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  return element.textContent.trim();
}

function deliveryText(delivery = {}) {
  return `${delivery.sent || 0} sent, ${delivery.failed || 0} failed, ${delivery.notConfigured || 0} not configured`;
}

function assignmentCalendarEvent(assignment) {
  if (!assignment?.dueDate) return {};

  return {
    allDay: true,
    id: assignment._id,
    title: `BYBS assignment due: ${assignment.title}`,
    description: `${assignment.module?.title || "Assignment"} deadline for mentees.`,
    startsAt: assignment.dueDate
  };
}

export function RemindersPage() {
  const [assignments, setAssignments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [editingReminder, setEditingReminder] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadData() {
    const [assignmentResponse, reminderResponse] = await Promise.all([
      mentorApi.listAssignments({ status: "published" }),
      mentorApi.listAssignmentReminders()
    ]);
    setAssignments(assignmentResponse.data);
    setReminders(reminderResponse.data);
    const firstAssignment = assignmentResponse.data[0];
    setForm((current) => ({
      ...current,
      assignment: current.assignment || firstAssignment?._id || "",
      message: current.message || reminderMessage(firstAssignment)
    }));
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, []);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment._id === form.assignment),
    [assignments, form.assignment]
  );

  function updateAssignment(assignmentId) {
    if (editingReminder) return;

    const assignment = assignments.find((item) => item._id === assignmentId);
    setForm((current) => ({
      ...current,
      assignment: assignmentId,
      title: current.title || (assignment ? `Reminder: ${assignment.title}` : ""),
      message: reminderMessage(assignment)
    }));
  }

  function startEdit(reminder) {
    setEditingReminder(reminder);
    setForm({
      assignment: reminder.assignment?._id || reminder.assignment || "",
      target: reminder.target || "allAssigned",
      title: reminder.title || "",
      message: htmlToText(reminder.message)
    });
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    const firstAssignment = assignments[0];
    setEditingReminder(null);
    setForm({
      ...initialForm(),
      assignment: firstAssignment?._id || "",
      message: reminderMessage(firstAssignment)
    });
    setError("");
    setFeedback("");
  }

  async function submitReminder(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      if (editingReminder) {
        await mentorApi.updateAssignmentReminder(editingReminder._id, {
          title: form.title.trim(),
          message: form.message.trim()
        });
        setFeedback("Reminder updated. In-app copies were updated; delivered emails cannot be recalled.");
        cancelEdit();
      } else {
        const response = await mentorApi.sendAssignmentReminder({
          assignment: form.assignment,
          target: form.target,
          title: form.title.trim(),
          message: form.message.trim()
        });
        setFeedback(`Reminder sent to ${response.data.sent} mentee(s).`);
      }

      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveReminder(reminder) {
    setError("");
    setFeedback("");

    if (!window.confirm(`Archive "${reminder.title}"? This removes the in-app reminder copies, but already delivered emails cannot be recalled.`)) return;

    try {
      await mentorApi.deleteAssignmentReminder(reminder._id);
      setFeedback("Reminder archived. In-app copies were removed from mentee notifications.");
      if (editingReminder?._id === reminder._id) cancelEdit();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Send focused reminders so mentees complete, revise, and submit assignments on time."
        title="Assignment reminders"
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitReminder}>
          {editingReminder ? (
            <div className="rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase text-bybs-blue">Editing sent reminder</p>
                  <p className="mt-1 text-sm text-bybs-body">
                    Updates change platform notifications only. Already delivered emails cannot be recalled.
                  </p>
                </div>
                <Button icon={X} onClick={cancelEdit} size="sm" type="button" variant="secondary">
                  Cancel edit
                </Button>
              </div>
            </div>
          ) : null}
          <FormField label="Assignment">
            <select className={inputClassName} disabled={Boolean(editingReminder)} onChange={(event) => updateAssignment(event.target.value)} required value={form.assignment}>
              <option value="">Choose assignment</option>
              {assignments.map((assignment) => (
                <option key={assignment._id} value={assignment._id}>
                  {assignment.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Reminder target">
            <select className={inputClassName} disabled={Boolean(editingReminder)} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} value={form.target}>
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
              {isSubmitting ? "Saving..." : editingReminder ? "Update reminder" : "Send reminder"}
            </Button>
            {editingReminder ? (
              <Button className="ml-2" icon={X} onClick={cancelEdit} type="button" variant="secondary">
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <SectionHeader
          description="Edit or archive platform reminder copies. Email copies that were already delivered cannot be recalled."
          title="Sent reminders"
        />
        <DataTable
          columns={[
            { key: "title", header: "Reminder", wrap: true },
            { key: "assignment", header: "Assignment", render: (row) => row.assignment?.title || "Assignment" },
            { key: "target", header: "Target", render: (row) => targetLabel(row.target) },
            { key: "recipientCount", header: "Recipients" },
            { key: "emailDelivery", header: "Email", render: (row) => deliveryText(row.emailDelivery) },
            { key: "sentAt", header: "Sent", render: (row) => formatDate(row.sentAt || row.createdAt) },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  {row.assignment?.dueDate ? (
                    <AddToCalendarButton event={assignmentCalendarEvent(row.assignment)} fileName={`bybs-assignment-${row.assignment._id || row._id}`} />
                  ) : null}
                  <Button icon={Pencil} onClick={() => startEdit(row)} size="sm" type="button" variant="secondary">
                    Edit
                  </Button>
                  <Button icon={Trash2} onClick={() => archiveReminder(row)} size="sm" type="button" variant="danger">
                    Delete
                  </Button>
                </div>
              )
            }
          ]}
          emptyDescription="Sent assignment reminders will appear here."
          emptyTitle="No reminders sent"
          rows={reminders}
        />
      </Card>

      <DataTable
        columns={[
          { key: "title", header: "Assignment", wrap: true },
          { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
          { key: "dueDate", header: "Due", render: (row) => formatDate(row.dueDate) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "calendar",
            header: "Calendar",
            render: (row) => <AddToCalendarButton event={assignmentCalendarEvent(row)} fileName={`bybs-assignment-${row._id}`} />
          }
        ]}
        emptyDescription="Published assignments will appear here after session work is posted."
        emptyTitle="No published assignments"
        rows={assignments}
      />
    </div>
  );
}

import { Download, Mail, Plus, Save, Upload, X } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, DataTable, PageHeader, PhoneInput, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { generateTemporaryPassword } from "../utils/passwords.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "removed", label: "Removed" },
  { value: "completed", label: "Completed" }
];

function createInitialForm() {
  return {
    name: "",
    email: "",
    phone: "",
    password: generateTemporaryPassword(),
    role: "student",
    cohort: "",
    mentor: "",
    status: "active"
  };
}

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function mentorBelongsToCohort(mentor, cohort) {
  const cohortId = idFor(cohort);
  if (!mentor || !cohortId) return true;

  const cohortMentorIds = new Set((cohort?.mentors || []).map(idFor));
  return idFor(mentor.cohort) === cohortId || cohortMentorIds.has(idFor(mentor));
}

function parseCsvPreview(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      preview: 1,
      skipEmptyLines: "greedy",
      complete: resolve,
      error: reject
    });
  });
}

function welcomeEmailMessage(meta = {}) {
  const mentorText =
    typeof meta.assignedMentorCount === "number"
      ? ` Assigned to ${meta.assignedMentorCount} cohort mentor(s).`
      : "";
  if (meta.welcomeEmailStatus === "sent") return `Mentee added and login email sent.${mentorText}`;
  if (meta.welcomeEmailStatus === "notConfigured") return `Mentee added. Login email was not sent because email delivery is not configured.${mentorText}`;
  if (meta.welcomeEmailStatus === "failed") return `Mentee added, but the login email failed. ${meta.welcomeEmailError || ""}${mentorText}`.trim();
  return "Mentee added.";
}

function resendWelcomeEmailMessage(student, meta = {}) {
  if (meta.welcomeEmailStatus === "sent") return `Login email resent to ${student.name} with a new temporary password.`;
  if (meta.welcomeEmailStatus === "notConfigured") return "Login email was not sent because email delivery is not configured.";
  if (meta.welcomeEmailStatus === "failed") return `Login email failed. ${meta.welcomeEmailError || "The existing password was kept."}`.trim();
  return "Login email resend was requested.";
}

export function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(() => createInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [resendingId, setResendingId] = useState("");
  const canDelete = canDeleteOperationalRecords(user);
  const visibleStatusOptions = canDelete ? statusOptions : statusOptions.filter((status) => status.value !== "removed");
  const selectedCohort = cohorts.find((cohort) => idFor(cohort) === form.cohort);
  const availablePrimaryMentors = form.cohort
    ? mentors.filter((mentor) => mentorBelongsToCohort(mentor, selectedCohort))
    : mentors;

  async function loadData() {
    const [studentResponse, cohortResponse, mentorResponse] = await Promise.all([
      adminApi.listStudents(filters),
      adminApi.listCohorts(),
      adminApi.listMentors()
    ]);
    setStudents(studentResponse.data);
    setCohorts(cohortResponse.data);
    setMentors(mentorResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setIsFormOpen(false);
  }

  function startEdit(student) {
    setEditingId(student.id);
    setIsFormOpen(true);
    setForm({
      name: student.name || "",
      email: student.email || "",
      phone: student.phone || "",
      password: "",
      role: "student",
      cohort: student.cohort?._id || "",
      mentor: student.mentor?.id || student.mentor?._id || "",
      status: student.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(student) {
    setError("");
    setFeedback("");

    try {
      await adminApi.deleteUser(student.id);
      setFeedback(`${student.name} was removed.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleResendLogin(student) {
    setError("");
    setFeedback("");
    setResendingId(student.id);

    try {
      const response = await adminApi.resendUserWelcomeEmail(student.id);
      const message = resendWelcomeEmailMessage(student, response.meta);
      setFeedback(message);
      if (response.meta?.welcomeEmailStatus === "sent") {
        toast.success(message);
      } else {
        toast.error(message);
      }
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setResendingId("");
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("CSV imports must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsImporting(true);
    setError("");
    setFeedback("");

    try {
      const preview = await parseCsvPreview(file);
      const fields = (preview.meta?.fields || []).map((field) => field.trim().toLowerCase());

      if (!fields.includes("name") || !fields.includes("email")) {
        throw new Error("CSV must include name and email columns.");
      }

      const formData = new FormData();
      formData.append("file", file);
      const response = await adminApi.importStudents(formData);
      const { created, skipped, errors } = response.data;
      setFeedback(`Imported ${created.length} mentee(s). Skipped ${skipped.length}. Errors ${errors.length}.`);
      toast.success(`Imported ${created.length} mentee(s).`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        const { password, email, role, ...payload } = form;
        await adminApi.updateUser(editingId, payload);
        toast.success("Mentee updated.");
      } else {
        const response = await adminApi.createUser(form);
        const message = welcomeEmailMessage(response.meta);
        setFeedback(message);
        toast.success(message);
      }
      resetForm();
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
        actions={
          <>
            <Button icon={isFormOpen ? X : Plus} onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))} type="button" variant={isFormOpen ? "secondary" : "primary"}>
              {isFormOpen ? "Close form" : "Add mentee"}
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-bybs-border bg-white px-4 text-sm font-medium text-bybs-text shadow-sm hover:bg-bybs-pale">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {isImporting ? "Importing..." : "Import CSV"}
              <input accept=".csv,text/csv" className="sr-only" disabled={isImporting} onChange={handleImport} type="file" />
            </label>
          </>
        }
        description="Add mentees, assign cohorts and mentors, view progress, and manage account access."
        title="Mentees"
      />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      {!isFormOpen && error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {!isFormOpen && feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {isFormOpen ? (
      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <FormField label="Name"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></FormField>
          <FormField label="Email"><input className={inputClassName} disabled={Boolean(editingId)} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required type="email" value={form.email} /></FormField>
          <FormField label="Phone"><PhoneInput onChange={(phone) => setForm((current) => ({ ...current, phone }))} value={form.phone} /></FormField>
          {!editingId ? (
            <FormField label="Temporary password"><input className={inputClassName} minLength={12} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required value={form.password} /></FormField>
          ) : null}
          <FormField label="Cohort" hint="All active mentors linked to this cohort can see and support this mentee automatically.">
            <select
              className={inputClassName}
              onChange={(event) => {
                const nextCohort = cohorts.find((cohort) => cohort._id === event.target.value);
                setForm((current) => {
                  const currentMentor = mentors.find((mentor) => idFor(mentor) === current.mentor);
                  return {
                    ...current,
                    cohort: event.target.value,
                    mentor: mentorBelongsToCohort(currentMentor, nextCohort) ? current.mentor : ""
                  };
                });
              }}
              value={form.cohort}
            >
              <option value="">Unassigned</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Primary mentor (optional)" hint="Use this only when one mentor should be the main contact. Cohort mentors still get automatic access.">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, mentor: event.target.value }))} value={form.mentor}>
              <option value="">No primary mentor</option>
              {availablePrimaryMentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {visibleStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update mentee" : "Add mentee"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>
      ) : null}

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          { key: "cohortMentors", header: "Cohort mentors", render: (row) => row.cohortMentorCount ?? row.cohort?.mentors?.length ?? 0 },
          { key: "mentor", header: "Primary mentor", render: (row) => row.mentor?.name || "None" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <RowActions
                  confirmMessage={`Remove ${row.name}? Their account will be marked as removed.`}
                  deleteLabel="Remove"
                  onDelete={canDelete ? () => handleDelete(row) : undefined}
                  onEdit={() => startEdit(row)}
                />
                <Button
                  disabled={resendingId === row.id || row.status === "removed"}
                  icon={Mail}
                  onClick={() => handleResendLogin(row)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {resendingId === row.id ? "Sending..." : "Resend login"}
                </Button>
              </div>
            )
          }
        ]}
        rows={students}
      />
    </div>
  );
}

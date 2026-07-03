import { Download, Plus, Save, Upload, X } from "lucide-react";
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

export function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(() => createInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);
  const visibleStatusOptions = canDelete ? statusOptions : statusOptions.filter((status) => status.value !== "removed");

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
  }

  function startEdit(student) {
    setEditingId(student.id);
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
        await adminApi.createUser(form);
        toast.success("Mentee added.");
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
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-bybs-border bg-white px-4 text-sm font-medium text-bybs-text shadow-sm hover:bg-bybs-pale">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {isImporting ? "Importing..." : "Import CSV"}
            <input accept=".csv,text/csv" className="sr-only" disabled={isImporting} onChange={handleImport} type="file" />
          </label>
        }
        description="Add mentees, assign cohorts and mentors, view progress, and manage account access."
        title="Mentees"
      />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <FormField label="Name"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></FormField>
          <FormField label="Email"><input className={inputClassName} disabled={Boolean(editingId)} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required type="email" value={form.email} /></FormField>
          <FormField label="Phone"><PhoneInput onChange={(phone) => setForm((current) => ({ ...current, phone }))} value={form.phone} /></FormField>
          {!editingId ? (
            <FormField label="Temporary password"><input className={inputClassName} minLength={12} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required value={form.password} /></FormField>
          ) : null}
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value }))} value={form.cohort}>
              <option value="">Unassigned</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Mentor">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, mentor: event.target.value }))} value={form.mentor}>
              <option value="">Unassigned</option>
              {mentors.map((mentor) => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
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

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          { key: "mentor", header: "Mentor", render: (row) => row.mentor?.name || "Unassigned" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Remove ${row.name}? Their account will be marked as removed.`}
                deleteLabel="Remove"
                onDelete={canDelete ? () => handleDelete(row) : undefined}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={students}
      />
    </div>
  );
}

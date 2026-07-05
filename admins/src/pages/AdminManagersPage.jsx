import { Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, DataTable, PageHeader, PhoneInput, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { generateTemporaryPassword } from "../utils/passwords.js";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "removed", label: "Removed" }
];

function createInitialForm() {
  return {
    name: "",
    email: "",
    phone: "",
    password: generateTemporaryPassword(),
    role: "adminManager",
    status: "active",
    welcomeEmail: { send: true }
  };
}

function welcomeEmailMessage(meta = {}) {
  if (meta.welcomeEmailStatus === "sent") return "Admin manager added and login email sent.";
  if (meta.welcomeEmailStatus === "notConfigured") return "Admin manager added. Email was not sent because Resend is not configured.";
  if (meta.welcomeEmailStatus === "failed") return `Admin manager added, but the login email failed. ${meta.welcomeEmailError || ""}`.trim();
  return "Admin manager added.";
}

export function AdminManagersPage() {
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState(() => createInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "" });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadManagers() {
    const response = await adminApi.listAdminManagers(filters);
    setManagers(response.data);
  }

  useEffect(() => {
    loadManagers().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(createInitialForm());
    setEditingId(null);
    setIsFormOpen(false);
  }

  function startEdit(manager) {
    setError("");
    setFeedback("");
    setEditingId(manager.id);
    setIsFormOpen(true);
    setForm({
      name: manager.name || "",
      email: manager.email || "",
      phone: manager.phone || "",
      password: "",
      role: "adminManager",
      status: manager.status || "active",
      welcomeEmail: { send: false }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(manager) {
    setError("");
    setFeedback("");

    try {
      await adminApi.deleteUser(manager.id);
      setFeedback(`${manager.name} was marked as removed.`);
      toast.success(`${manager.name} was marked as removed.`);
      await loadManagers();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        const { email, password, role, welcomeEmail, ...payload } = form;
        await adminApi.updateUser(editingId, payload);
        setFeedback("Admin manager updated.");
        toast.success("Admin manager updated.");
      } else {
        const response = await adminApi.createUser(form);
        const message = welcomeEmailMessage(response.meta);
        setFeedback(message);
        toast.success(message);
      }

      resetForm();
      await loadManagers();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button icon={isFormOpen ? X : Plus} onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))} type="button" variant={isFormOpen ? "secondary" : "primary"}>
            {isFormOpen ? "Close form" : "Add manager"}
          </Button>
        }
        description="Create limited admin manager accounts for daily operations without giving system-level control."
        title="Admin managers"
      />

      {!isFormOpen && error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {!isFormOpen && feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {isFormOpen ? (
      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Name">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              value={form.name}
            />
          </FormField>
          <FormField label="Email">
            <input
              className={inputClassName}
              disabled={Boolean(editingId)}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
              value={form.email}
            />
          </FormField>
          <FormField label="Phone">
            <PhoneInput onChange={(phone) => setForm((current) => ({ ...current, phone }))} value={form.phone} />
          </FormField>
          <FormField label="Status">
            <select
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              value={form.status}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </FormField>
          {!editingId ? (
            <>
              <FormField label="Temporary password">
                <input
                  className={inputClassName}
                  minLength={12}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required
                  value={form.password}
                />
              </FormField>
              <label className="flex items-center gap-3 rounded-md border border-bybs-border bg-bybs-pale px-3 py-2 text-sm font-medium text-bybs-navy lg:col-span-3">
                <input
                  checked={form.welcomeEmail.send}
                  className="h-4 w-4 rounded border-bybs-border text-bybs-blue"
                  onChange={(event) => setForm((current) => ({ ...current, welcomeEmail: { send: event.target.checked } }))}
                  type="checkbox"
                />
                Send login email and require password change on first login
              </label>
            </>
          ) : null}
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-4">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">
              {isSubmitting ? "Saving..." : editingId ? "Update manager" : "Add manager"}
            </Button>
            {editingId ? (
              <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm sm:grid-cols-[220px_auto]">
        <select
          className={inputClassName}
          onChange={(event) => setFilters({ status: event.target.value })}
          value={filters.status}
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
        <Button icon={X} onClick={() => setFilters({ status: "" })} type="button" variant="secondary">
          Reset
        </Button>
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "email", header: "Email" },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          { key: "lastLogin", header: "Last login", render: (row) => row.lastLogin ? new Date(row.lastLogin).toLocaleString() : "Never" },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Remove ${row.name}? Their admin manager access will stop immediately.`}
                deleteLabel="Remove"
                onDelete={() => handleDelete(row)}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        emptyDescription="Admin manager accounts created by the super admin will appear here."
        emptyTitle="No admin managers yet"
        rows={managers}
      />
    </div>
  );
}

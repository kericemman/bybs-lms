import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, DataTable, PageHeader, PhoneInput, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { generateTemporaryPassword } from "../utils/passwords.js";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "removed", label: "Removed" }
];

const welcomeLinkFields = [
  { key: "websiteUrl", label: "Website link" },
  { key: "mentorWhatsappUrl", label: "Mentors WhatsApp link" },
  { key: "channelUrl", label: "Channel link" },
  { key: "instagramUrl", label: "Instagram link" },
  { key: "linkedInUrl", label: "LinkedIn link" },
  { key: "youtubeUrl", label: "YouTube link" },
  { key: "facebookUrl", label: "Facebook link" }
];

function createWelcomeEmailDefaults() {
  return {
    send: true,
    websiteUrl: "",
    mentorWhatsappUrl: "",
    channelUrl: "",
    instagramUrl: "",
    linkedInUrl: "",
    youtubeUrl: "",
    facebookUrl: ""
  };
}

function createInitialForm() {
  return {
    name: "",
    email: "",
    phone: "",
    password: generateTemporaryPassword(),
    role: "mentor",
    cohort: "",
    bio: "",
    expertise: "",
    status: "active",
    welcomeEmail: createWelcomeEmailDefaults()
  };
}

function welcomeEmailMessage(meta = {}) {
  if (meta.welcomeEmailStatus === "sent") {
    return "Mentor added and welcome email sent.";
  }

  if (meta.welcomeEmailStatus === "notConfigured") {
    return "Mentor added. Email was not sent because Resend is not configured.";
  }

  if (meta.welcomeEmailStatus === "failed") {
    return `Mentor added, but the welcome email failed. ${meta.welcomeEmailError || ""}`.trim();
  }

  return "Mentor added.";
}

export function MentorsPage() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(() => createInitialForm());
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canPermanentlyDelete = user?.role === "superAdmin";

  async function loadData() {
    const [mentorResponse, cohortResponse] = await Promise.all([
      adminApi.listMentors(filters),
      adminApi.listCohorts()
    ]);
    setMentors(mentorResponse.data);
    setCohorts(cohortResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(createInitialForm());
    setEditingId(null);
  }

  function startEdit(mentor) {
    setError("");
    setFeedback("");
    setEditingId(mentor.id);
    setForm({
      name: mentor.name || "",
      email: mentor.email || "",
      phone: mentor.phone || "",
      password: "",
      role: "mentor",
      cohort: mentor.cohort?._id || "",
      bio: mentor.bio || "",
      expertise: mentor.expertise?.join(", ") || "",
      status: mentor.status || "active",
      welcomeEmail: createWelcomeEmailDefaults()
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateWelcomeEmail(field, value) {
    setForm((current) => ({
      ...current,
      welcomeEmail: {
        ...createWelcomeEmailDefaults(),
        ...current.welcomeEmail,
        [field]: value
      }
    }));
  }

  async function handleDelete(mentor) {
    setError("");
    setFeedback("");

    try {
      await adminApi.deleteUser(mentor.id);
      setFeedback(`${mentor.name} was marked as removed.`);
      toast.success(`${mentor.name} was marked as removed.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    }
  }

  async function handlePermanentDelete(mentor) {
    setError("");
    setFeedback("");

    const confirmed = window.confirm(
      `Permanently delete ${mentor.name}? This cannot be undone and only works when the mentor has no history.`
    );

    if (!confirmed) return;

    try {
      await adminApi.permanentlyDeleteMentor(mentor.id);
      setFeedback(`${mentor.name} was permanently deleted.`);
      toast.success(`${mentor.name} was permanently deleted.`);
      await loadData();
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
      const expertise = form.expertise.split(",").map((item) => item.trim()).filter(Boolean);
      if (editingId) {
        const { password, email, role, welcomeEmail, ...payload } = { ...form, expertise };
        await adminApi.updateUser(editingId, payload);
        setFeedback("Mentor updated.");
        toast.success("Mentor updated.");
      } else {
        const response = await adminApi.createUser({ ...form, expertise });
        const message = welcomeEmailMessage(response.meta);
        setFeedback(message);
        toast.success(message);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
      toast.error(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader description="Manage mentor profiles, cohort assignments, availability, and activity." title="Mentors" />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <FormField label="Name"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required value={form.name} /></FormField>
          <FormField label="Email"><input className={inputClassName} disabled={Boolean(editingId)} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required type="email" value={form.email} /></FormField>
          <FormField label="Phone"><PhoneInput onChange={(phone) => setForm((current) => ({ ...current, phone }))} value={form.phone} /></FormField>
          {!editingId ? <FormField label="Temporary password"><input className={inputClassName} minLength={12} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required value={form.password} /></FormField> : null}
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value }))} value={form.cohort}>
              <option value="">Unassigned</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <FormField label="Expertise"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, expertise: event.target.value }))} placeholder="Leadership, finance, strategy" value={form.expertise} /></FormField>
          <div className="lg:col-span-3"><FormField label="Bio"><textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} value={form.bio} /></FormField></div>
          {!editingId ? (
            <div className="space-y-4 rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
              <label className="flex items-center gap-3 text-sm font-medium text-bybs-navy">
                <input
                  checked={form.welcomeEmail.send}
                  className="h-4 w-4 rounded border-bybs-border text-bybs-blue"
                  onChange={(event) => updateWelcomeEmail("send", event.target.checked)}
                  type="checkbox"
                />
                Send welcome email with login details
              </label>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {welcomeLinkFields.map((field) => (
                  <FormField key={field.key} label={field.label}>
                    <input
                      className={inputClassName}
                      disabled={!form.welcomeEmail.send}
                      onChange={(event) => updateWelcomeEmail(field.key, event.target.value)}
                      placeholder="https://"
                      type="url"
                      value={form.welcomeEmail[field.key]}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          ) : null}
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update mentor" : "Add mentor"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>

      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "phone", header: "Phone", render: (row) => formatInternationalPhone(row.phone) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Unassigned" },
          { key: "email", header: "Email" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <RowActions
                  confirmMessage={`Remove ${row.name}? Their account will be marked as removed.`}
                  deleteLabel="Remove"
                  onDelete={() => handleDelete(row)}
                  onEdit={() => startEdit(row)}
                />
                {canPermanentlyDelete && row.status === "removed" ? (
                  <Button
                    aria-label="Delete permanently"
                    icon={Trash2}
                    onClick={() => handlePermanentDelete(row)}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    Delete forever
                  </Button>
                ) : null}
              </div>
            )
          }
        ]}
        rows={mentors}
      />
    </div>
  );
}

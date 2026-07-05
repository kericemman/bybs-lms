import {
  Bold,
  Highlighter,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Mail,
  Minus,
  Quote,
  RotateCcw,
  Send,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ROLE_LABELS } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FormField, inputClassName, textAreaClassName } from "./FormField.jsx";
import { adminApi } from "../services/api.js";

const logoSrc = "/assets/Logo1.png";
const apiAssetBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api\/?$/, "");

const initialForm = {
  title: "",
  previewText: "",
  message: "",
  type: "announcement",
  channel: "both",
  targetType: "all",
  cohort: "",
  role: "student",
  recipient: "",
  ctaLabel: "",
  ctaUrl: ""
};

function isDisplayableImageSource(source = "") {
  return /^https?:\/\//i.test(source) || source.startsWith("/uploads/");
}

function displayImageSource(source = "") {
  return source.startsWith("/uploads/") ? `${apiAssetBaseUrl}${source}` : source;
}

function parseInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const value = match[0];

    if (value.startsWith("**")) {
      parts.push(<strong key={`${match.index}-bold`}>{value.slice(2, -2)}</strong>);
    } else if (value.startsWith("*")) {
      parts.push(<em key={`${match.index}-italic`}>{value.slice(1, -1)}</em>);
    } else {
      const label = value.slice(1, value.indexOf("]("));
      const href = value.slice(value.indexOf("](") + 2, -1);
      parts.push(
        <a className="font-medium text-bybs-blue underline" href={href} key={`${match.index}-link`}>
          {label}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function renderPreviewMessage(message) {
  const lines = message.trim()
    ? message.split("\n")
    : ["Welcome to the next BYBS update.", "", "- Add the key point here", "- Add the next action here"];

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div className="h-3" key={`space-${index}`} />;
    }

    const image = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      if (!isDisplayableImageSource(image[2])) return null;

      return (
        <figure className="mt-4 overflow-hidden rounded-md border border-bybs-border bg-white" key={`image-${index}`}>
          <img alt={image[1] || "Announcement image"} className="max-h-72 w-full object-cover" src={displayImageSource(image[2])} />
          {image[1] ? <figcaption className="px-3 py-2 text-xs text-bybs-muted">{image[1]}</figcaption> : null}
        </figure>
      );
    }

    if (trimmed === "---") {
      return <hr className="my-5 border-bybs-border" key={`divider-${index}`} />;
    }

    if (trimmed.startsWith("## ")) {
      return (
        <h3 className="mt-4 text-base font-semibold text-bybs-navy" key={`heading-${index}`}>
          {parseInline(trimmed.slice(3))}
        </h3>
      );
    }

    if (trimmed.startsWith("### ")) {
      return (
        <h4 className="mt-4 text-sm font-semibold text-bybs-blue" key={`subheading-${index}`}>
          {parseInline(trimmed.slice(4))}
        </h4>
      );
    }

    if (trimmed.startsWith("> ")) {
      return (
        <blockquote className="mt-4 border-l-4 border-bybs-rose bg-bybs-blush px-4 py-3 text-sm leading-6 text-bybs-body" key={`quote-${index}`}>
          {parseInline(trimmed.slice(2))}
        </blockquote>
      );
    }

    if (trimmed.startsWith("!! ")) {
      return (
        <p className="mt-4 rounded-md bg-bybs-gold/30 px-4 py-3 text-sm font-medium leading-6 text-bybs-navy" key={`highlight-${index}`}>
          {parseInline(trimmed.slice(3))}
        </p>
      );
    }

    if (trimmed.startsWith("- ")) {
      return (
        <div className="mt-2 flex gap-2 text-sm leading-6 text-bybs-body" key={`bullet-${index}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bybs-rose" />
          <span>{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    }

    const numbered = trimmed.match(/^\d+\.\s(.+)/);
    if (numbered) {
      return (
        <div className="mt-2 flex gap-2 text-sm leading-6 text-bybs-body" key={`number-${index}`}>
          <span className="font-semibold text-bybs-blue">{trimmed.slice(0, trimmed.indexOf(".") + 1)}</span>
          <span>{parseInline(numbered[1])}</span>
        </div>
      );
    }

    return (
      <p className="mt-3 text-sm leading-6 text-bybs-body" key={`line-${index}`}>
        {parseInline(trimmed)}
      </p>
    );
  });
}

function messageStartsWithGreeting(message = "") {
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return /^(hi|hello|dear)\b/i.test(firstLine || "");
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

function safeImageAlt(value = "Announcement image") {
  return value.replace(/[\[\]()]/g, "").slice(0, 80) || "Announcement image";
}

function managerSafeInitialForm() {
  return {
    ...initialForm,
    targetType: "role",
    role: "student"
  };
}

function deliveryFeedback(data) {
  if (data.emailDeliveryStatus === "sent") {
    return ` Email sent to ${data.emailSent || data.created} recipient(s).`;
  }

  if (data.emailDeliveryStatus === "notConfigured") {
    return " Email was not delivered because RESEND_API_KEY is not configured.";
  }

  if (data.emailDeliveryStatus === "failed") {
    return ` Email delivery failed for ${data.emailFailed || "some"} recipient(s).`;
  }

  if (data.emailDeliveryStatus === "notRequested") {
    return " Portal notification only.";
  }

  return "";
}

export function AnnouncementComposer({ title = "Compose email announcement", onCancel, onSent }) {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [cohorts, setCohorts] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdminManager = user?.role === "adminManager";

  useEffect(() => {
    let isMounted = true;

    Promise.all([adminApi.listCohorts(), adminApi.listUsers()])
      .then(([cohortResponse, userResponse]) => {
        if (!isMounted) return;
        setCohorts(cohortResponse.data);
        setUsers(userResponse.data);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdminManager) return;

    setForm((current) => ({
      ...current,
      targetType: current.targetType === "all" ? "role" : current.targetType,
      role: ["student", "mentor"].includes(current.role) ? current.role : "student",
      type: current.type === "system" ? "announcement" : current.type
    }));
  }, [isAdminManager]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(isAdminManager ? managerSafeInitialForm() : initialForm);
    setFeedback("");
    setError("");
  }

  function insertSnippet(before, after = "", placeholder = "text") {
    const editor = editorRef.current;
    const message = form.message;
    const start = editor?.selectionStart ?? message.length;
    const end = editor?.selectionEnd ?? message.length;
    const selected = message.slice(start, end) || placeholder;
    const nextMessage = `${message.slice(0, start)}${before}${selected}${after}${message.slice(end)}`;
    const nextCursor = start + before.length + selected.length + after.length;

    updateField("message", nextMessage);

    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function insertBlock(text) {
    const editor = editorRef.current;
    const message = form.message;
    const start = editor?.selectionStart ?? message.length;
    const before = message.slice(0, start);
    const after = message.slice(start);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n" : "";
    const nextMessage = `${before}${prefix}${text}${suffix}${after}`;
    const nextCursor = before.length + prefix.length + text.length;

    updateField("message", nextMessage);

    window.requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFeedback("");

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Announcement images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await adminApi.uploadResourceFile(formData);
      insertBlock(`![${safeImageAlt(response.data.originalName)}](${response.data.url})`);
      setFeedback(`${response.data.originalName || "Image"} added to the announcement.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  }

  function validateForm() {
    if (form.targetType === "cohort" && !form.cohort) return "Choose a cohort.";
    if (form.targetType === "user" && !form.recipient) return "Choose a recipient.";
    if (isAdminManager && form.targetType === "all") return "Admin managers must choose mentees, mentors, a cohort, or one recipient.";
    if (isAdminManager && form.targetType === "role" && !["student", "mentor"].includes(form.role)) return "Admin managers can only target mentees or mentors.";
    if (isAdminManager && form.type === "system") return "Admin managers cannot send system announcements.";
    if (form.ctaLabel && !form.ctaUrl) return "Add a CTA link or remove the CTA label.";
    if (form.ctaUrl && !form.ctaLabel) return "Add a CTA label or remove the CTA link.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await adminApi.createAnnouncement({
        ...form,
        title: form.title.trim(),
        previewText: form.previewText.trim(),
        message: form.message.trim(),
        ctaLabel: form.ctaLabel.trim(),
        ctaUrl: form.ctaUrl.trim()
      });

      setFeedback(`Announcement created for ${response.data.created} recipient(s).${deliveryFeedback(response.data)}`);
      setForm(isAdminManager ? managerSafeInitialForm() : initialForm);
      onSent?.(response.data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-bybs-blue">BYBS Email</p>
          <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={RotateCcw} onClick={resetForm} type="button" variant="secondary">
            Reset
          </Button>
          {onCancel ? (
            <Button icon={X} onClick={onCancel} type="button" variant="ghost">
              Close
            </Button>
          ) : null}
        </div>
      </div>

      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <FormField label="Email subject">
            <input
              className={inputClassName}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Important update for your BYBS journey"
              required
              value={form.title}
            />
          </FormField>
          <FormField label="Type">
            <select className={inputClassName} onChange={(event) => updateField("type", event.target.value)} value={form.type}>
              <option value="announcement">Announcement</option>
              <option value="assignment">Assignment</option>
              <option value="booking">Booking</option>
              <option value="support">Support</option>
              <option value="reminder">Reminder</option>
              {!isAdminManager ? <option value="system">System</option> : null}
            </select>
          </FormField>
          <FormField
            hint="Inbox delivery requires a configured Resend API key. Portal notices are always saved."
            label="Delivery"
          >
            <select className={inputClassName} onChange={(event) => updateField("channel", event.target.value)} value={form.channel}>
              <option value="both">Email template + portal notice</option>
              <option value="email">Email template</option>
              <option value="platform">Portal notice only</option>
            </select>
          </FormField>
          <FormField label="Target">
            <select
              className={inputClassName}
              onChange={(event) => updateField("targetType", event.target.value)}
              value={form.targetType}
            >
              {!isAdminManager ? <option value="all">All active users</option> : null}
              <option value="cohort">Cohort</option>
              <option value="role">Role</option>
              <option value="user">One user</option>
            </select>
          </FormField>
          {form.targetType === "cohort" ? (
            <FormField label="Cohort">
              <select className={inputClassName} onChange={(event) => updateField("cohort", event.target.value)} value={form.cohort}>
                <option value="">Choose cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort._id} value={cohort._id}>
                    {cohort.title}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          {form.targetType === "role" ? (
            <FormField label="Role">
              <select className={inputClassName} onChange={(event) => updateField("role", event.target.value)} value={form.role}>
                <option value="student">Mentees</option>
                <option value="mentor">Mentors</option>
                {!isAdminManager ? <option value="admin">Admins</option> : null}
                {!isAdminManager ? <option value="adminManager">Admin managers</option> : null}
                {!isAdminManager ? <option value="superAdmin">Super admins</option> : null}
              </select>
            </FormField>
          ) : null}
          {form.targetType === "user" ? (
            <FormField label="Recipient">
              <select className={inputClassName} onChange={(event) => updateField("recipient", event.target.value)} value={form.recipient}>
                <option value="">Choose user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({roleLabel(user.role)})
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <div className="lg:col-span-3">
            <FormField label="Preview text">
              <input
                className={inputClassName}
                onChange={(event) => updateField("previewText", event.target.value)}
                placeholder="Short summary shown before the email is opened"
                value={form.previewText}
              />
            </FormField>
          </div>
          <FormField label="CTA label">
            <input
              className={inputClassName}
              onChange={(event) => updateField("ctaLabel", event.target.value)}
              placeholder="Open mentee portal"
              value={form.ctaLabel}
            />
          </FormField>
          <div className="lg:col-span-2">
            <FormField label="CTA link">
              <input
                className={inputClassName}
                onChange={(event) => updateField("ctaUrl", event.target.value)}
                placeholder="https://example.com"
                type="url"
                value={form.ctaUrl}
              />
            </FormField>
          </div>
          <div className="lg:col-span-3">
            <label className="text-sm font-medium text-bybs-body" htmlFor="announcement-message">
              Message
            </label>
            <div className="mb-2 mt-1 flex flex-wrap gap-2">
              <Button icon={Heading2} onClick={() => insertSnippet("## ", "", "Section title")} size="sm" type="button" variant="secondary">
                Heading
              </Button>
              <Button icon={Heading3} onClick={() => insertSnippet("### ", "", "Small heading")} size="sm" type="button" variant="secondary">
                Subheading
              </Button>
              <Button icon={Bold} onClick={() => insertSnippet("**", "**", "bold text")} size="sm" type="button" variant="secondary">
                Bold
              </Button>
              <Button icon={Italic} onClick={() => insertSnippet("*", "*", "italic text")} size="sm" type="button" variant="secondary">
                Italic
              </Button>
              <Button icon={Quote} onClick={() => insertBlock("> Quote or testimonial text")} size="sm" type="button" variant="secondary">
                Quote
              </Button>
              <Button icon={Highlighter} onClick={() => insertBlock("!! Highlighted note or deadline")} size="sm" type="button" variant="secondary">
                Highlight
              </Button>
              <Button icon={List} onClick={() => insertSnippet("- ", "", "List item")} size="sm" type="button" variant="secondary">
                Bullet
              </Button>
              <Button icon={ListOrdered} onClick={() => insertSnippet("1. ", "", "List item")} size="sm" type="button" variant="secondary">
                Number
              </Button>
              <Button icon={Link} onClick={() => insertSnippet("[", "](https://example.com)", "link text")} size="sm" type="button" variant="secondary">
                Link
              </Button>
              <Button icon={Minus} onClick={() => insertBlock("---")} size="sm" type="button" variant="secondary">
                Divider
              </Button>
              <Button
                disabled={isUploadingImage}
                icon={Image}
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                type="button"
                variant="secondary"
              >
                {isUploadingImage ? "Adding..." : "Image"}
              </Button>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageChange}
                ref={fileInputRef}
                type="file"
              />
            </div>
            <textarea
              className={`${textAreaClassName} min-h-56`}
              id="announcement-message"
              onChange={(event) => updateField("message", event.target.value)}
              placeholder={"## This week's focus\n- Share the key update\n- Add the next step\n\nThank you for building with BYBS."}
              ref={editorRef}
              required
              value={form.message}
            />
          </div>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}

          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting} icon={Send} type="submit">
              {isSubmitting ? "Sending..." : "Send announcement"}
            </Button>
          </div>
        </div>

        <aside className="rounded-md border border-bybs-border bg-bybs-page p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-bybs-navy">
            <Mail className="h-4 w-4 text-bybs-blue" aria-hidden="true" />
            Email preview
          </div>
          <div className="overflow-hidden rounded-md border border-bybs-border bg-white">
            <div className="border-b border-bybs-border bg-white px-6 py-5 text-bybs-navy">
              <div className="flex items-center gap-3">
                <img alt="BYBS" className="h-14 w-14 rounded-md bg-white object-contain p-1" src={logoSrc} />
                <div>
                  <p className="text-sm font-bold">Build Your Best Self</p>
                  <p className="text-xs font-bold text-bybs-rose">Inspire, Heal, Evolve</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-bybs-muted">Learning Management System</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-6">
              <p className="text-xs font-semibold uppercase text-bybs-rose">{form.type}</p>
              <h3 className="mt-2 text-xl font-semibold text-bybs-navy">
                {form.title || "Your announcement subject"}
              </h3>
              {form.previewText ? <p className="mt-2 text-sm text-bybs-muted">{form.previewText}</p> : null}
              <div className="mt-5 border-t border-bybs-border pt-4">
                {!messageStartsWithGreeting(form.message) ? (
                  <p className="mt-0 text-sm leading-6 text-bybs-body">Hi {form.targetType === "role" ? roleLabel(form.role) : "First name"},</p>
                ) : null}
                {renderPreviewMessage(form.message)}
              </div>
              {form.ctaLabel && form.ctaUrl ? (
                <a
                  className="mt-6 inline-flex rounded-md bg-bybs-blue px-4 py-2 text-sm font-semibold text-white"
                  href={form.ctaUrl}
                >
                  {form.ctaLabel}
                </a>
              ) : null}
            </div>
            <div className="border-t border-bybs-border bg-bybs-pale px-6 py-4 text-xs leading-5 text-bybs-muted">
              <p className="font-medium text-bybs-navy">BYBS LMS</p>
              <p>You are receiving this because you are part of the Build Your Best Self learning community.</p>
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}

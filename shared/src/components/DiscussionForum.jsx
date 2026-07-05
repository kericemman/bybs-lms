import { MessageSquare, Plus, RefreshCw, Search, Send, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { SafeHtml } from "./SafeHtml.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { ROLE_LABELS } from "../constants/roles.js";

const inputClassName =
  "h-10 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textAreaClassName =
  "min-h-28 w-full resize-y rounded-md border border-bybs-border px-3 py-2 text-sm leading-6 outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

const contentClassName =
  "break-words text-sm leading-6 text-bybs-body [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1";

export const DISCUSSION_AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "mentorsAdmins", label: "Mentors + Admins" },
  { value: "mentorsOnly", label: "Mentors only" },
  { value: "mentorsMentees", label: "Mentors + Mentees" }
];

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function authorName(user) {
  return user?.name || user?.email || "BYBS member";
}

function authorInitials(user) {
  const name = authorName(user);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "B"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function authorRole(user) {
  return user?.role ? ROLE_LABELS[user.role] || user.role : "BYBS member";
}

function audienceLabel(value = "all") {
  return DISCUSSION_AUDIENCE_OPTIONS.find((option) => option.value === value)?.label || "Everyone";
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeChatHref(value = "") {
  const withProtocol = /^www\./i.test(value) ? `https://${value}` : value;

  try {
    const url = new URL(withProtocol);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function splitTrailingPunctuation(value = "") {
  const match = String(value).match(/^(.+?)([.,!?;:)]+)?$/);
  return {
    linkText: match?.[1] || value,
    trailing: match?.[2] || ""
  };
}

function chatTextToHtml(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const urlPattern = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let output = "";
      let lastIndex = 0;

      for (const match of line.matchAll(urlPattern)) {
        const rawUrl = match[0];
        const { linkText, trailing } = splitTrailingPunctuation(rawUrl);
        const href = safeChatHref(linkText);

        output += escapeHtml(line.slice(lastIndex, match.index));
        output += href
          ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(linkText)}</a>${escapeHtml(trailing)}`
          : escapeHtml(rawUrl);
        lastIndex = match.index + rawUrl.length;
      }

      output += escapeHtml(line.slice(lastIndex));
      return output;
    })
    .join("<br />");
}

function uniqueCohorts({ modules = [], discussions = [] }) {
  const cohorts = new Map();

  [...modules.map((module) => module.cohort), ...discussions.map((discussion) => discussion.cohort)]
    .filter(Boolean)
    .forEach((cohort) => {
      const id = idFor(cohort);
      if (id && !cohorts.has(id)) {
        cohorts.set(id, cohort);
      }
    });

  return Array.from(cohorts.values());
}

function emptyForm() {
  return {
    title: "",
    body: "",
    cohort: "",
    module: "",
    audience: "all"
  };
}

function AuthorAvatar({ user, size = "md" }) {
  const sizeClassName = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";

  if (user?.profileImage) {
    return (
      <img
        alt={authorName(user)}
        className={`${sizeClassName} shrink-0 rounded-full border border-bybs-border object-cover`}
        src={user.profileImage}
      />
    );
  }

  return (
    <span className={`${sizeClassName} inline-flex shrink-0 items-center justify-center rounded-full border border-bybs-border bg-bybs-pale font-semibold text-bybs-blue`}>
      {authorInitials(user) || <UserRound className="h-4 w-4" aria-hidden="true" />}
    </span>
  );
}

function AuthorButton({ children, user }) {
  return (
    <button
      className="inline-flex max-w-full items-center gap-3 rounded-md text-left transition hover:bg-bybs-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-pale"
      onClick={() => children(user)}
      type="button"
    >
      <AuthorAvatar user={user} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-bybs-navy">{authorName(user)}</span>
        <span className="block truncate text-xs text-bybs-muted">{authorRole(user)}</span>
      </span>
    </button>
  );
}

function ProfileModal({ onClose, user }) {
  if (!user) return null;

  const aboutHtml = user.bio || user.about || user.profile?.bio || "";
  const expertise = Array.isArray(user.expertise) ? user.expertise.filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-lg border border-bybs-border bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <AuthorAvatar user={user} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-bybs-navy">{authorName(user)}</h2>
              <p className="text-sm text-bybs-muted">{authorRole(user)}</p>
            </div>
          </div>
          <Button aria-label="Close profile" icon={X} onClick={onClose} size="icon" type="button" variant="ghost" />
        </div>

        {aboutHtml ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-bybs-muted">About</p>
            <SafeHtml className={`mt-2 ${contentClassName}`} html={aboutHtml} />
          </div>
        ) : (
          <p className="mt-5 rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">
            No about section has been added yet.
          </p>
        )}

        {expertise.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {expertise.map((item) => (
              <span className="rounded-md bg-bybs-pale px-2 py-1 text-xs font-medium text-bybs-blue" key={item}>
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DiscussionForum({
  api,
  canChooseAudience = false,
  createDescription = "Start a focused thread for cohort questions, reflections, resources, and support.",
  description,
  emptyDescription = "Forum discussions will appear here once someone starts a thread.",
  showCohortField = false,
  showModuleField = false,
  title = "Forum"
}) {
  const [discussions, setDiscussions] = useState([]);
  const [modules, setModules] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", cohort: "", module: "" });
  const [form, setForm] = useState(() => emptyForm());
  const [activeReplyId, setActiveReplyId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [profileUser, setProfileUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  async function loadData() {
    setIsLoading(true);
    const shouldLoadModules = api.listModules && (showCohortField || showModuleField);
    const [discussionResponse, moduleResponse] = await Promise.all([
      api.listDiscussions(filters),
      shouldLoadModules ? api.listModules() : Promise.resolve({ data: [] })
    ]);
    setDiscussions(discussionResponse.data);
    setModules(moduleResponse.data || []);
    setIsLoading(false);
  }

  useEffect(() => {
    loadData().catch((requestError) => {
      setIsLoading(false);
      setError(requestError.message);
    });
  }, [filters.search, filters.status, filters.cohort, filters.module]);

  const cohorts = useMemo(() => uniqueCohorts({ modules, discussions }), [modules, discussions]);
  const formModules = useMemo(
    () => (form.cohort ? modules.filter((module) => idFor(module.cohort) === form.cohort) : modules),
    [form.cohort, modules]
  );
  const filterModules = useMemo(
    () => (filters.cohort ? modules.filter((module) => idFor(module.cohort) === filters.cohort) : modules),
    [filters.cohort, modules]
  );

  function updateForm(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "cohort") {
        next.module = "";
      }
      if (name === "module" && value) {
        const selectedModule = modules.find((module) => idFor(module) === value);
        if (selectedModule?.cohort) {
          next.cohort = idFor(selectedModule.cohort);
        }
      }
      return next;
    });
  }

  function updateFilters(name, value) {
    setFilters((current) => {
      const next = { ...current, [name]: value };
      if (name === "cohort") {
        next.module = "";
      }
      return next;
    });
  }

  async function createDiscussion(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsCreating(true);

    try {
      const payload = {
        title: form.title,
        body: chatTextToHtml(form.body)
      };
      if (form.module) payload.module = form.module;
      if (showCohortField && form.cohort) payload.cohort = form.cohort;
      if (canChooseAudience) payload.audience = form.audience || "all";

      await api.createDiscussion(payload);
      setForm(emptyForm());
      setFeedback("Discussion started.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function sendReply(discussion) {
    setError("");
    setFeedback("");
    setIsReplying(true);

    try {
      await api.replyDiscussion(idFor(discussion), { body: chatTextToHtml(replyBody) });
      setReplyBody("");
      setActiveReplyId("");
      setFeedback("Reply posted.");
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button icon={RefreshCw} onClick={() => loadData().catch((requestError) => setError(requestError.message))} type="button" variant="secondary">
            Refresh
          </Button>
        }
        description={description}
        title={title}
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={createDiscussion}>
          <div className="lg:col-span-4">
            <p className="text-sm font-semibold text-bybs-navy">Start a discussion</p>
            <p className="mt-1 text-sm text-bybs-body">{createDescription}</p>
          </div>
          <label className={!showCohortField && !showModuleField && !canChooseAudience ? "block lg:col-span-4" : "block lg:col-span-2"}>
            <span className="text-sm font-medium text-bybs-body">Title</span>
            <input
              className={`${inputClassName} mt-1`}
              onChange={(event) => updateForm("title", event.target.value)}
              required
              value={form.title}
            />
          </label>
          {canChooseAudience ? (
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Who can see this?</span>
              <select className={`${inputClassName} mt-1`} onChange={(event) => updateForm("audience", event.target.value)} value={form.audience}>
                {DISCUSSION_AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          {showCohortField ? (
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Cohort</span>
              <select className={`${inputClassName} mt-1`} onChange={(event) => updateForm("cohort", event.target.value)} value={form.cohort}>
                <option value="">Auto / choose cohort</option>
                {cohorts.map((cohort) => (
                  <option key={idFor(cohort)} value={idFor(cohort)}>{cohort.title || "Cohort"}</option>
                ))}
              </select>
            </label>
          ) : null}
          {showModuleField ? (
            <label className={showCohortField ? "block" : "block lg:col-span-2"}>
              <span className="text-sm font-medium text-bybs-body">Module</span>
              <select className={`${inputClassName} mt-1`} onChange={(event) => updateForm("module", event.target.value)} value={form.module}>
                <option value="">General discussion</option>
                {formModules.map((module) => (
                  <option key={idFor(module)} value={idFor(module)}>{module.title}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="lg:col-span-4">
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Message</span>
              <textarea
                className={`${textAreaClassName} mt-1`}
                onChange={(event) => updateForm("body", event.target.value)}
                placeholder="Share the question, update, reflection, or resource."
                value={form.body}
              />
            </label>
          </div>
          <div className="lg:col-span-4">
            <Button disabled={isCreating} icon={Plus} type="submit">
              {isCreating ? "Starting..." : "Start discussion"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-bybs-body">Search</span>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-bybs-muted" />
            <input
              className={`${inputClassName} pl-9`}
              onChange={(event) => updateFilters("search", event.target.value)}
              placeholder="Search discussions"
              value={filters.search}
            />
          </div>
        </label>
        {showCohortField ? (
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Cohort</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => updateFilters("cohort", event.target.value)} value={filters.cohort}>
              <option value="">All cohorts</option>
              {cohorts.map((cohort) => (
                <option key={idFor(cohort)} value={idFor(cohort)}>{cohort.title || "Cohort"}</option>
              ))}
            </select>
          </label>
        ) : null}
        {showModuleField ? (
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Module</span>
            <select className={`${inputClassName} mt-1`} onChange={(event) => updateFilters("module", event.target.value)} value={filters.module}>
              <option value="">All modules</option>
              {filterModules.map((module) => (
                <option key={idFor(module)} value={idFor(module)}>{module.title}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-bybs-body">Status</span>
          <select className={`${inputClassName} mt-1`} onChange={(event) => updateFilters("status", event.target.value)} value={filters.status}>
            <option value="">Open and closed</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
          Loading discussions...
        </div>
      ) : !discussions.length ? (
        <EmptyState description={emptyDescription} icon={MessageSquare} title="No discussions yet" />
      ) : (
        <div className="space-y-4">
          {discussions.map((discussion) => (
            <article className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm" key={idFor(discussion)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-bybs-navy">{discussion.title}</h2>
                    <StatusBadge status={discussion.status} />
                    <span className="rounded-md bg-bybs-pale px-2 py-1 text-xs font-medium text-bybs-blue">
                      {audienceLabel(discussion.audience)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-bybs-body">
                    {discussion.module?.title || discussion.cohort?.title || "Open forum"}
                  </p>
                  <div className="mt-3">
                    <AuthorButton user={discussion.createdBy}>{setProfileUser}</AuthorButton>
                    <p className="mt-1 text-xs text-bybs-muted">{formatDateTime(discussion.createdAt)}</p>
                  </div>
                </div>
                <span className="rounded-md bg-bybs-pale px-3 py-1 text-xs font-medium text-bybs-blue">
                  {discussion.comments?.length || 0} replies
                </span>
              </div>

              {discussion.body ? <SafeHtml className={`mt-4 ${contentClassName}`} html={discussion.body} /> : null}

              {discussion.comments?.length ? (
                <div className="mt-5 space-y-3 border-t border-bybs-border pt-4">
                  {discussion.comments.map((comment) => (
                    <div className="rounded-md bg-bybs-pale p-4" key={comment._id || comment.createdAt}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <AuthorButton user={comment.createdBy}>{setProfileUser}</AuthorButton>
                        <p className="text-xs text-bybs-muted">{formatDateTime(comment.createdAt)}</p>
                      </div>
                      <SafeHtml className={`mt-2 ${contentClassName}`} html={comment.body} />
                    </div>
                  ))}
                </div>
              ) : null}

              {discussion.status === "open" ? (
                <div className="mt-5 border-t border-bybs-border pt-4">
                  {activeReplyId === idFor(discussion) ? (
                    <div className="space-y-3">
                      <textarea
                        className={textAreaClassName}
                        onChange={(event) => setReplyBody(event.target.value)}
                        placeholder="Write your reply..."
                        value={replyBody}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={isReplying} icon={Send} onClick={() => sendReply(discussion)} type="button">
                          {isReplying ? "Posting..." : "Post reply"}
                        </Button>
                        <Button icon={X} onClick={() => { setActiveReplyId(""); setReplyBody(""); }} type="button" variant="secondary">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button icon={Send} onClick={() => { setActiveReplyId(idFor(discussion)); setReplyBody(""); }} size="sm" type="button" variant="secondary">
                      Reply
                    </Button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <ProfileModal onClose={() => setProfileUser(null)} user={profileUser} />
    </div>
  );
}

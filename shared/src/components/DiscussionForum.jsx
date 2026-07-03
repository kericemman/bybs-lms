import { MessageSquare, Plus, RefreshCw, Search, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { RichTextEditor } from "./RichTextEditor.jsx";
import { SafeHtml } from "./SafeHtml.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const inputClassName =
  "h-10 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

const contentClassName =
  "text-sm leading-6 text-bybs-body [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1";

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function authorName(user) {
  return user?.name || user?.email || "BYBS member";
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
    module: ""
  };
}

export function DiscussionForum({
  api,
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
        body: form.body
      };
      if (form.module) payload.module = form.module;
      if (showCohortField && form.cohort) payload.cohort = form.cohort;

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
      await api.replyDiscussion(idFor(discussion), { body: replyBody });
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
          <label className={!showCohortField && !showModuleField ? "block lg:col-span-4" : "block lg:col-span-2"}>
            <span className="text-sm font-medium text-bybs-body">Title</span>
            <input
              className={`${inputClassName} mt-1`}
              onChange={(event) => updateForm("title", event.target.value)}
              required
              value={form.title}
            />
          </label>
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
            <span className="text-sm font-medium text-bybs-body">Prompt</span>
            <div className="mt-1">
              <RichTextEditor
                id="discussion-body"
                minHeightClassName="min-h-32"
                onChange={(value) => updateForm("body", value)}
                placeholder="Share the question, update, reflection, or resource."
                value={form.body}
              />
            </div>
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
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-bybs-navy">{discussion.title}</h2>
                    <StatusBadge status={discussion.status} />
                  </div>
                  <p className="mt-1 text-sm text-bybs-body">
                    {discussion.module?.title || discussion.cohort?.title || "Open forum"}
                  </p>
                  <p className="mt-1 text-xs text-bybs-muted">
                    Started by {authorName(discussion.createdBy)} · {formatDateTime(discussion.createdAt)}
                  </p>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-bybs-navy">{authorName(comment.createdBy)}</p>
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
                      <RichTextEditor
                        id={`reply-${idFor(discussion)}`}
                        minHeightClassName="min-h-28"
                        onChange={setReplyBody}
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
    </div>
  );
}

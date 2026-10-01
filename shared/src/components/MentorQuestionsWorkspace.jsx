import {
  CheckCircle2,
  MessageCircleQuestion,
  Plus,
  RotateCcw,
  Search,
  Send,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDialogAccessibility } from "../hooks/useDialogAccessibility.js";
import { Button } from "./Button.jsx";
import { EmptyState } from "./EmptyState.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { RichTextEditor } from "./RichTextEditor.jsx";
import { SafeHtml } from "./SafeHtml.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const statusFilters = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "resolved", label: "Resolved" }
];

const richTextClassName =
  "min-w-0 break-words text-sm leading-6 text-bybs-body [&_a]:break-words [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc";

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function meaningfulRichText(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

function contextLabel(question) {
  if (question?.assignment?.title) return `Assignment: ${question.assignment.title}`;
  if (question?.module?.title) return `Module: ${question.module.title}`;
  return "Learning question";
}

function counterpart(question, role) {
  return role === "mentor" ? question?.student : question?.mentor;
}

function updateQuestion(items, updatedQuestion) {
  const nextItems = items.map((question) => (
    idFor(question) === idFor(updatedQuestion) ? updatedQuestion : question
  ));

  if (!nextItems.some((question) => idFor(question) === idFor(updatedQuestion))) {
    nextItems.unshift(updatedQuestion);
  }

  return nextItems.sort((left, right) => new Date(right.lastMessageAt || 0) - new Date(left.lastMessageAt || 0));
}

function ProfileIdentity({ user, fallback }) {
  const name = user?.name || fallback;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {user?.profileImage ? (
        <img alt={`${name} profile`} className="h-9 w-9 shrink-0 rounded-full object-cover" src={user.profileImage} />
      ) : (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bybs-pale text-sm font-semibold text-bybs-blue" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 truncate text-sm font-medium text-bybs-navy">{name}</span>
    </div>
  );
}

export function MentorQuestionsWorkspace({
  api,
  currentUser,
  initialAssignmentId = "",
  initialModuleId = "",
  initialQuestionId = "",
  onQuestionChange,
  role = "student"
}) {
  const canCreate = role === "student" && Boolean(api.createQuestion);
  const [questions, setQuestions] = useState([]);
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(Boolean(canCreate && (initialAssignmentId || initialModuleId)));
  const [contextType, setContextType] = useState(initialAssignmentId ? "assignment" : "module");
  const [moduleId, setModuleId] = useState(initialModuleId);
  const [assignmentId, setAssignmentId] = useState(initialAssignmentId);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    api.listQuestions({
      question: initialQuestionId || undefined,
      search: initialQuestionId ? undefined : search || undefined,
      status: initialQuestionId ? undefined : status || undefined
    })
      .then((response) => {
        if (!isMounted) return;
        setQuestions(response.data || []);
        if (initialQuestionId) {
          const focused = response.data?.find((question) => idFor(question) === initialQuestionId);
          if (focused) setSelectedQuestion(focused);
          else setError("This question is unavailable or you do not have permission to view it.");
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialQuestionId, search, status]);

  useEffect(() => {
    if (!canCreate) return undefined;
    let isMounted = true;

    Promise.all([api.listModules(), api.listAssignments()])
      .then(([moduleResponse, assignmentResponse]) => {
        if (!isMounted) return;
        setModules(moduleResponse.data || []);
        setAssignments(assignmentResponse.data || []);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      });

    return () => {
      isMounted = false;
    };
  }, [canCreate]);

  useEffect(() => {
    if (subject || !canCreate) return;
    const context = initialAssignmentId
      ? assignments.find((assignment) => idFor(assignment) === initialAssignmentId)
      : modules.find((module) => idFor(module) === initialModuleId);

    if (context?.title) setSubject(`Question about ${context.title}`);
  }, [assignments, canCreate, initialAssignmentId, initialModuleId, modules, subject]);

  const selectedContextAssignments = useMemo(
    () => assignments.filter((assignment) => ["published", "closed"].includes(assignment.status)),
    [assignments]
  );

  function openQuestion(question) {
    setSelectedQuestion(question.messages?.length ? question : null);
    setReply("");
    setError("");
    setFeedback("");
    onQuestionChange?.(idFor(question));
  }

  function closeQuestion() {
    setSelectedQuestion(null);
    setReply("");
    setError("");
    setFeedback("");
    onQuestionChange?.("");
  }

  function resetComposer() {
    setSubject("");
    setMessage("");
    setModuleId("");
    setAssignmentId("");
    setContextType("module");
  }

  async function createQuestion(event) {
    event.preventDefault();
    const contextId = contextType === "assignment" ? assignmentId : moduleId;

    if (!contextId) {
      setError(`Choose an ${contextType} before sending your question.`);
      return;
    }
    if (!meaningfulRichText(message)) {
      setError("Write your question before sending it.");
      return;
    }

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await api.createQuestion({
        assignment: contextType === "assignment" ? assignmentId : undefined,
        module: contextType === "module" ? moduleId : undefined,
        subject,
        message
      });
      setQuestions((items) => updateQuestion(items, response.data));
      setSelectedQuestion(response.data);
      setIsComposerOpen(false);
      setFeedback("Your mentor has been notified by email and in the platform.");
      resetComposer();
      onQuestionChange?.(idFor(response.data));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedQuestion || !meaningfulRichText(reply)) {
      setError("Write a reply before sending it.");
      return;
    }

    setIsSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await api.replyQuestion(idFor(selectedQuestion), { message: reply });
      setQuestions((items) => updateQuestion(items, response.data));
      setSelectedQuestion(response.data);
      setReply("");
      setFeedback(role === "mentor" ? "Your response was sent to the mentee." : "Your follow-up was sent to your mentor.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(nextStatus) {
    if (!selectedQuestion) return;
    setIsSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await api.updateQuestionStatus(idFor(selectedQuestion), { status: nextStatus });
      setQuestions((items) => updateQuestion(items, response.data));
      setSelectedQuestion(response.data);
      setFeedback(nextStatus === "resolved" ? "Question marked as resolved." : "Question reopened for replies.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  const dialogRef = useDialogAccessibility({
    isOpen: Boolean(selectedQuestion),
    onClose: closeQuestion
  });

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        actions={canCreate ? (
          <Button icon={Plus} onClick={() => setIsComposerOpen((open) => !open)} type="button">
            {isComposerOpen ? "Close form" : "Ask mentor"}
          </Button>
        ) : null}
        description={role === "mentor"
          ? "Respond privately to questions from mentees in the context of their modules and assignments."
          : "Ask a private question connected to a module or assignment and continue the conversation with your mentor."}
        title={role === "mentor" ? "Mentee questions" : "Mentor questions"}
      />

      {canCreate && isComposerOpen ? (
        <form className="min-w-0 space-y-4 rounded-lg border border-bybs-border bg-white p-4 shadow-sm sm:p-5" onSubmit={createQuestion}>
          <div>
            <h2 className="text-lg font-semibold text-bybs-navy">Ask a contextual question</h2>
            <p className="mt-1 text-sm text-bybs-body">Your question is private and will go to the mentor assigned to this learning context.</p>
          </div>

          <div className="inline-flex max-w-full rounded-md border border-bybs-border bg-bybs-pale p-1" role="group" aria-label="Question context type">
            {[{ value: "module", label: "Module" }, { value: "assignment", label: "Assignment" }].map((option) => (
              <button
                aria-pressed={contextType === option.value}
                className={`min-h-10 rounded px-4 text-sm font-medium ${contextType === option.value ? "bg-bybs-blue text-white" : "text-bybs-body hover:bg-white"}`}
                key={option.value}
                onClick={() => setContextType(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">{contextType === "assignment" ? "Assignment" : "Module"}</span>
            {contextType === "assignment" ? (
              <select className="mt-2 h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-base outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm" onChange={(event) => setAssignmentId(event.target.value)} required value={assignmentId}>
                <option value="">Choose an assignment</option>
                {selectedContextAssignments.map((assignment) => <option key={assignment._id} value={assignment._id}>{assignment.title}</option>)}
              </select>
            ) : (
              <select className="mt-2 h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-base outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm" onChange={(event) => setModuleId(event.target.value)} required value={moduleId}>
                <option value="">Choose a module</option>
                {modules.map((module) => <option key={module._id} value={module._id}>{module.title}</option>)}
              </select>
            )}
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Subject</span>
            <input className="mt-2 h-11 w-full rounded-md border border-bybs-border px-3 text-base outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm" maxLength="160" onChange={(event) => setSubject(event.target.value)} required value={subject} />
          </label>

          <label className="block min-w-0">
            <span className="text-sm font-medium text-bybs-body">Question</span>
            <div className="mt-2 min-w-0 max-w-full">
              <RichTextEditor id="mentor-question-message" minHeightClassName="min-h-32" onChange={setMessage} placeholder="Explain where you are stuck and what you have already tried." value={message} />
            </div>
          </label>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={isSaving} icon={Send} type="submit">{isSaving ? "Sending..." : "Send question"}</Button>
            <Button onClick={() => setIsComposerOpen(false)} type="button" variant="secondary">Cancel</Button>
          </div>
        </form>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" role="group" aria-label="Question status">
          {statusFilters.map((filter) => (
            <button
              aria-pressed={status === filter.value}
              className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition ${status === filter.value ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"}`}
              key={filter.value || "all"}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <form className="flex min-w-0 max-w-md gap-2" onSubmit={submitSearch}>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search questions</span>
            <input className="h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-base outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale sm:text-sm" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search questions" value={searchInput} />
          </label>
          <Button aria-label="Search questions" icon={Search} size="icon" type="submit" variant="secondary" />
        </form>
      </div>

      {!isComposerOpen && error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}
      {!selectedQuestion && feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue" role="status">{feedback}</p> : null}

      {isLoading ? (
        <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted" role="status">Loading mentor questions...</div>
      ) : !questions.length ? (
        <EmptyState
          actionLabel={canCreate ? "Ask mentor" : undefined}
          description={role === "mentor" ? "New private questions from your assigned mentees will appear here." : "Questions you send to your mentors will appear here with their responses."}
          icon={MessageCircleQuestion}
          onAction={canCreate ? () => setIsComposerOpen(true) : undefined}
          title="No mentor questions yet"
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {questions.map((question) => {
            const person = counterpart(question, role);
            const latestMessage = question.messages?.at(-1);
            const latestPreview = latestMessage?.body?.replace(/<[^>]*>/g, " ") || question.lastMessagePreview || "No messages";
            return (
              <article className="min-w-0 rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={question._id}>
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-bybs-blue">{contextLabel(question)}</p>
                    <h2 className="mt-1 break-words text-base font-semibold text-bybs-navy">{question.subject}</h2>
                  </div>
                  <StatusBadge status={question.status} />
                </div>
                <div className="mt-3"><ProfileIdentity fallback={role === "mentor" ? "Mentee" : "Mentor"} user={person} /></div>
                <p className="mt-3 line-clamp-2 text-sm text-bybs-body">{latestPreview}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-bybs-muted">
                  <span>{question.messageCount ?? question.messages?.length ?? 0} messages</span>
                  <span>Updated {formatDateTime(question.lastMessageAt)}</span>
                </div>
                <Button className="mt-4" onClick={() => openQuestion(question)} size="sm" type="button" variant="secondary">Open question</Button>
              </article>
            );
          })}
        </div>
      )}

      {selectedQuestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-bybs-navy/50 px-3 py-4 sm:px-4 sm:py-6" onClick={closeQuestion}>
          <section
            aria-labelledby={`mentor-question-${selectedQuestion._id}`}
            aria-modal="true"
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-bybs-border bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]"
            onClick={(event) => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            tabIndex="-1"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-bybs-border p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-bybs-blue">{contextLabel(selectedQuestion)}</p>
                <h2 className="mt-1 break-words text-lg font-semibold text-bybs-navy" id={`mentor-question-${selectedQuestion._id}`}>{selectedQuestion.subject}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedQuestion.status} />
                  <span className="text-xs text-bybs-muted">{selectedQuestion.cohort?.title || "BYBS cohort"}</span>
                </div>
              </div>
              <Button aria-label="Close question" icon={X} onClick={closeQuestion} size="icon" type="button" variant="ghost" />
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <div className="space-y-4">
                {selectedQuestion.messages?.map((threadMessage) => {
                  const isCurrentUser = idFor(threadMessage.sender) === idFor(currentUser);
                  return (
                    <article className={`min-w-0 rounded-lg border p-4 ${isCurrentUser ? "ml-auto border-bybs-border bg-bybs-pale sm:max-w-[85%]" : "mr-auto border-bybs-border bg-white sm:max-w-[85%]"}`} key={threadMessage._id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <ProfileIdentity fallback={threadMessage.senderRole === "mentor" ? "Mentor" : "Mentee"} user={threadMessage.sender} />
                        <span className="text-xs text-bybs-muted">{formatDateTime(threadMessage.createdAt)}</span>
                      </div>
                      <SafeHtml className={`${richTextClassName} mt-3`} html={threadMessage.body} />
                    </article>
                  );
                })}
              </div>

              {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue" role="status">{feedback}</p> : null}
              {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}

              {selectedQuestion.status !== "resolved" ? (
                <form className="min-w-0 space-y-3 border-t border-bybs-border pt-5" onSubmit={sendReply}>
                  <label className="block min-w-0">
                    <span className="text-sm font-semibold text-bybs-navy">Reply</span>
                    <div className="mt-2 min-w-0 max-w-full">
                      <RichTextEditor id={`mentor-question-reply-${selectedQuestion._id}`} minHeightClassName="min-h-28" onChange={setReply} placeholder={role === "mentor" ? "Give the mentee a clear, practical response." : "Write a follow-up question or clarification."} value={reply} />
                    </div>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isSaving} icon={Send} type="submit">{isSaving ? "Sending..." : "Send reply"}</Button>
                    <Button disabled={isSaving} icon={CheckCircle2} onClick={() => changeStatus("resolved")} type="button" variant="secondary">Mark resolved</Button>
                  </div>
                </form>
              ) : (
                <div className="rounded-md bg-bybs-pale p-4">
                  <p className="text-sm text-bybs-body">This question is resolved. Reopen it to continue the conversation.</p>
                  <Button className="mt-3" disabled={isSaving} icon={RotateCcw} onClick={() => changeStatus("open")} size="sm" type="button" variant="secondary">Reopen question</Button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

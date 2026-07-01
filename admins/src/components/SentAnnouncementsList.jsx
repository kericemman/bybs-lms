import { Eye, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, DataTable, SectionHeader, StatusBadge } from "@bybs/shared";
import { inputClassName } from "./FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

const apiAssetBaseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5050/api").replace(/\/api\/?$/, "");

function snippet(message = "") {
  return message
    .replace(/!\[[^\]]*]\([^)]+\)/g, "[image]")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^#+\s/gm, "")
    .replace(/^!!\s/gm, "")
    .replace(/^>\s/gm, "")
    .slice(0, 130);
}

function deliverySummary(row) {
  const statuses = row.emailDeliveryStatuses || [];

  if (row.channel === "platform" || statuses.includes("notRequested")) {
    return { label: "Portal only", tone: "neutral" };
  }

  if (statuses.includes("notConfigured") || row.emailNotConfiguredCount > 0) {
    return { label: "Email not configured", tone: "warning" };
  }

  if (statuses.includes("failed") || row.emailFailedCount > 0) {
    return { label: "Email failed", tone: "danger" };
  }

  if (statuses.includes("pending")) {
    return { label: "Email pending", tone: "warning" };
  }

  if (statuses.includes("sent") || row.emailSentCount > 0) {
    return { label: "Email sent", tone: "success" };
  }

  return { label: "Unknown", tone: "neutral" };
}

function isDisplayableImageSource(source = "") {
  return /^https?:\/\//i.test(source) || source.startsWith("/uploads/");
}

function displayImageSource(source = "") {
  return source.startsWith("/uploads/") ? `${apiAssetBaseUrl}${source}` : source;
}

function renderContent(message = "") {
  return message.split("\n").map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) return <div className="h-3" key={`space-${index}`} />;

    const image = trimmed.match(/^!\[([^\]]*)]\(([^)\s]+)\)$/);
    if (image) {
      if (!isDisplayableImageSource(image[2])) return null;

      return (
        <figure className="mt-4 overflow-hidden rounded-md border border-bybs-border bg-white" key={`image-${index}`}>
          <img alt={image[1] || "Announcement image"} className="max-h-80 w-full object-cover" src={displayImageSource(image[2])} />
          {image[1] ? <figcaption className="px-3 py-2 text-xs text-bybs-muted">{image[1]}</figcaption> : null}
        </figure>
      );
    }

    if (trimmed === "---") return <hr className="my-5 border-bybs-border" key={`divider-${index}`} />;

    if (trimmed.startsWith("## ")) {
      return <h3 className="mt-4 text-base font-semibold text-bybs-navy" key={`heading-${index}`}>{trimmed.slice(3)}</h3>;
    }

    if (trimmed.startsWith("### ")) {
      return <h4 className="mt-4 text-sm font-semibold text-bybs-blue" key={`subheading-${index}`}>{trimmed.slice(4)}</h4>;
    }

    if (trimmed.startsWith("> ")) {
      return <blockquote className="mt-4 border-l-4 border-bybs-rose bg-bybs-blush px-4 py-3 text-sm leading-6 text-bybs-body" key={`quote-${index}`}>{trimmed.slice(2)}</blockquote>;
    }

    if (trimmed.startsWith("!! ")) {
      return <p className="mt-4 rounded-md bg-bybs-gold/30 px-4 py-3 text-sm font-medium leading-6 text-bybs-navy" key={`highlight-${index}`}>{trimmed.slice(3)}</p>;
    }

    if (trimmed.startsWith("- ")) {
      return (
        <div className="mt-2 flex gap-2 text-sm leading-6 text-bybs-body" key={`bullet-${index}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bybs-rose" />
          <span>{trimmed.slice(2)}</span>
        </div>
      );
    }

    return <p className="mt-3 text-sm leading-6 text-bybs-body" key={`line-${index}`}>{trimmed}</p>;
  });
}

export function SentAnnouncementsList({ onCreate, refreshKey = 0 }) {
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [filters, setFilters] = useState({ search: "", channel: "" });
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadAnnouncements() {
    const response = await adminApi.listAnnouncements(filters);
    setAnnouncements(response.data);
  }

  async function deleteAnnouncement(row) {
    setError("");
    setFeedback("");

    const confirmed = window.confirm(`Delete "${row.title}" from sent announcements? This removes the portal records but cannot recall emails already delivered.`);
    if (!confirmed) return;

    try {
      const response = await adminApi.deleteAnnouncement(row._id);
      setSelectedAnnouncement((current) => (current?._id === row._id ? null : current));
      setFeedback(`Announcement deleted for ${response.data.deletedCount} recipient record(s).`);
      await loadAnnouncements();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    loadAnnouncements().catch((requestError) => setError(requestError.message));
  }, [filters, refreshKey]);

  return (
    <section className="space-y-4">
      <SectionHeader
        action={
          <Button icon={Plus} onClick={onCreate} type="button">
            Create announcement
          </Button>
        }
        description="Recently sent email-style announcements and portal notices."
        title="Sent announcements"
      />

      <div className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
          <input
            className={`${inputClassName} pl-9`}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search sent announcements"
            value={filters.search}
          />
        </div>
        <select
          className={inputClassName}
          onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
          value={filters.channel}
        >
          <option value="">All channels</option>
          <option value="both">Email + portal</option>
          <option value="email">Email template</option>
          <option value="platform">Portal notice</option>
        </select>
        <Button icon={X} onClick={() => setFilters({ search: "", channel: "" })} type="button" variant="secondary">
          Reset
        </Button>
      </div>

      {error ? <p className="mb-4 rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="mb-4 rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {selectedAnnouncement ? (
        <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-bybs-blue">Sent announcement</p>
              <h3 className="mt-1 text-lg font-semibold text-bybs-navy">{selectedAnnouncement.title}</h3>
              <p className="mt-1 text-sm text-bybs-body">{selectedAnnouncement.previewText || "No preview text"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={Trash2} onClick={() => deleteAnnouncement(selectedAnnouncement)} type="button" variant="danger">
                Delete
              </Button>
              <Button icon={X} onClick={() => setSelectedAnnouncement(null)} type="button" variant="ghost">
                Close
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-md bg-bybs-pale p-3">
              <p className="text-xs font-semibold uppercase text-bybs-muted">Target</p>
              <p className="mt-1 text-sm font-medium text-bybs-navy">{selectedAnnouncement.targetLabel || selectedAnnouncement.targetType}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-3">
              <p className="text-xs font-semibold uppercase text-bybs-muted">Recipients</p>
              <p className="mt-1 text-sm font-medium text-bybs-navy">{selectedAnnouncement.recipientCount || 0}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-3">
              <p className="text-xs font-semibold uppercase text-bybs-muted">Channel</p>
              <p className="mt-1 text-sm font-medium text-bybs-navy">{selectedAnnouncement.channel || "platform"}</p>
            </div>
            <div className="rounded-md bg-bybs-pale p-3">
              <p className="text-xs font-semibold uppercase text-bybs-muted">Delivery</p>
              <div className="mt-1">
                <StatusBadge label={deliverySummary(selectedAnnouncement).label} tone={deliverySummary(selectedAnnouncement).tone} />
              </div>
            </div>
            <div className="rounded-md bg-bybs-pale p-3">
              <p className="text-xs font-semibold uppercase text-bybs-muted">Sent</p>
              <p className="mt-1 text-sm font-medium text-bybs-navy">{formatDateTime(selectedAnnouncement.sentAt)}</p>
            </div>
          </div>

          {selectedAnnouncement.emailDeliveryError ? (
            <p className="mt-4 rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{selectedAnnouncement.emailDeliveryError}</p>
          ) : null}

          <div className="mt-5 border-t border-bybs-border pt-4">
            {renderContent(selectedAnnouncement.message)}
          </div>
        </section>
      ) : null}

      <DataTable
        columns={[
          { key: "title", header: "Subject", wrap: true },
          { key: "targetLabel", header: "Target", render: (row) => row.targetLabel || row.targetType || "Target" },
          { key: "channel", header: "Channel", render: (row) => <StatusBadge label={row.channel || "platform"} status={row.channel || "platform"} /> },
          { key: "delivery", header: "Delivery", render: (row) => <StatusBadge label={deliverySummary(row).label} tone={deliverySummary(row).tone} /> },
          { key: "recipientCount", header: "Recipients" },
          { key: "sentAt", header: "Sent", render: (row) => formatDateTime(row.sentAt) },
          { key: "message", header: "Content", wrap: true, render: (row) => snippet(row.message) || "No content" },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button icon={Eye} onClick={() => setSelectedAnnouncement(row)} size="sm" type="button" variant="secondary">
                  View
                </Button>
                <Button icon={Trash2} onClick={() => deleteAnnouncement(row)} size="sm" type="button" variant="danger">
                  Delete
                </Button>
              </div>
            )
          }
        ]}
        emptyActionLabel="Create announcement"
        emptyDescription="Sent announcements will appear here after the first message is created."
        onEmptyAction={onCreate}
        rows={announcements}
      />
    </section>
  );
}

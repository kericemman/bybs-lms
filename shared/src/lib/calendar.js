function asDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatUtcDateTime(value) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatCalendarDate(value) {
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function escapeCalendarText(value = "") {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function safeFileName(value = "bybs-calendar") {
  return String(value || "bybs-calendar")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "bybs-calendar";
}

function calendarDetails({ description = "", url = "" }) {
  return url ? `${description}\n\nLink: ${url}`.trim() : description;
}

function eventWindow({ allDay = false, endsAt, startsAt }) {
  const startDate = asDate(startsAt);
  if (!startDate) return null;

  const endDate = asDate(endsAt);
  const resolvedEndDate = allDay
    ? addDays(endDate || startDate, 1)
    : endDate && endDate > startDate
      ? endDate
      : new Date(startDate.getTime() + 60 * 60 * 1000);

  return { endDate: resolvedEndDate, startDate };
}

export function createCalendarEvent({
  allDay = false,
  description = "",
  endsAt,
  id,
  location = "",
  startsAt,
  title = "BYBS LMS event",
  url = ""
}) {
  const dateWindow = eventWindow({ allDay, endsAt, startsAt });
  if (!dateWindow) return "";

  const { endDate, startDate } = dateWindow;
  const uid = `${id || `${startDate.getTime()}-${title}`}@bybs-lms`;
  const resolvedDescription = calendarDetails({ description, url });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Build Your Best Self//BYBS LMS//EN",
    "BEGIN:VEVENT",
    `UID:${escapeCalendarText(uid)}`,
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(resolvedDescription)}`,
    `LOCATION:${escapeCalendarText(location)}`
  ];

  if (url) {
    lines.push(`URL:${url}`);
  }

  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatCalendarDate(startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatCalendarDate(endDate)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(startDate)}`);
    lines.push(`DTEND:${formatUtcDateTime(endDate)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

export function googleCalendarUrl(event = {}) {
  const dateWindow = eventWindow(event);
  if (!dateWindow) return "";

  const { endDate, startDate } = dateWindow;
  const dates = event.allDay
    ? `${formatCalendarDate(startDate)}/${formatCalendarDate(endDate)}`
    : `${formatUtcDateTime(startDate)}/${formatUtcDateTime(endDate)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title || "BYBS LMS event",
    dates,
    details: calendarDetails(event),
    location: event.location || ""
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event = {}) {
  const dateWindow = eventWindow(event);
  if (!dateWindow) return "";

  const { endDate, startDate } = dateWindow;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title || "BYBS LMS event",
    body: calendarDetails(event),
    location: event.location || "",
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString()
  });

  if (event.allDay) {
    params.set("allday", "true");
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadCalendarEvent(event, fileName) {
  const calendarContent = createCalendarEvent(event);
  if (!calendarContent || typeof document === "undefined") return false;

  const blob = new Blob([calendarContent], { type: "text/calendar;charset=utf-8" });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `${safeFileName(fileName || event.title)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 500);
  return true;
}

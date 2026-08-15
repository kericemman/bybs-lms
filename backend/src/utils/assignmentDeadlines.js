const DEFAULT_TIME_ZONE = process.env.ASSIGNMENT_DEADLINE_TIME_ZONE || "Africa/Juba";
const DEFAULT_DEADLINE_TIME = process.env.ASSIGNMENT_DEFAULT_DEADLINE_TIME || "23:59";

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const explicitTimeZonePattern = /(Z|[+-]\d{2}:?\d{2})$/i;

function numericPartsInTimeZone(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour === "24" ? "00" : values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function timeZoneOffsetMs(date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = numericPartsInTimeZone(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return localAsUtc - date.getTime();
}

function zonedDateTimeToUtcDate(parts, timeZone = DEFAULT_TIME_ZONE) {
  const wallTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second || 0,
    parts.millisecond || 0
  );
  let utcTime = wallTimeAsUtc - timeZoneOffsetMs(new Date(wallTimeAsUtc), timeZone);
  utcTime = wallTimeAsUtc - timeZoneOffsetMs(new Date(utcTime), timeZone);

  return new Date(utcTime);
}

function defaultDeadlineTimeParts() {
  const [hour = "23", minute = "59"] = DEFAULT_DEADLINE_TIME.split(":");

  return {
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
    millisecond: 0
  };
}

export function dateOnlyToAssignmentDeadline(dateValue, timeZone = DEFAULT_TIME_ZONE) {
  const match = String(dateValue || "").match(dateOnlyPattern);
  if (!match) return new Date(dateValue);

  return zonedDateTimeToUtcDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    ...defaultDeadlineTimeParts()
  }, timeZone);
}

export function normalizeAssignmentDueDateInput(value, timeZone = DEFAULT_TIME_ZONE) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnly = trimmed.match(dateOnlyPattern);
    const localDateTime = trimmed.match(localDateTimePattern);

    if (dateOnly) {
      return dateOnlyToAssignmentDeadline(trimmed, timeZone);
    }

    if (localDateTime && !explicitTimeZonePattern.test(trimmed)) {
      return zonedDateTimeToUtcDate({
        year: Number(localDateTime[1]),
        month: Number(localDateTime[2]),
        day: Number(localDateTime[3]),
        hour: Number(localDateTime[4]),
        minute: Number(localDateTime[5]),
        second: Number(localDateTime[6] || 0),
        millisecond: 0
      }, timeZone);
    }

    return new Date(trimmed);
  }

  if (value instanceof Date) {
    if (
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    ) {
      return dateOnlyToAssignmentDeadline(value.toISOString().slice(0, 10), timeZone);
    }

    return value;
  }

  return value;
}

export function effectiveAssignmentDeadline(value, timeZone = DEFAULT_TIME_ZONE) {
  return normalizeAssignmentDueDateInput(value, timeZone);
}

export function isPastAssignmentDeadline(dueDate, now = new Date()) {
  const deadline = effectiveAssignmentDeadline(dueDate);

  return now.getTime() > deadline.getTime();
}

export function isOnOrBeforeAssignmentDeadline(submittedAt, dueDate) {
  const submitted = new Date(submittedAt);
  const deadline = effectiveAssignmentDeadline(dueDate);

  return submitted.getTime() <= deadline.getTime();
}

export function formatAssignmentDeadlineForNotification(value, timeZone = DEFAULT_TIME_ZONE) {
  const deadline = effectiveAssignmentDeadline(value, timeZone);
  const formatted = new Intl.DateTimeFormat("en", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(deadline);

  return `${formatted} CAT`;
}

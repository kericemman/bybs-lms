export const BYBS_OFFICIAL_TIME_ZONE = "Africa/Juba";
export const BYBS_OFFICIAL_TIME_ZONE_LABEL = "CAT";
export const DEFAULT_ASSIGNMENT_DEADLINE_TIME = "23:59";

const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const explicitTimeZonePattern = /(Z|[+-]\d{2}:?\d{2})$/i;

function pad(value) {
  return String(value).padStart(2, "0");
}

function partsInTimeZone(value, timeZone = BYBS_OFFICIAL_TIME_ZONE) {
  const date = new Date(value);
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

function timeZoneOffsetMs(date, timeZone = BYBS_OFFICIAL_TIME_ZONE) {
  const parts = partsInTimeZone(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return localAsUtc - date.getTime();
}

function zonedDateTimeToUtcDate(parts, timeZone = BYBS_OFFICIAL_TIME_ZONE) {
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

function dateOnlyToDeadline(value) {
  const match = String(value || "").match(dateOnlyPattern);
  if (!match) return new Date(value);
  const { hour, minute, second, millisecond } = defaultDeadlineParts();

  return zonedDateTimeToUtcDate({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour,
    minute,
    second,
    millisecond
  });
}

function normalizeAssignmentDeadlineDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (dateOnlyPattern.test(trimmed)) {
      return dateOnlyToDeadline(trimmed);
    }

    const date = new Date(trimmed);
    if (
      explicitTimeZonePattern.test(trimmed) &&
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0
    ) {
      return dateOnlyToDeadline(date.toISOString().slice(0, 10));
    }

    return date;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return dateOnlyToDeadline(date.toISOString().slice(0, 10));
  }

  return date;
}

function defaultDeadlineParts() {
  const [hour = "23", minute = "59"] = DEFAULT_ASSIGNMENT_DEADLINE_TIME.split(":");

  return {
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
    millisecond: 0
  };
}

function officialWallClock(value) {
  const parts = partsInTimeZone(value);

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function defaultAssignmentDeadlineInputValue(daysAhead = 7) {
  const nowParts = partsInTimeZone(new Date());
  const officialToday = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const deadlineDay = new Date(officialToday + daysAhead * 24 * 60 * 60 * 1000);
  const year = deadlineDay.getUTCFullYear();
  const month = deadlineDay.getUTCMonth() + 1;
  const day = deadlineDay.getUTCDate();
  const { hour, minute } = defaultDeadlineParts();

  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function toAssignmentDeadlineInput(value) {
  if (!value) return defaultAssignmentDeadlineInputValue();
  return officialWallClock(normalizeAssignmentDeadlineDate(value));
}

export function assignmentDeadlineInputToIso(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const dateOnly = trimmed.match(dateOnlyPattern);
  const localDateTime = trimmed.match(localDateTimePattern);

  if (dateOnly) {
    const { hour, minute, second, millisecond } = defaultDeadlineParts();
    return zonedDateTimeToUtcDate({
      year: Number(dateOnly[1]),
      month: Number(dateOnly[2]),
      day: Number(dateOnly[3]),
      hour,
      minute,
      second,
      millisecond
    }).toISOString();
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
    }).toISOString();
  }

  return new Date(trimmed).toISOString();
}

export function formatOfficialDateTime(value) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat(undefined, {
    timeZone: BYBS_OFFICIAL_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatAssignmentDeadline(value, { includeLocalTime = true } = {}) {
  if (!value) return "Not set";

  const date = normalizeAssignmentDeadlineDate(value);
  const official = `${formatOfficialDateTime(date)} ${BYBS_OFFICIAL_TIME_ZONE_LABEL}`;

  if (!includeLocalTime) return official;

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!localTimeZone || localTimeZone === BYBS_OFFICIAL_TIME_ZONE) {
    return official;
  }

  const officialParts = partsInTimeZone(date, BYBS_OFFICIAL_TIME_ZONE);
  const localParts = partsInTimeZone(date, localTimeZone);
  const sameWallClock =
    officialParts.year === localParts.year &&
    officialParts.month === localParts.month &&
    officialParts.day === localParts.day &&
    officialParts.hour === localParts.hour &&
    officialParts.minute === localParts.minute;

  if (sameWallClock) {
    return official;
  }

  const local = new Intl.DateTimeFormat(undefined, {
    timeZone: localTimeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);

  return `${official} (${local} your time)`;
}

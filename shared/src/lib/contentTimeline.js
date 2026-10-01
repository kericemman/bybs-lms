export const CONTENT_TIMELINES = [
  { value: "current", label: "Current" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" }
];

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function moduleTimelineStatus(module, now = new Date()) {
  const startDate = validDate(module?.startDate);
  const endDate = validDate(module?.endDate);

  if (startDate && startDate > now) return "upcoming";
  if (endDate && endDate < now) return "completed";
  return "current";
}

export function assignmentTimelineStatus(assignment, now = new Date()) {
  if (assignment?.submission?.status === "approved") return "completed";
  if (moduleTimelineStatus(assignment?.module, now) === "upcoming") return "upcoming";
  return "current";
}

export function timelineCounts(items, statusForItem) {
  return items.reduce(
    (counts, item) => {
      const status = statusForItem(item);
      if (counts[status] !== undefined) counts[status] += 1;
      return counts;
    },
    { current: 0, upcoming: 0, completed: 0 }
  );
}

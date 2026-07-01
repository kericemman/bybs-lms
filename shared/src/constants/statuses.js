export const ASSIGNMENT_STATUSES = {
  NOT_STARTED: "notStarted",
  SUBMITTED: "submitted",
  LATE_SUBMISSION: "lateSubmission",
  REVIEWED: "reviewed",
  NEEDS_REVISION: "needsRevision",
  APPROVED: "approved"
};

export const BOOKING_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

export const STATUS_TONES = {
  active: "success",
  approved: "success",
  completed: "success",
  published: "success",
  submitted: "info",
  reviewed: "info",
  scheduled: "info",
  pending: "warning",
  draft: "neutral",
  inactive: "neutral",
  needsRevision: "warning",
  lateSubmission: "danger",
  suspended: "danger",
  removed: "danger",
  cancelled: "danger"
};

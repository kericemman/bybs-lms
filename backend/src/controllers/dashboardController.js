import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Cohort } from "../models/Cohort.js";
import { Report } from "../models/Report.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { SystemLog } from "../models/SystemLog.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function ownerName(user, fallback = "System") {
  return user?.name || user?.email || fallback;
}

function activityRow({ source, item, owner, status, occurredAt, href }) {
  return {
    id: `${source}-${idFor(item?._id || item?.id || occurredAt || Math.random())}`,
    source,
    item: item?.title || item?.subject || item?.action || "Platform activity",
    owner,
    status,
    occurredAt,
    href
  };
}

function latestActivities(...groups) {
  return groups
    .flat()
    .filter(Boolean)
    .sort((left, right) => new Date(right.occurredAt || 0) - new Date(left.occurredAt || 0))
    .slice(0, 12);
}

function systemLogStatus(log) {
  if (log.action?.includes("ERROR") || log.statusCode >= 500) return "error";
  if (log.action?.includes("SLOW") || log.statusCode >= 400) return "warning";
  return "logged";
}

export const adminSummary = asyncHandler(async (_req, res) => {
  const [
    students,
    mentors,
    cohorts,
    pendingReviews,
    supportTickets,
    submissions,
    tickets,
    bookings,
    assignments,
    reports,
    sessions,
    systemLogs
  ] = await Promise.all([
    User.countDocuments({ role: "student", status: "active" }),
    User.countDocuments({ role: "mentor", status: "active" }),
    Cohort.countDocuments({ status: "active" }),
    Submission.countDocuments({ status: { $in: ["submitted", "lateSubmission", "needsRevision"] } }),
    SupportTicket.countDocuments({ status: { $in: ["open", "inProgress"] } }),
    Submission.find()
      .populate("student", "name email")
      .populate("assignment", "title")
      .sort({ updatedAt: -1 })
      .limit(5),
    SupportTicket.find({ status: { $in: ["open", "inProgress"] } })
      .populate("student", "name email")
      .sort({ updatedAt: -1 })
      .limit(5),
    Booking.find()
      .populate("student", "name email")
      .populate("mentor", "name email")
      .sort({ updatedAt: -1 })
      .limit(5),
    Assignment.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5),
    Report.find()
      .populate("mentor", "name email")
      .sort({ updatedAt: -1 })
      .limit(5),
    Session.find()
      .populate("module", "title")
      .sort({ startsAt: -1 })
      .limit(5),
    SystemLog.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const activity = latestActivities(
    submissions.map((submission) =>
      activityRow({
        source: "Submission",
        item: { _id: submission._id, title: submission.assignment?.title || "Assignment submission" },
        owner: ownerName(submission.student, "Mentee"),
        status: submission.status,
        occurredAt: submission.updatedAt || submission.submittedAt,
        href: "/assignments"
      })
    ),
    tickets.map((ticket) =>
      activityRow({
        source: "Support",
        item: ticket,
        owner: ownerName(ticket.student, "Mentee"),
        status: ticket.status,
        occurredAt: ticket.updatedAt,
        href: "/support"
      })
    ),
    bookings.map((booking) =>
      activityRow({
        source: "Booking",
        item: { _id: booking._id, title: "Mentor booking" },
        owner: `${ownerName(booking.student, "Mentee")} / ${ownerName(booking.mentor, "Mentor")}`,
        status: booking.status,
        occurredAt: booking.updatedAt,
        href: "/bookings"
      })
    ),
    assignments.map((assignment) =>
      activityRow({
        source: "Assignment",
        item: assignment,
        owner: ownerName(assignment.createdBy, "Mentor"),
        status: assignment.status,
        occurredAt: assignment.createdAt,
        href: "/assignments"
      })
    ),
    reports.map((report) =>
      activityRow({
        source: "Report",
        item: { _id: report._id, title: `${report.period || "Weekly"} mentor report` },
        owner: ownerName(report.mentor, "Mentor"),
        status: report.reviewStatus,
        occurredAt: report.updatedAt || report.submittedAt,
        href: "/reports"
      })
    ),
    sessions.map((session) =>
      activityRow({
        source: "Session",
        item: { _id: session._id, title: session.title || session.module?.title || "Session" },
        owner: session.module?.title || "Program schedule",
        status: session.status,
        occurredAt: session.startsAt,
        href: "/sessions"
      })
    ),
    systemLogs.map((log) =>
      activityRow({
        source: "System",
        item: { _id: log._id, title: log.route || log.action || "System event" },
        owner: ownerName(log.user),
        status: systemLogStatus(log),
        occurredAt: log.createdAt,
        href: "/system-logs"
      })
    )
  );

  res.json({
    totals: {
      students,
      mentors,
      cohorts,
      pendingReviews,
      supportTickets
    },
    activity,
    message: "Admin dashboard summary endpoint ready"
  });
});

export const mentorSummary = asyncHandler(async (_req, res) => {
  res.json({
    totals: {
      assignedStudents: 0,
      pendingReviews: 0,
      upcomingBookings: 0,
      atRiskStudents: 0
    },
    message: "Mentor dashboard summary endpoint ready"
  });
});

export const studentSummary = asyncHandler(async (_req, res) => {
  res.json({
    progress: {
      percentage: 0,
      pendingAssignments: 0,
      upcomingSessions: 0,
      unreadAnnouncements: 0
    },
    message: "Student dashboard summary endpoint ready"
  });
});

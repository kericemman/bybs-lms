import { Assignment } from "../models/Assignment.js";
import { Cohort } from "../models/Cohort.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const adminSummary = asyncHandler(async (_req, res) => {
  const [
    students,
    mentors,
    cohorts,
    pendingReviews,
    supportTickets
  ] = await Promise.all([
    User.countDocuments({ role: "student", status: "active" }),
    User.countDocuments({ role: "mentor", status: "active" }),
    Cohort.countDocuments({ status: "active" }),
    Assignment.countDocuments({ status: "published" }),
    SupportTicket.countDocuments({ status: { $in: ["open", "inProgress"] } })
  ]);

  res.json({
    totals: {
      students,
      mentors,
      cohorts,
      pendingReviews,
      supportTickets
    },
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

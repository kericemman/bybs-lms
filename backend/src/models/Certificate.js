import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", index: true },
    mentorApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mentorApprovedAt: { type: Date, default: Date.now },
    mentorNotes: { type: String },
    status: {
      type: String,
      enum: ["mentorApproved", "issued", "revoked"],
      default: "mentorApproved",
      index: true
    },
    certificateNumber: { type: String, unique: true, sparse: true, index: true },
    verificationCode: { type: String, unique: true, sparse: true, index: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    issuedAt: { type: Date },
    progressSnapshot: {
      progress: { type: Number },
      graduationReady: { type: Boolean },
      assignmentCompletionPercentage: { type: Number },
      scorePercentage: { type: Number },
      attendancePercentage: { type: Number },
      punctualityPercentage: { type: Number },
      totalAssignments: { type: Number },
      submittedCount: { type: Number },
      pendingCount: { type: Number },
      approvedCount: { type: Number },
      needsRevisionCount: { type: Number },
      lateSubmissionCount: { type: Number },
      attendanceMarked: { type: Number },
      attended: { type: Number },
      lateAttendanceCount: { type: Number },
      computedAt: { type: Date }
    },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
    revokeReason: { type: String }
  },
  { timestamps: true }
);

export const Certificate = mongoose.model("Certificate", certificateSchema);

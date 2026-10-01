import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["present", "absent", "late", "excused"], default: "present" },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    markedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const attendanceAuditSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    previousStatus: {
      type: String,
      enum: ["notMarked", "present", "absent", "late", "excused"],
      default: "notMarked"
    },
    newStatus: {
      type: String,
      enum: ["notMarked", "present", "absent", "late", "excused"],
      required: true
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
    sourceRole: { type: String, enum: ["mentor", "admin", "adminManager", "superAdmin", "system"] },
    reason: { type: String, trim: true }
  },
  { _id: true }
);

const sessionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", index: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    zoomLink: { type: String },
    recordingLink: { type: String },
    slidesUrl: { type: String },
    attendance: [attendanceSchema],
    attendanceAudit: { type: [attendanceAuditSchema], default: [] },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true
    }
  },
  { timestamps: true }
);

sessionSchema.index({ "attendance.student": 1, startsAt: -1 });
sessionSchema.index({ "attendanceAudit.changedAt": -1 });

export const Session = mongoose.model("Session", sessionSchema);

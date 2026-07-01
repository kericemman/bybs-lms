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
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
      index: true
    }
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", sessionSchema);

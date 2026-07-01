import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    period: { type: String, enum: ["weekly", "monthly"], default: "weekly" },
    activeStudentCount: { type: Number, default: 0 },
    studentsDoingWell: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    studentsAtRisk: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignmentCompletionSummary: { type: String },
    attendanceConcerns: { type: String },
    observations: { type: String },
    recommendations: { type: String },
    supportNeeded: { type: String },
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", reportSchema);

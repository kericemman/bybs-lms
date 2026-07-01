import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileUrl: { type: String },
    writtenResponse: { type: String },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false, index: true },
    score: { type: Number },
    feedback: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    status: {
      type: String,
      enum: ["notStarted", "submitted", "lateSubmission", "reviewed", "needsRevision", "approved"],
      default: "submitted",
      index: true
    }
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export const Submission = mongoose.model("Submission", submissionSchema);

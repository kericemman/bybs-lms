import mongoose from "mongoose";

const betaFeedbackSchema = new mongoose.Schema(
  {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["student", "mentor"],
      required: true,
      index: true
    },
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    category: {
      type: String,
      enum: ["overall", "bug", "navigation", "content", "assignments", "sessions", "notifications", "performance", "support", "featureRequest", "other"],
      default: "overall",
      index: true
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "reviewed", "resolved"],
      default: "new",
      index: true
    },
    adminNotes: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

betaFeedbackSchema.index({ role: 1, status: 1, createdAt: -1 });
betaFeedbackSchema.index({ submittedBy: 1, createdAt: -1 });

export const BetaFeedback = mongoose.model("BetaFeedback", betaFeedbackSchema);

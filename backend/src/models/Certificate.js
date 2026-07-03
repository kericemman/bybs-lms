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
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
    revokeReason: { type: String }
  },
  { timestamps: true }
);

export const Certificate = mongoose.model("Certificate", certificateSchema);

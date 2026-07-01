import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["login", "assignment", "mentor", "resourceAccess", "technical", "general"],
      required: true,
      index: true
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "inProgress", "resolved", "closed"],
      default: "open",
      index: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    replies: [replySchema]
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

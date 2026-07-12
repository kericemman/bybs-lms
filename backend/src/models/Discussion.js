import mongoose from "mongoose";

export const DISCUSSION_AUDIENCES = ["all", "mentorsAdmins", "mentorsOnly", "mentorsMentees"];
export const DISCUSSION_REACTIONS = ["thumbsUp", "heart", "clap", "celebrate", "pray"];

const reactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reaction: { type: String, enum: DISCUSSION_REACTIONS, required: true }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    body: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId },
    reactions: [reactionSchema]
  },
  { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
  {
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    comments: [commentSchema],
    reactions: [reactionSchema],
    audience: {
      type: String,
      enum: DISCUSSION_AUDIENCES,
      default: "all",
      index: true
    },
    status: {
      type: String,
      enum: ["open", "closed", "archived"],
      default: "open",
      index: true
    }
  },
  { timestamps: true }
);

export const Discussion = mongoose.model("Discussion", discussionSchema);

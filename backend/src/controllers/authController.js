import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { uploadToCloudinary } from "../services/cloudinaryUploadService.js";
import { sendPasswordResetEmail } from "../services/passwordResetEmailService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signAccessToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const RESET_REQUEST_MESSAGE =
  "If this email belongs to a BYBS mentor or mentee account, a password reset link will be sent shortly.";

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    profileImage: user.profileImage,
    bio: user.bio,
    expertise: user.expertise,
    cohort: user.cohort,
    mentor: user.mentor,
    passwordResetRequired: Boolean(user.passwordResetRequired),
    passwordChangedAt: user.passwordChangedAt
  };
}

function canAccessPortal(user) {
  return user.status === "active" || (user.role === "student" && user.status === "completed");
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resetPortalUrl(user) {
  return user.role === "mentor" ? env.clientMentorUrl : env.clientStudentUrl;
}

function resetPasswordUrl(user, token) {
  const baseUrl = resetPortalUrl(user).replace(/\/$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid login credentials");
  }

  if (!canAccessPortal(user)) {
    throw new ApiError(403, "Your account is not active");
  }

  user.lastLogin = new Date();
  await user.save();

  res.json({
    token: signAccessToken(user),
    user: publicUser(user)
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+passwordHash");

  if (!user) {
    throw new ApiError(401, "Invalid or inactive account");
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, "Current password is incorrect");
  }

  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, "New password must be different from the current password");
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordResetRequired = false;
  user.passwordChangedAt = new Date();
  await user.save();

  res.json({ user: publicUser(user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const requestedRole = req.body.role;
  const query = {
    email,
    role: requestedRole || { $in: ["mentor", "student"] }
  };

  const user = await User.findOne(query);

  if (!user || !["mentor", "student"].includes(user.role) || !canAccessPortal(user)) {
    res.json({ message: RESET_REQUEST_MESSAGE });
    return;
  }

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  user.passwordResetTokenHash = hashResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  user.passwordResetRequestedAt = new Date();
  await user.save();

  const emailResult = await sendPasswordResetEmail({
    user,
    resetUrl: resetPasswordUrl(user, token)
  });

  if (emailResult.status === "failed") {
    logger.warn(
      {
        userId: user.id,
        emailStatus: emailResult.status,
        error: emailResult.error
      },
      "Password reset email failed"
    );
  }

  res.json({ message: RESET_REQUEST_MESSAGE });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const tokenHash = hashResetToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
    role: { $in: ["mentor", "student"] }
  }).select("+passwordHash +passwordResetTokenHash +passwordResetExpiresAt");

  if (!user || !canAccessPortal(user)) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  if (await user.comparePassword(newPassword)) {
    throw new ApiError(400, "New password must be different from the current password");
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.passwordResetRequired = false;
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.passwordResetRequestedAt = undefined;
  await user.save();

  res.json({ message: "Password has been reset. You can now sign in with your new password." });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(401, "Invalid or inactive account");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
    user.name = sanitizePlainText(req.body.name);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "phone")) {
    user.phone = sanitizePlainText(req.body.phone || "");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
    user.bio = sanitizeRichText(req.body.bio || "");
  }

  await user.save();

  res.json({ user: publicUser(user) });
});

export const updateProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Profile image is required");
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(401, "Invalid or inactive account");
  }

  const cloudinaryUpload = await uploadToCloudinary(req.file);
  const publicPath = `/uploads/${req.file.filename}`;
  const publicBaseUrl = env.publicApiUrl || `${req.protocol}://${req.get("host")}`;
  const localUrl = `${publicBaseUrl.replace(/\/$/, "")}${publicPath}`;

  user.profileImage = cloudinaryUpload?.url || localUrl;
  await user.save();

  res.status(201).json({
    user: publicUser(user),
    data: {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      fileType: path.extname(req.file.originalname || "").replace(".", "").toLowerCase(),
      mimeType: req.file.mimetype,
      detectedMimeType: req.file.detectedMimeType || "",
      size: req.file.size,
      compressed: Boolean(req.file.compressed),
      compressedSize: req.file.compressedSize || req.file.size,
      optimized: Boolean(req.file.optimized),
      originalSize: req.file.originalSize || req.file.size,
      storage: cloudinaryUpload?.storage || "local",
      url: user.profileImage,
      path: cloudinaryUpload?.publicId || publicPath,
      cloudinary: cloudinaryUpload
    }
  });
});

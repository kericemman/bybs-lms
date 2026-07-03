import path from "node:path";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { uploadToCloudinary } from "../services/cloudinaryUploadService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signAccessToken } from "../utils/jwt.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

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

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid login credentials");
  }

  if (user.status !== "active") {
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

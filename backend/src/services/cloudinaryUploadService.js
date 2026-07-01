import crypto from "node:crypto";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

function uploadConfigured() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function signatureFor(params) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${env.cloudinaryApiSecret}`)
    .digest("hex");
}

function safePublicId(file) {
  const extension = path.extname(file.originalname || "");
  const baseName = path.basename(file.originalname || file.filename || "upload", extension);
  const cleanBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "upload";

  return `${Date.now()}-${cleanBase}`;
}

async function fileBlob(file) {
  const buffer = file.buffer || await readFile(file.path);
  return new Blob([buffer], { type: file.mimetype || "application/octet-stream" });
}

export function cloudinaryConfigured() {
  return uploadConfigured();
}

export async function uploadToCloudinary(file) {
  if (!uploadConfigured()) {
    return null;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadParams = {
    folder: env.cloudinaryFolder,
    overwrite: "false",
    public_id: safePublicId(file),
    timestamp,
    unique_filename: "true",
    use_filename: "true"
  };
  const formData = new FormData();

  Object.entries(uploadParams).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  formData.append("api_key", env.cloudinaryApiKey);
  formData.append("signature", signatureFor(uploadParams));
  formData.append("file", await fileBlob(file), file.originalname || file.filename || "upload");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/auto/upload`, {
    method: "POST",
    body: formData
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      502,
      data?.error?.message || "Cloudinary upload failed"
    );
  }

  if (file.path) {
    await unlink(file.path).catch(() => {});
  }

  return {
    assetId: data.asset_id,
    publicId: data.public_id,
    resourceType: data.resource_type,
    deliveryType: data.type,
    secureUrl: data.secure_url,
    url: data.secure_url || data.url,
    bytes: data.bytes,
    format: data.format,
    width: data.width,
    height: data.height,
    createdAt: data.created_at,
    storage: "cloudinary"
  };
}

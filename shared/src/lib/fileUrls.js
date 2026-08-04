const DEFAULT_API_BASE_URL = "http://localhost:5050/api";

function cleanBaseUrl(apiBaseUrl = DEFAULT_API_BASE_URL) {
  return String(apiBaseUrl || DEFAULT_API_BASE_URL)
    .trim()
    .replace(/\/api\/?$/i, "")
    .replace(/\/$/, "");
}

export function normalizeFileUrl(value = "", apiBaseUrl = DEFAULT_API_BASE_URL) {
  const source = String(value || "").trim();

  if (!source) return "";
  if (/^(https?:|data:|blob:|mailto:|tel:)/i.test(source)) return source;
  if (source.startsWith("//")) {
    const protocol = globalThis?.location?.protocol || "https:";
    return `${protocol}${source}`;
  }

  const uploadPath = source.match(/^\/?uploads\/(.+)$/i);
  if (uploadPath) {
    return `${cleanBaseUrl(apiBaseUrl)}/uploads/${uploadPath[1]}`;
  }

  return source;
}

export function downloadFileUrl(value = "", apiBaseUrl = DEFAULT_API_BASE_URL) {
  const source = normalizeFileUrl(value, apiBaseUrl);

  if (!/^https?:\/\//i.test(source)) return source;
  if (!source.includes("res.cloudinary.com") || !source.includes("/upload/")) return source;
  if (source.includes("/upload/fl_attachment")) return source;

  return source.replace("/upload/", "/upload/fl_attachment/");
}

export function isUploadedFileUrl(value = "") {
  const source = String(value || "").trim();
  return /^\/?uploads\//i.test(source) || /\/uploads\/[^?#]+/i.test(source) || /res\.cloudinary\.com\/.+\/upload\//i.test(source);
}

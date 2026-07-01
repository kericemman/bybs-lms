export function formatDateTime(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

export function formatDate(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

export function relatedTitle(value, fallback = "Unassigned") {
  return value?.title || value?.name || fallback;
}

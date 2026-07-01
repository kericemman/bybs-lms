import { compressUploadFormData } from "./uploadCompression.js";

export function createApiClient({ baseUrl, getToken }) {
  async function request(path, options = {}) {
    const token = getToken?.();
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      const message = data?.message || "Request failed";
      const error = new Error(message);
      error.status = response.status;
      error.details = data?.details || null;
      throw error;
    }

    return data;
  }

  return {
    get: (path, options) => request(path, { ...options, method: "GET" }),
    post: (path, body, options) =>
      request(path, { ...options, method: "POST", body: JSON.stringify(body) }),
    put: (path, body, options) =>
      request(path, { ...options, method: "PUT", body: JSON.stringify(body) }),
    patch: (path, body, options) =>
      request(path, { ...options, method: "PATCH", body: JSON.stringify(body) }),
    delete: (path, options) => request(path, { ...options, method: "DELETE" }),
    upload: async (path, formData, options = {}) =>
      request(path, {
        ...options,
        method: "POST",
        body: options.compress === false ? formData : await compressUploadFormData(formData)
      })
  };
}

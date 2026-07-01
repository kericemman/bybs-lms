import { createApiClient } from "@bybs/shared";
import { toQueryString } from "../utils/query.js";

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export const api = createApiClient({
  baseUrl,
  getToken: () => window.localStorage.getItem("bybs_mentor_token")
});

export const mentorApi = {
  dashboard: () => api.get("/mentor/dashboard"),
  listModules: (filters = {}) => api.get(`/mentor/modules${toQueryString({ limit: 100, ...filters })}`),
  listSessions: (filters = {}) => api.get(`/mentor/sessions${toQueryString({ limit: 100, ...filters })}`),
  listAssignments: (filters = {}) => api.get(`/mentor/assignments${toQueryString({ limit: 100, ...filters })}`),
  sendAssignmentReminder: (payload) => api.post("/mentor/assignment-reminders", payload),
  uploadSessionFile: (formData) => api.upload("/mentor/uploads", formData),
  createSessionWork: (payload) => api.post("/mentor/session-work", payload),
  listStudents: (filters = {}) => api.get(`/mentor/students${toQueryString({ limit: 100, ...filters })}`),
  listSubmissions: (filters = {}) => api.get(`/mentor/submissions${toQueryString({ limit: 100, ...filters })}`),
  reviewSubmission: (id, payload) => api.patch(`/mentor/submissions/${id}/review`, payload),
  listAvailability: () => api.get("/mentor/availability"),
  createAvailability: (payload) => api.post("/mentor/availability", payload),
  updateAvailability: (id, payload) => api.patch(`/mentor/availability/${id}`, payload),
  deleteAvailability: (id) => api.delete(`/mentor/availability/${id}`),
  listBookings: (filters = {}) => api.get(`/mentor/bookings${toQueryString({ limit: 100, ...filters })}`),
  updateBooking: (id, payload) => api.patch(`/mentor/bookings/${id}`, payload),
  listReports: (filters = {}) => api.get(`/mentor/reports${toQueryString({ limit: 100, ...filters })}`),
  createReport: (payload) => api.post("/mentor/reports", payload),
  listBetaFeedback: (filters = {}) => api.get(`/mentor/beta-feedback${toQueryString({ limit: 100, ...filters })}`),
  createBetaFeedback: (payload) => api.post("/mentor/beta-feedback", payload)
};

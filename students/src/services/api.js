import { createApiClient } from "@bybs/shared";
import { toQueryString } from "../utils/query.js";

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export const api = createApiClient({
  baseUrl,
  getToken: () => window.localStorage.getItem("bybs_student_token")
});

export const studentApi = {
  submitBetaApplication: (payload) => api.post("/public/beta-applications", payload),
  dashboard: () => api.get("/student/dashboard"),
  listModules: (filters = {}) => api.get(`/student/modules${toQueryString({ limit: 100, ...filters })}`),
  listSessions: (filters = {}) => api.get(`/student/sessions${toQueryString({ limit: 100, ...filters })}`),
  listMaterials: (filters = {}) => api.get(`/student/materials${toQueryString({ limit: 100, ...filters })}`),
  listAssignments: (filters = {}) => api.get(`/student/assignments${toQueryString({ limit: 100, ...filters })}`),
  uploadFile: (formData) => api.upload("/student/uploads", formData),
  submitAssignment: (id, payload) => api.post(`/student/assignments/${id}/submission`, payload),
  progress: () => api.get("/student/progress"),
  listAvailability: () => api.get("/student/availability"),
  listBookings: (filters = {}) => api.get(`/student/bookings${toQueryString({ limit: 100, ...filters })}`),
  createBooking: (payload) => api.post("/student/bookings", payload),
  cancelBooking: (id) => api.patch(`/student/bookings/${id}`, { status: "cancelled" }),
  listSupportTickets: (filters = {}) => api.get(`/student/support-tickets${toQueryString({ limit: 100, ...filters })}`),
  createSupportTicket: (payload) => api.post("/student/support-tickets", payload),
  replySupportTicket: (id, payload) => api.post(`/student/support-tickets/${id}/replies`, payload),
  listBetaFeedback: (filters = {}) => api.get(`/student/beta-feedback${toQueryString({ limit: 100, ...filters })}`),
  createBetaFeedback: (payload) => api.post("/student/beta-feedback", payload),
  listNotifications: (filters = {}) => api.get(`/student/notifications${toQueryString({ limit: 100, ...filters })}`),
  markNotificationRead: (id) => api.patch(`/student/notifications/${id}/read`, {})
};

import { createApiClient } from "@bybs/shared";
import { toQueryString } from "../utils/query.js";

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export const api = createApiClient({
  baseUrl,
  getToken: () => window.localStorage.getItem("bybs_student_token")
});

export const studentApi = {
  dashboard: () => api.get("/student/dashboard"),
  globalSearch: (filters = {}) => api.get(`/student/search${toQueryString({ limit: 20, ...filters })}`),
  listModules: (filters = {}) => api.get(`/student/modules${toQueryString({ limit: 100, ...filters })}`),
  listSessions: (filters = {}) => api.get(`/student/sessions${toQueryString({ limit: 100, ...filters })}`),
  listMaterials: (filters = {}) => api.get(`/student/materials${toQueryString({ limit: 100, ...filters })}`),
  listDiscussions: (filters = {}) => api.get(`/student/discussions${toQueryString({ limit: 100, ...filters })}`),
  createDiscussion: (payload) => api.post("/student/discussions", payload),
  updateDiscussion: (id, payload) => api.patch(`/student/discussions/${id}`, payload),
  deleteDiscussion: (id) => api.delete(`/student/discussions/${id}`),
  toggleDiscussionReaction: (id, reaction) => api.patch(`/student/discussions/${id}/reactions`, { reaction }),
  replyDiscussion: (id, payload) => api.post(`/student/discussions/${id}/comments`, payload),
  updateDiscussionComment: (id, commentId, payload) => api.patch(`/student/discussions/${id}/comments/${commentId}`, payload),
  deleteDiscussionComment: (id, commentId) => api.delete(`/student/discussions/${id}/comments/${commentId}`),
  toggleDiscussionCommentReaction: (id, commentId, reaction) => api.patch(`/student/discussions/${id}/comments/${commentId}/reactions`, { reaction }),
  listAssignments: (filters = {}) => api.get(`/student/assignments${toQueryString({ limit: 100, ...filters })}`),
  uploadFile: (formData) => api.upload("/student/uploads", formData),
  submitAssignment: (id, payload) => api.post(`/student/assignments/${id}/submission`, payload),
  progress: () => api.get("/student/progress"),
  listCertificates: () => api.get("/student/certificates"),
  verifyCertificate: (code) => api.get(`/public/certificates/${encodeURIComponent(code)}`),
  listAvailability: () => api.get("/student/availability"),
  listBookings: (filters = {}) => api.get(`/student/bookings${toQueryString({ limit: 100, ...filters })}`),
  createBooking: (payload) => api.post("/student/bookings", payload),
  cancelBooking: (id) => api.patch(`/student/bookings/${id}`, { status: "cancelled" }),
  listSupportTickets: (filters = {}) => api.get(`/student/support-tickets${toQueryString({ limit: 100, ...filters })}`),
  createSupportTicket: (payload) => api.post("/student/support-tickets", payload),
  replySupportTicket: (id, payload) => api.post(`/student/support-tickets/${id}/replies`, payload),
  listNotifications: (filters = {}) => api.get(`/student/notifications${toQueryString({ limit: 100, ...filters })}`),
  markNotificationRead: (id) => api.patch(`/student/notifications/${id}/read`, {})
};

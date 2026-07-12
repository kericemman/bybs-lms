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
  getSessionAttendance: (id) => api.get(`/mentor/sessions/${id}/attendance`),
  updateSessionAttendance: (id, payload) => api.patch(`/mentor/sessions/${id}/attendance`, payload),
  listAssignments: (filters = {}) => api.get(`/mentor/assignments${toQueryString({ limit: 100, ...filters })}`),
  updateAssignment: (id, payload) => api.patch(`/assignments/${id}`, payload),
  deleteAssignment: (id) => api.delete(`/assignments/${id}`),
  listAssignmentReminders: (filters = {}) => api.get(`/mentor/assignment-reminders${toQueryString({ limit: 100, ...filters })}`),
  sendAssignmentReminder: (payload) => api.post("/mentor/assignment-reminders", payload),
  updateAssignmentReminder: (id, payload) => api.patch(`/mentor/assignment-reminders/${id}`, payload),
  deleteAssignmentReminder: (id) => api.delete(`/mentor/assignment-reminders/${id}`),
  uploadSessionFile: (formData) => api.upload("/mentor/uploads", formData),
  createSessionWork: (payload) => api.post("/mentor/session-work", payload),
  listDiscussions: (filters = {}) => api.get(`/mentor/discussions${toQueryString({ limit: 100, ...filters })}`),
  createDiscussion: (payload) => api.post("/mentor/discussions", payload),
  updateDiscussion: (id, payload) => api.patch(`/mentor/discussions/${id}`, payload),
  deleteDiscussion: (id) => api.delete(`/mentor/discussions/${id}`),
  toggleDiscussionReaction: (id, reaction) => api.patch(`/mentor/discussions/${id}/reactions`, { reaction }),
  replyDiscussion: (id, payload) => api.post(`/mentor/discussions/${id}/comments`, payload),
  updateDiscussionComment: (id, commentId, payload) => api.patch(`/mentor/discussions/${id}/comments/${commentId}`, payload),
  deleteDiscussionComment: (id, commentId) => api.delete(`/mentor/discussions/${id}/comments/${commentId}`),
  toggleDiscussionCommentReaction: (id, commentId, reaction) => api.patch(`/mentor/discussions/${id}/comments/${commentId}/reactions`, { reaction }),
  listStudents: (filters = {}) => api.get(`/mentor/students${toQueryString({ limit: 100, ...filters })}`),
  getStudent: (id) => api.get(`/mentor/students/${id}`),
  sendStudentMessage: (id, payload) => api.post(`/mentor/students/${id}/messages`, payload),
  approveGraduation: (id, payload) => api.post(`/mentor/students/${id}/graduation-approval`, payload),
  listSubmissions: (filters = {}) => api.get(`/mentor/submissions${toQueryString({ limit: 100, ...filters })}`),
  reviewSubmission: (id, payload) => api.patch(`/mentor/submissions/${id}/review`, payload),
  listAvailability: () => api.get("/mentor/availability"),
  createAvailability: (payload) => api.post("/mentor/availability", payload),
  updateAvailability: (id, payload) => api.patch(`/mentor/availability/${id}`, payload),
  deleteAvailability: (id) => api.delete(`/mentor/availability/${id}`),
  listBookings: (filters = {}) => api.get(`/mentor/bookings${toQueryString({ limit: 100, ...filters })}`),
  updateBooking: (id, payload) => api.patch(`/mentor/bookings/${id}`, payload),
  listNotifications: (filters = {}) => api.get(`/mentor/notifications${toQueryString({ limit: 100, ...filters })}`),
  markNotificationRead: (id) => api.patch(`/mentor/notifications/${id}/read`, {}),
  listReports: (filters = {}) => api.get(`/mentor/reports${toQueryString({ limit: 100, ...filters })}`),
  createReport: (payload) => api.post("/mentor/reports", payload),
  updateReport: (id, payload) => api.patch(`/mentor/reports/${id}`, payload),
  deleteReport: (id) => api.delete(`/mentor/reports/${id}`),
  listBetaFeedback: (filters = {}) => api.get(`/mentor/beta-feedback${toQueryString({ limit: 100, ...filters })}`),
  createBetaFeedback: (payload) => api.post("/mentor/beta-feedback", payload)
};

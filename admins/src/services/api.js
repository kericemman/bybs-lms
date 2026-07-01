import { createApiClient } from "@bybs/shared";
import { toQueryString } from "../utils/query.js";

const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export const api = createApiClient({
  baseUrl,
  getToken: () => window.localStorage.getItem("bybs_admin_token")
});

function groupAnnouncementNotifications(notifications = [], channel = "") {
  const groups = new Map();

  notifications.forEach((notification) => {
    const sentAt = notification.createdAt || new Date().toISOString();
    const title = notification.templateTitle || notification.title;
    const message = notification.templateMessage || notification.message;
    const previewText = notification.templatePreviewText || notification.previewText;
    const key =
      notification.announcementId ||
      `${title}|${message}|${notification.type}|${sentAt.slice(0, 16)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        _id: key,
        title,
        message,
        type: notification.type,
        channel: notification.channel || "platform",
        previewText,
        ctaLabel: notification.ctaLabel,
        ctaUrl: notification.ctaUrl,
        targetType: notification.targetType || "legacy",
        targetLabel: notification.targetLabel || "Announcement recipients",
        emailDeliveryStatuses: [notification.emailDeliveryStatus || "notRequested"],
        emailSentCount: 0,
        emailFailedCount: 0,
        emailNotConfiguredCount: 0,
        emailDeliveryError: notification.emailDeliveryError || "",
        recipientCount: 0,
        readCount: 0,
        sentAt
      });
    }

    const group = groups.get(key);
    group.recipientCount += 1;
    group.readCount += notification.readStatus ? 1 : 0;
    if (!group.emailDeliveryStatuses.includes(notification.emailDeliveryStatus || "notRequested")) {
      group.emailDeliveryStatuses.push(notification.emailDeliveryStatus || "notRequested");
    }
    group.emailSentCount += notification.emailDeliveryStatus === "sent" ? 1 : 0;
    group.emailFailedCount += notification.emailDeliveryStatus === "failed" ? 1 : 0;
    group.emailNotConfiguredCount += notification.emailDeliveryStatus === "notConfigured" ? 1 : 0;

    if (new Date(sentAt) < new Date(group.sentAt)) {
      group.sentAt = sentAt;
    }
  });

  return Array.from(groups.values())
    .filter((announcement) => !channel || announcement.channel === channel)
    .sort((left, right) => new Date(right.sentAt) - new Date(left.sentAt));
}

async function listAnnouncements(filters = {}) {
  try {
    return await api.get(`/admin/announcements${toQueryString({ limit: 100, ...filters })}`);
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }

    const { channel, ...notificationFilters } = filters;
    const response = await api.get(
      `/admin/notifications${toQueryString({ limit: 100, type: "announcement", ...notificationFilters })}`
    );

    return {
      ...response,
      data: groupAnnouncementNotifications(response.data, channel)
    };
  }
}

export const adminApi = {
  login: (credentials) => api.post("/auth/login", credentials),
  dashboard: () => api.get("/dashboards/admin"),
  listCohorts: (filters = {}) => api.get(`/cohorts${toQueryString({ limit: 100, ...filters })}`),
  createCohort: (payload) => api.post("/cohorts", payload),
  updateCohort: (id, payload) => api.patch(`/cohorts/${id}`, payload),
  deleteCohort: (id) => api.delete(`/cohorts/${id}`),
  listUsers: (filters = {}) => api.get(`/users${toQueryString({ limit: 100, ...filters })}`),
  listStudents: (filters = {}) => api.get(`/users${toQueryString({ role: "student", limit: 100, ...filters })}`),
  listMentors: (filters = {}) => api.get(`/users${toQueryString({ role: "mentor", limit: 100, ...filters })}`),
  createUser: (payload) => api.post("/users", payload),
  updateUser: (id, payload) => api.patch(`/users/${id}`, payload),
  deleteUser: (id) => api.delete(`/users/${id}`),
  permanentlyDeleteMentor: (id) => api.delete(`/users/mentors/${id}/permanent`),
  importStudents: (formData) => api.upload("/users/import/students", formData),
  listAssignments: (filters = {}) => api.get(`/assignments${toQueryString({ limit: 100, ...filters })}`),
  createAssignment: (payload) => api.post("/assignments", payload),
  updateAssignment: (id, payload) => api.patch(`/assignments/${id}`, payload),
  deleteAssignment: (id) => api.delete(`/assignments/${id}`),
  listModules: (filters = {}) => api.get(`/admin/modules${toQueryString({ limit: 100, ...filters })}`),
  createModule: (payload) => api.post("/admin/modules", payload),
  updateModule: (id, payload) => api.patch(`/admin/modules/${id}`, payload),
  deleteModule: (id) => api.delete(`/admin/modules/${id}`),
  listSessions: (filters = {}) => api.get(`/admin/sessions${toQueryString({ limit: 100, ...filters })}`),
  createSession: (payload) => api.post("/admin/sessions", payload),
  updateSession: (id, payload) => api.patch(`/admin/sessions/${id}`, payload),
  deleteSession: (id) => api.delete(`/admin/sessions/${id}`),
  listResources: (filters = {}) => api.get(`/admin/resources${toQueryString({ limit: 100, ...filters })}`),
  createResource: (payload) => api.post("/admin/resources", payload),
  updateResource: (id, payload) => api.patch(`/admin/resources/${id}`, payload),
  deleteResource: (id) => api.delete(`/admin/resources/${id}`),
  uploadResourceFile: (formData) => api.upload("/admin/resources/upload", formData),
  listDiscussions: (filters = {}) => api.get(`/admin/discussions${toQueryString({ limit: 100, ...filters })}`),
  createDiscussion: (payload) => api.post("/admin/discussions", payload),
  updateDiscussion: (id, payload) => api.patch(`/admin/discussions/${id}`, payload),
  deleteDiscussion: (id) => api.delete(`/admin/discussions/${id}`),
  listBookings: (filters = {}) => api.get(`/admin/bookings${toQueryString({ limit: 100, ...filters })}`),
  updateBooking: (id, payload) => api.patch(`/admin/bookings/${id}`, payload),
  listReports: (filters = {}) => api.get(`/admin/reports${toQueryString({ limit: 100, ...filters })}`),
  listSupportTickets: (filters = {}) => api.get(`/admin/support-tickets${toQueryString({ limit: 100, ...filters })}`),
  getSupportTicket: (id) => api.get(`/admin/support-tickets/${id}`),
  updateSupportTicket: (id, payload) => api.patch(`/admin/support-tickets/${id}`, payload),
  listNotifications: (filters = {}) => api.get(`/admin/notifications${toQueryString({ limit: 100, ...filters })}`),
  listAnnouncements,
  createAnnouncement: (payload) => api.post("/admin/announcements", payload),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${encodeURIComponent(id)}`),
  listSystemLogs: (filters = {}) => api.get(`/admin/system-logs${toQueryString({ limit: 100, ...filters })}`),
  listBetaApplications: (filters = {}) => api.get(`/admin/beta-applications${toQueryString({ limit: 100, ...filters })}`),
  updateBetaApplication: (id, payload) => api.patch(`/admin/beta-applications/${id}`, payload),
  sendBetaAcceptanceEmail: (id) => api.post(`/admin/beta-applications/${id}/acceptance-email`, {}),
  deleteBetaApplication: (id) => api.delete(`/admin/beta-applications/${id}`),
  listBetaFeedback: (filters = {}) => api.get(`/admin/beta-feedback${toQueryString({ limit: 100, ...filters })}`),
  updateBetaFeedback: (id, payload) => api.patch(`/admin/beta-feedback/${id}`, payload)
};

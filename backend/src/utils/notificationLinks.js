function idFor(value) {
  return encodeURIComponent(String(value?._id || value?.id || value || ""));
}

const portalRoots = {
  admin: "/discussions",
  adminManager: "/discussions",
  mentor: "/forum",
  student: "/app/forum",
  superAdmin: "/discussions"
};

export const notificationLinks = Object.freeze({
  adminCertificate: (certificate) => `/certificates?certificate=${idFor(certificate)}`,
  adminSupportTicket: (ticket) => `/support?ticket=${idFor(ticket)}`,
  adminSystemLog: (log) => `/system-logs?log=${idFor(log)}`,
  discussion: (role, discussion) => `${portalRoots[role] || portalRoots.student}?discussion=${idFor(discussion)}`,
  mentorBooking: (booking) => `/bookings?booking=${idFor(booking)}`,
  mentorReport: (report) => `/reports?report=${idFor(report)}`,
  mentorQuestion: (question) => `/questions?question=${idFor(question)}`,
  mentorSession: (session) => `/session-work?session=${idFor(session)}`,
  mentorSubmission: ({ module, submission }) =>
    `/reviews?module=${idFor(module)}&submission=${idFor(submission)}`,
  studentAssignment: (assignment) => `/app/assignments?assignment=${idFor(assignment)}`,
  studentBooking: (booking) => `/app/bookings?booking=${idFor(booking)}`,
  studentCertificate: (certificate) => `/app/certificates?certificate=${idFor(certificate)}`,
  studentNotification: (notification) => `/app/notifications?notification=${idFor(notification)}`,
  studentQuestion: (question) => `/app/questions?question=${idFor(question)}`,
  studentSupportTicket: (ticket) => `/app/support?ticket=${idFor(ticket)}`
});

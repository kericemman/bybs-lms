function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function objectValue(value) {
  return typeof value?.toObject === "function" ? value.toObject() : value;
}

export function assertAttendanceVersion(session, expectedUpdatedAt) {
  if (!expectedUpdatedAt) return;

  const expectedTime = new Date(expectedUpdatedAt).getTime();
  const currentTime = new Date(session.updatedAt).getTime();

  if (!Number.isFinite(expectedTime) || expectedTime !== currentTime) {
    const error = new Error("Attendance changed after you opened this roster. Refresh it and try again.");
    error.statusCode = 409;
    throw error;
  }
}

export function summarizeAttendance(session, expectedCount = 0) {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  (session.attendance || []).forEach((record) => {
    if (counts[record.status] !== undefined) counts[record.status] += 1;
  });

  const marked = Object.values(counts).reduce((total, count) => total + count, 0);
  const total = expectedCount || marked;

  return {
    ...counts,
    marked,
    total,
    pending: Math.max(total - marked, 0)
  };
}

export function buildAttendanceRoster(students = [], session) {
  const attendanceByStudent = new Map(
    (session.attendance || []).map((record) => [idFor(record.student), record])
  );

  return students.map((student) => {
    const record = attendanceByStudent.get(idFor(student));

    return {
      student: {
        _id: student._id,
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        status: student.status,
        profileImage: student.profileImage
      },
      status: record?.status || "notMarked",
      markedBy: record?.markedBy,
      markedAt: record?.markedAt
    };
  });
}

export function applyAttendanceRecords({ session, records = [], actor, reason = "Attendance updated" }) {
  const actorId = actor?._id || actor;
  const actorRole = actor?.role || "system";
  const changedAt = new Date();
  const attendanceByStudent = new Map(
    (session.attendance || []).map((record) => [idFor(record.student), objectValue(record)])
  );
  const auditEntries = [];

  records.forEach((record) => {
    const studentId = idFor(record.student);
    const existing = attendanceByStudent.get(studentId);
    const previousStatus = existing?.status || "notMarked";

    if (previousStatus === record.status) return;

    if (record.status === "notMarked") {
      attendanceByStudent.delete(studentId);
    } else {
      attendanceByStudent.set(studentId, {
        ...existing,
        student: record.student,
        status: record.status,
        markedBy: actorId,
        markedAt: changedAt
      });
    }

    auditEntries.push({
      student: record.student,
      previousStatus,
      newStatus: record.status,
      changedBy: actorId,
      changedAt,
      sourceRole: actorRole,
      reason
    });
  });

  session.attendance = [...attendanceByStudent.values()];
  session.attendanceAudit = [...(session.attendanceAudit || []), ...auditEntries];

  return {
    changedCount: auditEntries.length,
    changedAt
  };
}

const normalizeAttendanceStatus = (value) =>
  String(value || "").trim().toUpperCase();

const isCurrentlyPresentEvacuationAttendance = (attendance) =>
  Boolean(attendance) &&
  normalizeAttendanceStatus(attendance.status) === "PRESENT" &&
  !attendance.time_out;

module.exports = {
  isCurrentlyPresentEvacuationAttendance,
};

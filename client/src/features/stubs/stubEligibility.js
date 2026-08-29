const normalizeAttendanceStatus = (value) =>
  String(value || "").trim().toUpperCase();

export const isCurrentlyPresentStubRow = (row) => {
  const attendanceStatus =
    row?.latest_attendance_status ?? row?.latest_attendance?.status;
  const attendanceTimeOut =
    row?.latest_attendance_time_out ?? row?.latest_attendance?.time_out;

  return (
    normalizeAttendanceStatus(attendanceStatus) === "PRESENT" &&
    !attendanceTimeOut
  );
};

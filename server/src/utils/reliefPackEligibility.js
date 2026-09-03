const normalizeAttendanceStatus = (value) =>
  String(value || "").trim().toUpperCase();

const isCurrentlyPresentEvacuationAttendance = (attendance) =>
  Boolean(attendance) &&
  normalizeAttendanceStatus(attendance.status) === "PRESENT" &&
  !attendance.time_out;

const isReliefPackClaimHouseholdCurrentlyEligible = (stub, attendance) =>
  Boolean(stub) &&
  stub.is_active !== false &&
  String(stub.current_stay_type || "").trim().toUpperCase() === "EVAC_CENTER" &&
  isCurrentlyPresentEvacuationAttendance(attendance);

module.exports = {
  isCurrentlyPresentEvacuationAttendance,
  isReliefPackClaimHouseholdCurrentlyEligible,
};

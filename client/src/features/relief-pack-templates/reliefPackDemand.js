const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

export const isHouseholdEligibleForReliefPackDemand = (household) => {
  const stubStatus = normalizeStatus(household?.stub?.status);
  const stayType = normalizeStatus(household?.current_stay_type);
  const latestAttendance = household?.latest_attendance;
  const latestAttendanceStatus = normalizeStatus(latestAttendance?.status);

  if (stubStatus !== "ISSUED") {
    return false;
  }

  if (stayType !== "EVAC_CENTER") {
    return false;
  }

  if (household?.is_active === false || !latestAttendance) {
    return false;
  }

  if (latestAttendance?.time_out) {
    return false;
  }

  return latestAttendanceStatus === "PRESENT";
};

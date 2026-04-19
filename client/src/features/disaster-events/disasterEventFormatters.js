export const NON_RESIDENT_BARANGAY_CODE = "NON_RESIDENT_OUTSIDE_MALVAR";
export const NON_RESIDENT_BARANGAY_NAME = "Non-Resident (Outside Malvar)";

export const formatDisasterEventDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const isValidAffectedBarangay = (barangay) => {
  if (!barangay) {
    return false;
  }

  if (barangay.code === NON_RESIDENT_BARANGAY_CODE) {
    return false;
  }

  if ((barangay.name || barangay) === NON_RESIDENT_BARANGAY_NAME) {
    return false;
  }

  return true;
};

export const getAffectedBarangayDisplayItems = (
  affectedBarangays,
  validBarangayCount,
) => {
  const validAffectedBarangays = (affectedBarangays || []).filter(
    isValidAffectedBarangay,
  );
  const uniqueAffectedBarangayIds = new Set(
    validAffectedBarangays.map(
      (barangay) => barangay.id || barangay.name || barangay,
    ),
  );

  if (
    validBarangayCount > 0 &&
    uniqueAffectedBarangayIds.size === validBarangayCount
  ) {
    return ["All Barangays"];
  }

  return validAffectedBarangays;
};

export const formatAffectedBarangays = (
  affectedBarangays,
  validBarangayCount,
) => {
  const displayItems = getAffectedBarangayDisplayItems(
    affectedBarangays,
    validBarangayCount,
  );

  if (displayItems.length === 0) {
    return "--";
  }

  return displayItems.map((barangay) => barangay.name || barangay).join(", ");
};

const getTimestamp = (value) => {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const sortMasterlistRows = (rows, sortOrder = "newest", options = {}) => {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  if (options.recordStatus === "archived" && ["oldest", "newest"].includes(sortOrder)) {
    return safeRows.sort((leftRow, rightRow) => {
      const leftTime = getTimestamp(leftRow?.departure_time_value);
      const rightTime = getTimestamp(rightRow?.departure_time_value);

      if (leftTime === null && rightTime === null) return 0;
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;
      if (leftTime === rightTime) return 0;

      return sortOrder === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime;
    });
  }

  return safeRows.sort((leftRow, rightRow) => {
    if (sortOrder === "oldest" || sortOrder === "newest") {
      const leftTime = new Date(leftRow?.registered_at || 0).getTime();
      const rightTime = new Date(rightRow?.registered_at || 0).getTime();

      if (leftTime !== rightTime) {
        return sortOrder === "oldest"
          ? leftTime - rightTime
          : rightTime - leftTime;
      }
    }

    const leftName = String(leftRow?.family_head_name || "").trim().toUpperCase();
    const rightName = String(rightRow?.family_head_name || "").trim().toUpperCase();

    if (leftName !== rightName) {
      if (sortOrder === "za") {
        return rightName.localeCompare(leftName);
      }

      return leftName.localeCompare(rightName);
    }

    const leftTime = new Date(leftRow?.registered_at || 0).getTime();
    const rightTime = new Date(rightRow?.registered_at || 0).getTime();
    return rightTime - leftTime;
  });
};

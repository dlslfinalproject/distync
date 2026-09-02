export const sortMasterlistRows = (rows, sortOrder = "newest") => {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

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

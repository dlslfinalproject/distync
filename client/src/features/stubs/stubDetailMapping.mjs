export const getCanonicalStubRecord = (stubDetails) => {
  if (stubDetails?.stub && typeof stubDetails.stub === "object") {
    return stubDetails.stub;
  }

  return stubDetails && typeof stubDetails === "object" ? stubDetails : {};
};

export const getDisplayStubNumber = (stubRecord) => {
  const displayStubNo = String(stubRecord?.display_stub_no || "").trim();
  if (displayStubNo) {
    return displayStubNo;
  }

  const sequenceNo = Number(
    stubRecord?.stub_sequence_no || stubRecord?.stub_number || 0,
  );
  if (Number.isFinite(sequenceNo) && sequenceNo > 0) {
    return `STUB#${sequenceNo}`;
  }

  return String(stubRecord?.stub_no || stubRecord?.serial_no || "").trim() || "-";
};

export const mapDistributionHistoryDetailForModal = (detail, historyRow) => {
  const stubRecord = detail?.stub;
  if (!stubRecord || typeof stubRecord !== "object") {
    return detail;
  }

  const detailSequenceNo = Number(stubRecord.stub_sequence_no || 0);
  const historySequenceNo = Number(historyRow?.stub_sequence_no || 0);
  const canonicalDisplayStubNo = String(stubRecord.display_stub_no || "").trim();
  const sequenceNo =
    Number.isFinite(detailSequenceNo) && detailSequenceNo > 0
      ? detailSequenceNo
      : Number.isFinite(historySequenceNo) && historySequenceNo > 0
        ? historySequenceNo
        : 0;
  const displayStubNo =
    canonicalDisplayStubNo || (sequenceNo > 0 ? `STUB#${sequenceNo}` : "");

  return {
    ...detail,
    stub: {
      ...stubRecord,
      ...(sequenceNo > 0 ? { stub_sequence_no: sequenceNo } : {}),
      ...(displayStubNo ? { display_stub_no: displayStubNo } : {}),
    },
  };
};

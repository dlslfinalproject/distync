export const NO_ASSIGNED_RELIEF_PACK_CODE = "NO_ASSIGNED_RELIEF_PACK";

export const CLAIM_ERROR_DIALOG_TITLE = "Unable to Process Claim";

export const NO_ASSIGNED_RELIEF_PACK_MESSAGE =
  "No active standard relief pack is assigned to this household. Please coordinate with the Office of the Mayor before processing the claim.";

const normalizeErrorCode = (error) =>
  String(error?.code || error?.error || "").trim().toUpperCase();

export const getStubClaimErrorDialog = (
  error,
  fallbackMessage = "Unable to mark the stub as claimed.",
) => {
  const code = normalizeErrorCode(error);

  if (code === NO_ASSIGNED_RELIEF_PACK_CODE) {
    return {
      title: CLAIM_ERROR_DIALOG_TITLE,
      message: NO_ASSIGNED_RELIEF_PACK_MESSAGE,
    };
  }

  return {
    title: CLAIM_ERROR_DIALOG_TITLE,
    message: error?.message || fallbackMessage,
  };
};

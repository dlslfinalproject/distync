const getClaimStubData = (claimResult) => {
  const data = claimResult?.data;
  return data && typeof data === "object" && !Array.isArray(data)
    ? data
    : claimResult || {};
};

export const buildCachedStubClaimTerminalPatch = (
  claimResult,
  terminalStatus,
  updatedAt,
) => {
  const claimData = getClaimStubData(claimResult);
  const claimedAt = claimData.claimed_at;

  return {
    status: "CLAIMED",
    last_terminal_sync_status: terminalStatus,
    updated_at: updatedAt,
    ...(typeof claimedAt === "string" && claimedAt.trim()
      ? { claimed_at: claimedAt }
      : {}),
  };
};

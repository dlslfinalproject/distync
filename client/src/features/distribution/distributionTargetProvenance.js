export const DISTRIBUTION_STUB_PROVENANCE = Object.freeze({
  UNVERIFIED_NAVIGATION_HINT: "UNVERIFIED_NAVIGATION_HINT",
  SERVER_VERIFIED: "SERVER_VERIFIED",
});

export const UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE =
  "This distribution target must be verified online before recording distribution.";

const trimValue = (value) => String(value || "").trim();

export const getDistributionTargetKey = (stubContext) => {
  if (!stubContext) {
    return "";
  }

  const stubId = trimValue(stubContext.stub_id);
  const householdId = trimValue(stubContext.household_id);
  const disasterEventId = trimValue(stubContext.disaster_event_id);

  if (!stubId || !householdId || !disasterEventId) {
    return "";
  }

  return [stubId, householdId, disasterEventId].join("|");
};

export const markDistributionTargetAsUnverified = (stubContext) => {
  if (!stubContext) {
    return null;
  }

  return {
    ...stubContext,
    provenance: DISTRIBUTION_STUB_PROVENANCE.UNVERIFIED_NAVIGATION_HINT,
    trusted_target_key: "",
  };
};

export const markDistributionTargetAsServerVerified = (stubContext) => {
  if (!stubContext) {
    return null;
  }

  const targetKey = getDistributionTargetKey(stubContext);

  return {
    ...stubContext,
    provenance: DISTRIBUTION_STUB_PROVENANCE.SERVER_VERIFIED,
    trusted_target_key: targetKey,
  };
};

export const isServerVerifiedDistributionTarget = (stubContext) => {
  const targetKey = getDistributionTargetKey(stubContext);

  return Boolean(
    stubContext &&
      targetKey &&
      stubContext.provenance === DISTRIBUTION_STUB_PROVENANCE.SERVER_VERIFIED &&
      stubContext.trusted_target_key === targetKey,
  );
};

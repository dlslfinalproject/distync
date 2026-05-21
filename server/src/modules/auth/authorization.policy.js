const POLICY_DEFINITIONS = {
  SYSTEM_LOG_REVIEW: {
    description: "Read-only access to audit and error log review",
    roles: ["MAYOR"],
    permission_codes: ["AUDIT_LOG_REVIEW", "ERROR_LOG_REVIEW"],
  },
};

const getPolicyDefinition = (policyName) => {
  return POLICY_DEFINITIONS[policyName] || null;
};

const getAllowedRolesForPolicy = (policyName) => {
  return getPolicyDefinition(policyName)?.roles || [];
};

const getPermissionCodesForPolicy = (policyName) => {
  return getPolicyDefinition(policyName)?.permission_codes || [];
};

module.exports = {
  POLICY_DEFINITIONS,
  getAllowedRolesForPolicy,
  getPermissionCodesForPolicy,
  getPolicyDefinition,
};

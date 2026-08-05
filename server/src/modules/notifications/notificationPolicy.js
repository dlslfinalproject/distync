const { ROLE_CODES } = require("../auth/auth.middleware");

const PRIORITY = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFORMATIONAL: "INFORMATIONAL",
};

const IN_APP_POLICY = {
  MANDATORY: "MANDATORY",
  OPTIONAL: "OPTIONAL",
  NOT_APPLICABLE: "NOT_APPLICABLE",
};

const EMAIL_POLICY = {
  DEFAULT_ON: "DEFAULT_ON",
  OPTIONAL: "OPTIONAL",
  UNAVAILABLE: "UNAVAILABLE",
};

const DELIVERY_MODE = {
  IMMEDIATE: "IMMEDIATE",
  HOURLY_SUMMARY: "HOURLY_SUMMARY",
  DAILY_SUMMARY: "DAILY_SUMMARY",
  THRESHOLD: "THRESHOLD",
  SILENT_UI_FEEDBACK: "SILENT_UI_FEEDBACK",
};

const USER_CONFIGURABILITY = {
  NONE: "NONE",
  EMAIL_ONLY: "EMAIL_ONLY",
  ALL_SUPPORTED_CHANNELS: "ALL_SUPPORTED_CHANNELS",
};

const CANONICAL_NOTIFICATION_RULES = [
  {
    code: "DISASTER_EVENT_CREATED",
    name: "Newly Created Disaster Event",
    triggerType: "DISASTER_EVENT_CREATED",
    targetRoleCode: ROLE_CODES.MSWDO,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "DISASTER_MANAGEMENT",
        categoryLabel: "Disaster Management",
        priority: PRIORITY.WARNING,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "DISASTER_EVENT_UPDATED",
    name: "Disaster Event Updates",
    triggerType: "DISASTER_EVENT_UPDATED",
    targetRoleCode: ROLE_CODES.MSWDO,
    legacyCodes: ["DISASTER_EVENT_UPDATE"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "DISASTER_COORDINATION",
        categoryLabel: "Disaster Coordination",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "DISASTER_MANAGEMENT",
        categoryLabel: "Disaster Management",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "DISASTER_MONITORING",
        categoryLabel: "Disaster Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "HOUSEHOLD_REGISTERED",
    name: "New Evacuee Registration",
    triggerType: "HOUSEHOLD_REGISTRATION",
    targetRoleCode: ROLE_CODES.BARANGAY,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.UNAVAILABLE,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
    ],
  },
  {
    code: "EVACUEE_ATTENDANCE_UPDATED",
    name: "Evacuee Attendance Updates",
    triggerType: "EVACUEE_ATTENDANCE_UPDATED",
    targetRoleCode: ROLE_CODES.BARANGAY,
    legacyCodes: ["EVACUEE_ATTENDANCE_UPDATE"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.UNAVAILABLE,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
    ],
  },
  {
    code: "HOUSEHOLD_VERIFICATION_UPDATED",
    name: "Household Verification Updates",
    triggerType: "HOUSEHOLD_VERIFICATION_UPDATED",
    targetRoleCode: ROLE_CODES.BARANGAY,
    legacyCodes: ["HOUSEHOLD_VERIFICATION", "HOUSEHOLD_VERIFICATION_UPDATE"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.WARNING,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "EVACUEE_MANAGEMENT",
        categoryLabel: "Evacuee Management",
        priority: PRIORITY.WARNING,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "DISTRIBUTION_COMPLETED",
    name: "Distribution Completed",
    triggerType: "DISTRIBUTION_COMPLETED",
    targetRoleCode: ROLE_CODES.MSWDO,
    legacyCodes: ["DISTRIBUTION_UPDATE"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "RELIEF_OPERATIONS",
        categoryLabel: "Relief Operations",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "RELIEF_OPERATIONS",
        categoryLabel: "Relief Operations",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.HOURLY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
    ],
  },
  {
    code: "LOW_STOCK",
    name: "Low Stock Alert",
    triggerType: "INVENTORY_STOCK_THRESHOLD",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "INVENTORY_MONITORING",
        categoryLabel: "Inventory Monitoring",
        priority: PRIORITY.WARNING,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.THRESHOLD,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "CRITICAL_INVENTORY_SHORTAGE",
    name: "Critical Inventory Shortage",
    triggerType: "CRITICAL_INVENTORY_SHORTAGE",
    targetRoleCode: ROLE_CODES.MAYOR,
    legacyCodes: ["CRITICAL_STOCK"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "INVENTORY_MONITORING",
        categoryLabel: "Inventory Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.THRESHOLD,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "NEAR_EXPIRY_STOCK",
    name: "Near Expiry Stock Alert",
    triggerType: "INVENTORY_EXPIRY",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "INVENTORY_MONITORING",
        categoryLabel: "Inventory Monitoring",
        priority: PRIORITY.WARNING,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.THRESHOLD,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "EXPIRED_STOCK",
    name: "Expired Stock Alert",
    triggerType: "INVENTORY_EXPIRY",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "INVENTORY_MONITORING",
        categoryLabel: "Inventory Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "INVENTORY_INCIDENT",
    name: "Inventory Incident Alert",
    triggerType: "INVENTORY_INCIDENT",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "INVENTORY_MONITORING",
        categoryLabel: "Inventory Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "DONATION_RECEIVED",
    name: "Donation Received",
    triggerType: "DONATION_RECEIVED",
    targetRoleCode: ROLE_CODES.MAYOR,
    legacyCodes: ["DONATION_STOCK_UPDATE"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "RELIEF_OPERATIONS",
        categoryLabel: "Relief Operations",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
    ],
  },
  {
    code: "SYNC_FAILURE",
    name: "Sync Failure",
    triggerType: "SYNC_FAILURE",
    targetRoleCode: ROLE_CODES.BARANGAY,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "SYSTEM_MONITORING",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "SYNC_CONFLICT",
    name: "Synchronization Conflict Alert",
    triggerType: "SYNC_CONFLICT",
    targetRoleCode: ROLE_CODES.BARANGAY,
    legacyCodes: ["SYNCHRONIZATION_CONFLICT_ALERT"],
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "SYSTEM_MONITORING",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "DONATION_STOCK_ANOMALY",
    name: "Donation Anomaly",
    triggerType: "DONATION_ANOMALY",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "SYSTEM_MONITORING",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "EVACUATION_SUMMARY_REPORT",
    name: "Evacuation Summary Reports",
    triggerType: "EVACUATION_SUMMARY_REPORT",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: true,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "DISASTER_MONITORING",
        categoryLabel: "Disaster Monitoring",
        priority: PRIORITY.INFORMATIONAL,
        inAppPolicy: IN_APP_POLICY.OPTIONAL,
        emailPolicy: EMAIL_POLICY.OPTIONAL,
        deliveryMode: DELIVERY_MODE.DAILY_SUMMARY,
        userConfigurability: USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
      },
    ],
  },
  {
    code: "SYSTEM_ALERT",
    name: "System Alerts",
    triggerType: "SYSTEM_ALERT",
    targetRoleCode: ROLE_CODES.BARANGAY,
    isVisibleInSettings: false,
    isActive: false,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "System Monitoring",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "SYSTEM_ANOMALY",
    name: "System Anomaly Alert",
    triggerType: "SYSTEM_ANOMALY",
    targetRoleCode: ROLE_CODES.BARANGAY,
    isVisibleInSettings: false,
    isActive: false,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.BARANGAY,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MSWDO,
        categoryCode: "SYSTEM_OPERATIONS",
        categoryLabel: "System Operations",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "SYSTEM_MONITORING",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
  {
    code: "OPERATIONAL_ANOMALY",
    name: "Operational Anomaly Alerts",
    triggerType: "OPERATIONAL_ANOMALY",
    targetRoleCode: ROLE_CODES.MAYOR,
    isVisibleInSettings: false,
    isActive: false,
    rolePolicies: [
      {
        roleCode: ROLE_CODES.MAYOR,
        categoryCode: "SYSTEM_MONITORING",
        categoryLabel: "System Monitoring",
        priority: PRIORITY.CRITICAL,
        inAppPolicy: IN_APP_POLICY.MANDATORY,
        emailPolicy: EMAIL_POLICY.DEFAULT_ON,
        deliveryMode: DELIVERY_MODE.IMMEDIATE,
        userConfigurability: USER_CONFIGURABILITY.EMAIL_ONLY,
      },
    ],
  },
];

const RULES_BY_CODE = new Map(
  CANONICAL_NOTIFICATION_RULES.map((rule) => [rule.code, rule]),
);

const RULE_SORT_ORDER = new Map(
  CANONICAL_NOTIFICATION_RULES.map((rule, index) => [rule.code, index]),
);

const CATEGORY_SORT_ORDER_BY_ROLE = {
  [ROLE_CODES.BARANGAY]: new Map([
    ["DISASTER_COORDINATION", 0],
    ["EVACUEE_MANAGEMENT", 1],
    ["SYSTEM_OPERATIONS", 2],
  ]),
  [ROLE_CODES.MSWDO]: new Map([
    ["DISASTER_MANAGEMENT", 0],
    ["EVACUEE_MANAGEMENT", 1],
    ["RELIEF_OPERATIONS", 2],
    ["SYSTEM_OPERATIONS", 3],
  ]),
  [ROLE_CODES.MAYOR]: new Map([
    ["DISASTER_MONITORING", 0],
    ["RELIEF_OPERATIONS", 1],
    ["INVENTORY_MONITORING", 2],
    ["SYSTEM_MONITORING", 3],
  ]),
};

const LEGACY_CODE_TO_CANONICAL_CODE = CANONICAL_NOTIFICATION_RULES.reduce(
  (current, rule) => {
    (rule.legacyCodes || []).forEach((legacyCode) => {
      current[legacyCode] = rule.code;
    });
    return current;
  },
  {},
);

const NOTIFICATION_POLICY_ROWS = CANONICAL_NOTIFICATION_RULES.flatMap((rule) =>
  (rule.rolePolicies || []).map((policy) => ({
    ruleCode: rule.code,
    roleCode: policy.roleCode,
    categoryCode: policy.categoryCode,
    categoryLabel: policy.categoryLabel,
    priority: policy.priority,
    inAppPolicy: policy.inAppPolicy,
    emailPolicy: policy.emailPolicy,
    deliveryMode: policy.deliveryMode,
    userConfigurability: policy.userConfigurability,
    isActive: policy.isActive ?? rule.isActive ?? true,
  })),
);

const NOTIFICATION_RULE_TARGETS = CANONICAL_NOTIFICATION_RULES.map((rule) => ({
  code: rule.code,
  name: rule.name,
  triggerType: rule.triggerType,
  targetRoleCode: rule.targetRoleCode,
  isActive: rule.isActive ?? true,
}));

const getCanonicalRuleCode = (ruleCode = "") =>
  RULES_BY_CODE.has(ruleCode)
    ? ruleCode
    : LEGACY_CODE_TO_CANONICAL_CODE[ruleCode] || ruleCode;

const getCanonicalRuleDefinition = (ruleCode = "") =>
  RULES_BY_CODE.get(getCanonicalRuleCode(ruleCode)) || null;

const getCanonicalRuleSortOrder = (ruleCode = "") =>
  RULE_SORT_ORDER.get(getCanonicalRuleCode(ruleCode)) ?? Number.MAX_SAFE_INTEGER;

const getCategorySortOrder = (roleCode = "", categoryCode = "") =>
  CATEGORY_SORT_ORDER_BY_ROLE[roleCode]?.get(categoryCode) ??
  Number.MAX_SAFE_INTEGER;

const isVisibleInSettings = (ruleCode = "", roleCode = "") => {
  const rule = getCanonicalRuleDefinition(ruleCode);

  if (!rule || rule.isVisibleInSettings === false) {
    return false;
  }

  return (rule.rolePolicies || []).some((policy) => policy.roleCode === roleCode);
};

const getSettingsVisibleRuleCodesForRole = (roleCode = "") =>
  CANONICAL_NOTIFICATION_RULES.filter((rule) =>
    (rule.rolePolicies || []).some((policy) => policy.roleCode === roleCode) &&
    rule.isVisibleInSettings !== false,
  ).map((rule) => rule.code);

const getPolicyRowsForRole = (roleCode) =>
  NOTIFICATION_POLICY_ROWS.filter((row) => row.roleCode === roleCode);

const getPolicyRow = (ruleCode, roleCode) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);

  return (
    NOTIFICATION_POLICY_ROWS.find(
      (row) => row.ruleCode === canonicalRuleCode && row.roleCode === roleCode,
    ) || null
  );
};

const getPolicyRolesForRule = (ruleCode) => {
  const canonicalRuleCode = getCanonicalRuleCode(ruleCode);

  return NOTIFICATION_POLICY_ROWS.filter(
    (row) => row.ruleCode === canonicalRuleCode,
  ).map((row) => row.roleCode);
};

module.exports = {
  PRIORITY,
  IN_APP_POLICY,
  EMAIL_POLICY,
  DELIVERY_MODE,
  USER_CONFIGURABILITY,
  CANONICAL_NOTIFICATION_RULES,
  NOTIFICATION_POLICY_ROWS,
  NOTIFICATION_RULE_TARGETS,
  getCanonicalRuleCode,
  getCanonicalRuleDefinition,
  getCanonicalRuleSortOrder,
  getCategorySortOrder,
  getPolicyRow,
  getPolicyRowsForRole,
  getPolicyRolesForRule,
  getSettingsVisibleRuleCodesForRole,
  isVisibleInSettings,
};

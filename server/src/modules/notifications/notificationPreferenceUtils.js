const {
  EMAIL_POLICY,
  IN_APP_POLICY,
  USER_CONFIGURABILITY,
} = require("./notificationPolicy");

const LEGACY_CATEGORY_RULE_MAP = {
  disasterAlerts: ["DISASTER_EVENT_CREATED", "DISASTER_EVENT_UPDATE", "EVACUATION_SUMMARY_REPORT"],
  distributionSchedules: ["DISTRIBUTION_UPDATE"],
  reliefArrivalNotifications: [
    "LOW_STOCK",
    "CRITICAL_STOCK",
    "NEAR_EXPIRY_STOCK",
    "EXPIRED_STOCK",
    "INVENTORY_INCIDENT",
    "DONATION_STOCK_UPDATE",
    "DONATION_STOCK_ANOMALY",
  ],
  attendanceReminders: [
    "HOUSEHOLD_REGISTERED",
    "HOUSEHOLD_VERIFICATION",
    "EVACUEE_ATTENDANCE_UPDATE",
  ],
  systemAnnouncements: ["SYNC_CONFLICT", "SYSTEM_ANOMALY"],
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const sanitizeNotificationRulePreferences = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((current, [ruleCode, channels]) => {
    if (!ruleCode || !isPlainObject(channels)) {
      return current;
    }

    current[ruleCode] = {};

    if (typeof channels.inApp === "boolean") {
      current[ruleCode].inApp = channels.inApp;
    }

    if (typeof channels.email === "boolean") {
      current[ruleCode].email = channels.email;
    }

    if (Object.keys(current[ruleCode]).length === 0) {
      delete current[ruleCode];
    }

    return current;
  }, {});
};

const getDefaultEffectiveChannels = (policyRow) => ({
  inApp: policyRow?.in_app_policy !== IN_APP_POLICY.NOT_APPLICABLE,
  email: policyRow?.email_policy === EMAIL_POLICY.DEFAULT_ON,
});

const getEditableChannels = (policyRow) => ({
  inApp:
    policyRow?.user_configurability ===
      USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS &&
    policyRow?.in_app_policy === IN_APP_POLICY.OPTIONAL,
  email:
    policyRow?.email_policy !== EMAIL_POLICY.UNAVAILABLE &&
    [
      USER_CONFIGURABILITY.EMAIL_ONLY,
      USER_CONFIGURABILITY.ALL_SUPPORTED_CHANNELS,
    ].includes(policyRow?.user_configurability),
});

const deriveLegacyPreferenceMap = ({
  policyRows = [],
  enabledNotificationRuleCodes = [],
  notificationChannels = {},
}) => {
  const enabledRuleSet = new Set(
    Array.isArray(enabledNotificationRuleCodes)
      ? enabledNotificationRuleCodes.filter(Boolean)
      : [],
  );
  const hasEnabledRuleSelection = enabledRuleSet.size > 0;
  const categoryLookup = Object.entries(LEGACY_CATEGORY_RULE_MAP).reduce(
    (current, [categoryKey, ruleCodes]) => {
      ruleCodes.forEach((ruleCode) => {
        current[ruleCode] = categoryKey;
      });
      return current;
    },
    {},
  );

  return policyRows.reduce((current, policyRow) => {
    const categoryKey = categoryLookup[policyRow.code];
    const legacyChannelValue = categoryKey ? notificationChannels?.[categoryKey] : null;
    const editableChannels = getEditableChannels(policyRow);
    const nextValue = {};

    if (editableChannels.inApp) {
      const legacyInApp =
        typeof legacyChannelValue?.inApp === "boolean"
          ? legacyChannelValue.inApp
          : true;
      nextValue.inApp = hasEnabledRuleSelection
        ? legacyInApp && enabledRuleSet.has(policyRow.code)
        : legacyInApp;
    }

    if (editableChannels.email) {
      nextValue.email =
        typeof legacyChannelValue?.email === "boolean"
          ? legacyChannelValue.email
          : false;
    }

    if (Object.keys(nextValue).length > 0) {
      current[policyRow.code] = nextValue;
    }

    return current;
  }, {});
};

const resolveEffectiveChannels = ({
  policyRow,
  storedPreferences = {},
}) => {
  const sanitizedPreferences = sanitizeNotificationRulePreferences(storedPreferences);
  const rulePreferences = sanitizedPreferences[policyRow.code] || {};
  const defaults = getDefaultEffectiveChannels(policyRow);
  const editableChannels = getEditableChannels(policyRow);

  return {
    inApp: editableChannels.inApp
      ? typeof rulePreferences.inApp === "boolean"
        ? rulePreferences.inApp
        : defaults.inApp
      : defaults.inApp,
    email: editableChannels.email
      ? typeof rulePreferences.email === "boolean"
        ? rulePreferences.email
        : defaults.email
      : false,
  };
};

const buildPreferenceCategories = ({
  roleCode,
  policyRows = [],
  storedPreferences = {},
}) => {
  const categoriesByCode = new Map();

  policyRows.forEach((policyRow) => {
    const effectiveChannels = resolveEffectiveChannels({
      policyRow,
      storedPreferences,
    });
    const editableChannels = getEditableChannels(policyRow);

    if (!categoriesByCode.has(policyRow.category_code)) {
      categoriesByCode.set(policyRow.category_code, {
        code: policyRow.category_code,
        label: policyRow.category_label,
        roleCode,
        rules: [],
      });
    }

    categoriesByCode.get(policyRow.category_code).rules.push({
      code: policyRow.code,
      name: policyRow.name,
      description: `${policyRow.name} delivery for ${roleCode} notifications.`,
      priority: policyRow.priority,
      inAppPolicy: policyRow.in_app_policy,
      emailPolicy: policyRow.email_policy,
      deliveryMode: policyRow.delivery_mode,
      userConfigurability: policyRow.user_configurability,
      effectiveChannels,
      editableChannels,
    });
  });

  return Array.from(categoriesByCode.values());
};

module.exports = {
  LEGACY_CATEGORY_RULE_MAP,
  sanitizeNotificationRulePreferences,
  deriveLegacyPreferenceMap,
  getDefaultEffectiveChannels,
  getEditableChannels,
  resolveEffectiveChannels,
  buildPreferenceCategories,
};

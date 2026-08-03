const {
  EMAIL_POLICY,
  IN_APP_POLICY,
  USER_CONFIGURABILITY,
} = require("./notificationPolicy");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const buildPolicyRuleCodeSet = (policyRows = []) =>
  new Set((policyRows || []).map((policyRow) => policyRow?.code).filter(Boolean));

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

const normalizeRulePreferencesAgainstPolicy = ({
  policyRows = [],
  rulePreferences = {},
}) => {
  const sanitizedPreferences = sanitizeNotificationRulePreferences(rulePreferences);

  if (!Array.isArray(policyRows) || policyRows.length === 0) {
    return sanitizedPreferences;
  }

  return policyRows.reduce((current, policyRow) => {
    const nextValue = {};
    const storedRulePreferences = sanitizedPreferences[policyRow.code] || {};
    const editableChannels = getEditableChannels(policyRow);

    if (editableChannels.inApp && typeof storedRulePreferences.inApp === "boolean") {
      nextValue.inApp = storedRulePreferences.inApp;
    }

    if (editableChannels.email && typeof storedRulePreferences.email === "boolean") {
      nextValue.email = storedRulePreferences.email;
    }

    if (Object.keys(nextValue).length > 0) {
      current[policyRow.code] = nextValue;
    }

    return current;
  }, {});
};

const hasMeaningfulRulePreferences = ({
  policyRows = [],
  rulePreferences = {},
}) => {
  const sanitizedPreferences = sanitizeNotificationRulePreferences(rulePreferences);

  if (!Array.isArray(policyRows) || policyRows.length === 0) {
    return Object.keys(sanitizedPreferences).length > 0;
  }

  const policyRuleCodes = buildPolicyRuleCodeSet(policyRows);

  return Object.keys(sanitizedPreferences).some((ruleCode) =>
    policyRuleCodes.has(ruleCode),
  );
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

const buildEffectiveChannelsByRule = ({
  policyRows = [],
  storedPreferences = {},
}) =>
  policyRows.reduce((current, policyRow) => {
    current[policyRow.code] = resolveEffectiveChannels({
      policyRow,
      storedPreferences,
    });
    return current;
  }, {});

const resolveEffectiveNotificationPreferences = ({
  roleCode = "",
  policyRows = [],
  modernPreferences = {},
}) => {
  const normalizedModernPreferences = normalizeRulePreferencesAgainstPolicy({
    policyRows,
    rulePreferences: modernPreferences,
  });
  const hasModernPreferences = hasMeaningfulRulePreferences({
    policyRows,
    rulePreferences: modernPreferences,
  });

  if (hasModernPreferences) {
    return {
      roleCode,
      source: "modern",
      normalizedPreferences: normalizedModernPreferences,
      effectiveChannels: buildEffectiveChannelsByRule({
        policyRows,
        storedPreferences: normalizedModernPreferences,
      }),
      warnings: [],
    };
  }

  return {
    roleCode,
    source: "policy-defaults",
    normalizedPreferences: {},
    effectiveChannels: buildEffectiveChannelsByRule({
      policyRows,
      storedPreferences: {},
    }),
    warnings: [],
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
  sanitizeNotificationRulePreferences,
  normalizeRulePreferencesAgainstPolicy,
  hasMeaningfulRulePreferences,
  getDefaultEffectiveChannels,
  getEditableChannels,
  resolveEffectiveChannels,
  buildEffectiveChannelsByRule,
  resolveEffectiveNotificationPreferences,
  buildPreferenceCategories,
};

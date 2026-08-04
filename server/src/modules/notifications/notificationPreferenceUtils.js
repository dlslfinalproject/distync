const {
  EMAIL_POLICY,
  IN_APP_POLICY,
  USER_CONFIGURABILITY,
  getCanonicalRuleCode,
  getCanonicalRuleDefinition,
  getCanonicalRuleSortOrder,
  getCategorySortOrder,
  isVisibleInSettings,
} = require("./notificationPolicy");

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeBooleanPreference = (currentValue, nextValue) => {
  if (nextValue === true) {
    return true;
  }

  if (nextValue === false) {
    return currentValue === true ? true : false;
  }

  return currentValue;
};

const buildPolicyRuleCodeSet = (policyRows = []) =>
  new Set(
    (policyRows || [])
      .map((policyRow) => getCanonicalRuleCode(policyRow?.code))
      .filter(Boolean),
  );

const sanitizeNotificationRulePreferences = (value) => {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((current, [ruleCode, channels]) => {
    const canonicalRuleCode = getCanonicalRuleCode(ruleCode);

    if (!canonicalRuleCode || !isPlainObject(channels)) {
      return current;
    }

    current[canonicalRuleCode] = current[canonicalRuleCode] || {};

    if (typeof channels.inApp === "boolean") {
      const mergedInAppPreference = mergeBooleanPreference(
        current[canonicalRuleCode].inApp,
        channels.inApp,
      );

      if (typeof mergedInAppPreference === "boolean") {
        current[canonicalRuleCode].inApp = mergedInAppPreference;
      }
    }

    if (typeof channels.email === "boolean") {
      const mergedEmailPreference = mergeBooleanPreference(
        current[canonicalRuleCode].email,
        channels.email,
      );

      if (typeof mergedEmailPreference === "boolean") {
        current[canonicalRuleCode].email = mergedEmailPreference;
      }
    }

    if (Object.keys(current[canonicalRuleCode]).length === 0) {
      delete current[canonicalRuleCode];
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

const getMergedStringValue = (values = [], fallback = "") =>
  values.find((value) => typeof value === "string" && value.trim()) || fallback;

const getMergedPolicyValue = (values = [], priority = [], fallback = "") => {
  for (const allowedValue of priority) {
    if (values.includes(allowedValue)) {
      return allowedValue;
    }
  }

  return fallback;
};

const mergeCanonicalPolicyRows = ({
  roleCode = "",
  policyRows = [],
}) => {
  const groupedPolicyRows = new Map();

  (policyRows || []).forEach((policyRow) => {
    const canonicalRuleCode = getCanonicalRuleCode(policyRow?.code);

    if (!canonicalRuleCode) {
      return;
    }

    if (
      policyRow?.is_active === false ||
      policyRow?.policy_is_active === false ||
      !isVisibleInSettings(canonicalRuleCode, policyRow?.role_code || roleCode)
    ) {
      return;
    }

    const groupKey = `${policyRow?.role_code || roleCode}:${canonicalRuleCode}`;

    if (!groupedPolicyRows.has(groupKey)) {
      groupedPolicyRows.set(groupKey, []);
    }

    groupedPolicyRows.get(groupKey).push(policyRow);
  });

  return Array.from(groupedPolicyRows.values())
    .map((rows) => {
      const canonicalRuleCode = getCanonicalRuleCode(rows[0]?.code);
      const canonicalDefinition = getCanonicalRuleDefinition(canonicalRuleCode);
      const roleScopedRow =
        rows.find((row) => row.code === canonicalRuleCode) || rows[0];

      return {
        ...roleScopedRow,
        code: canonicalRuleCode,
        name: canonicalDefinition?.name || roleScopedRow?.name || canonicalRuleCode,
        trigger_type:
          canonicalDefinition?.triggerType ||
          roleScopedRow?.trigger_type ||
          "",
        target_role_code:
          canonicalDefinition?.targetRoleCode ||
          roleScopedRow?.target_role_code ||
          "",
        category_code: getMergedStringValue(
          rows.map((row) => row.category_code),
          roleScopedRow?.category_code || "",
        ),
        category_label: getMergedStringValue(
          rows.map((row) => row.category_label),
          roleScopedRow?.category_label || "",
        ),
        priority: getMergedPolicyValue(
          rows.map((row) => row.priority),
          ["CRITICAL", "WARNING", "INFORMATIONAL"],
          roleScopedRow?.priority || "INFORMATIONAL",
        ),
        in_app_policy: getMergedPolicyValue(
          rows.map((row) => row.in_app_policy),
          ["MANDATORY", "OPTIONAL", "NOT_APPLICABLE"],
          roleScopedRow?.in_app_policy || IN_APP_POLICY.NOT_APPLICABLE,
        ),
        email_policy: getMergedPolicyValue(
          rows.map((row) => row.email_policy),
          ["DEFAULT_ON", "OPTIONAL", "UNAVAILABLE"],
          roleScopedRow?.email_policy || EMAIL_POLICY.UNAVAILABLE,
        ),
        delivery_mode: getMergedPolicyValue(
          rows.map((row) => row.delivery_mode),
          [
            "IMMEDIATE",
            "HOURLY_SUMMARY",
            "DAILY_SUMMARY",
            "THRESHOLD",
            "SILENT_UI_FEEDBACK",
          ],
          roleScopedRow?.delivery_mode || "",
        ),
        user_configurability: getMergedPolicyValue(
          rows.map((row) => row.user_configurability),
          ["ALL_SUPPORTED_CHANNELS", "EMAIL_ONLY", "NONE"],
          roleScopedRow?.user_configurability || USER_CONFIGURABILITY.NONE,
        ),
        is_active: true,
        policy_is_active: true,
      };
    })
    .sort((left, right) => {
      const categoryOrderDifference =
        getCategorySortOrder(roleCode, left.category_code) -
        getCategorySortOrder(roleCode, right.category_code);

      if (categoryOrderDifference !== 0) {
        return categoryOrderDifference;
      }

      return (
        getCanonicalRuleSortOrder(left.code) -
        getCanonicalRuleSortOrder(right.code)
      );
    });
};

const normalizeRulePreferencesAgainstPolicy = ({
  roleCode = "",
  policyRows = [],
  rulePreferences = {},
}) => {
  const sanitizedPreferences = sanitizeNotificationRulePreferences(rulePreferences);

  if (!Array.isArray(policyRows) || policyRows.length === 0) {
    return sanitizedPreferences;
  }

  return mergeCanonicalPolicyRows({ roleCode, policyRows }).reduce((current, policyRow) => {
    const canonicalRuleCode = getCanonicalRuleCode(policyRow.code);
    const nextValue = {};
    const storedRulePreferences = sanitizedPreferences[canonicalRuleCode] || {};
    const editableChannels = getEditableChannels(policyRow);

    if (editableChannels.inApp && typeof storedRulePreferences.inApp === "boolean") {
      nextValue.inApp = storedRulePreferences.inApp;
    }

    if (editableChannels.email && typeof storedRulePreferences.email === "boolean") {
      nextValue.email = storedRulePreferences.email;
    }

    if (Object.keys(nextValue).length > 0) {
      current[canonicalRuleCode] = nextValue;
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
  const canonicalRuleCode = getCanonicalRuleCode(policyRow.code);
  const rulePreferences = sanitizedPreferences[canonicalRuleCode] || {};
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
    const canonicalRuleCode = getCanonicalRuleCode(policyRow.code);

    current[canonicalRuleCode] = resolveEffectiveChannels({
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
    roleCode,
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
        policyRows: mergeCanonicalPolicyRows({ roleCode, policyRows }),
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
        policyRows: mergeCanonicalPolicyRows({ roleCode, policyRows }),
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
  const visibleCanonicalPolicyRows = mergeCanonicalPolicyRows({
    roleCode,
    policyRows,
  });
  const categoriesByCode = new Map();

  visibleCanonicalPolicyRows.forEach((policyRow) => {
    const canonicalRuleCode = getCanonicalRuleCode(policyRow.code);
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
      code: canonicalRuleCode,
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
  mergeCanonicalPolicyRows,
  normalizeRulePreferencesAgainstPolicy,
  hasMeaningfulRulePreferences,
  getDefaultEffectiveChannels,
  getEditableChannels,
  resolveEffectiveChannels,
  buildEffectiveChannelsByRule,
  resolveEffectiveNotificationPreferences,
  buildPreferenceCategories,
};

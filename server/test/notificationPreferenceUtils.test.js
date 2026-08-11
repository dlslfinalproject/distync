const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveEffectiveNotificationPreferences,
} = require("../src/modules/notifications/notificationPreferenceUtils");
const {
  getCanonicalRuleCode,
  NOTIFICATION_RULE_ALIASES,
} = require("../src/modules/notifications/notificationPolicy");

const barangayPolicyRows = [
  {
    code: "DISASTER_EVENT_UPDATED",
    role_code: "BARANGAY",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "HOUSEHOLD_REGISTERED",
    role_code: "BARANGAY",
    in_app_policy: "OPTIONAL",
    email_policy: "UNAVAILABLE",
    user_configurability: "ALL_SUPPORTED_CHANNELS",
  },
  {
    code: "EVACUEE_ATTENDANCE_UPDATED",
    role_code: "BARANGAY",
    in_app_policy: "OPTIONAL",
    email_policy: "UNAVAILABLE",
    user_configurability: "ALL_SUPPORTED_CHANNELS",
  },
  {
    code: "HOUSEHOLD_VERIFICATION_UPDATED",
    role_code: "BARANGAY",
    in_app_policy: "MANDATORY",
    email_policy: "OPTIONAL",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "SYNC_FAILURE",
    role_code: "BARANGAY",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "SYNC_CONFLICT",
    role_code: "BARANGAY",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
];

test("shared resolver returns source modern for populated canonical preferences", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: {
      HOUSEHOLD_REGISTERED: {
        inApp: false,
      },
    },
  });

  assert.equal(resolved.source, "modern");
  assert.deepEqual(resolved.normalizedPreferences, {
    HOUSEHOLD_REGISTERED: {
      inApp: false,
    },
  });
  assert.deepEqual(resolved.effectiveChannels.HOUSEHOLD_REGISTERED, {
    inApp: false,
    email: false,
  });
});

test("shared resolver returns policy-defaults for an empty modern object", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: {},
  });

  assert.equal(resolved.source, "policy-defaults");
  assert.deepEqual(resolved.normalizedPreferences, {});
  assert.deepEqual(resolved.effectiveChannels.DISASTER_EVENT_UPDATED, {
    inApp: true,
    email: true,
  });
  assert.deepEqual(resolved.effectiveChannels.HOUSEHOLD_REGISTERED, {
    inApp: true,
    email: false,
  });
});

test("shared resolver maps only true duplicate legacy rule codes onto the canonical catalog", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: {
      DISASTER_EVENT_UPDATE: {
        email: false,
      },
      HOUSEHOLD_VERIFICATION: {
        email: false,
      },
      EVACUEE_ATTENDANCE_UPDATE: {
        inApp: false,
      },
      SYNC_CONFLICT: {
        email: false,
      },
    },
  });

  assert.equal(resolved.source, "modern");
  assert.deepEqual(resolved.normalizedPreferences, {
    DISASTER_EVENT_UPDATED: {
      email: false,
    },
    HOUSEHOLD_VERIFICATION_UPDATED: {
      email: false,
    },
    EVACUEE_ATTENDANCE_UPDATED: {
      inApp: false,
    },
    SYNC_CONFLICT: {
      email: false,
    },
  });
  assert.deepEqual(resolved.effectiveChannels.SYNC_CONFLICT, {
    inApp: true,
    email: false,
  });
});

test("shared resolver filters unknown modern rules and never returns source legacy", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: {
      MAYOR_ONLY_RULE: {
        email: false,
      },
    },
  });

  assert.notEqual(resolved.source, "legacy");
  assert.equal(resolved.source, "policy-defaults");
  assert.deepEqual(resolved.normalizedPreferences, {});
});

test("canonical rule resolution keeps only approved direct aliases", () => {
  assert.deepEqual(Object.keys(NOTIFICATION_RULE_ALIASES).sort(), [
    "CRITICAL_STOCK",
    "DISASTER_EVENT_UPDATE",
    "EVACUEE_ATTENDANCE_UPDATE",
    "HOUSEHOLD_VERIFICATION",
    "HOUSEHOLD_VERIFICATION_UPDATE",
    "SYNCHRONIZATION_CONFLICT_ALERT",
  ]);
  assert.equal(getCanonicalRuleCode("DISASTER_EVENT_UPDATED"), "DISASTER_EVENT_UPDATED");
  assert.equal(getCanonicalRuleCode("DISASTER_EVENT_UPDATE"), "DISASTER_EVENT_UPDATED");
  assert.equal(
    getCanonicalRuleCode("EVACUEE_ATTENDANCE_UPDATE"),
    "EVACUEE_ATTENDANCE_UPDATED",
  );
  assert.equal(
    getCanonicalRuleCode("HOUSEHOLD_VERIFICATION"),
    "HOUSEHOLD_VERIFICATION_UPDATED",
  );
  assert.equal(getCanonicalRuleCode("DISTRIBUTION_UPDATE"), "DISTRIBUTION_UPDATE");
  assert.equal(getCanonicalRuleCode("DONATION_STOCK_UPDATE"), "DONATION_STOCK_UPDATE");
  assert.equal(getCanonicalRuleCode("SYSTEM_ANOMALY"), "SYSTEM_ANOMALY");
});

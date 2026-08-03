const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveEffectiveNotificationPreferences,
} = require("../src/modules/notifications/notificationPreferenceUtils");

const barangayPolicyRows = [
  {
    code: "DISASTER_EVENT_UPDATE",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "DISTRIBUTION_UPDATE",
    in_app_policy: "OPTIONAL",
    email_policy: "OPTIONAL",
    user_configurability: "ALL_SUPPORTED_CHANNELS",
  },
  {
    code: "EVACUEE_ATTENDANCE_UPDATE",
    in_app_policy: "OPTIONAL",
    email_policy: "UNAVAILABLE",
    user_configurability: "ALL_SUPPORTED_CHANNELS",
  },
  {
    code: "HOUSEHOLD_REGISTERED",
    in_app_policy: "OPTIONAL",
    email_policy: "UNAVAILABLE",
    user_configurability: "ALL_SUPPORTED_CHANNELS",
  },
  {
    code: "HOUSEHOLD_VERIFICATION",
    in_app_policy: "MANDATORY",
    email_policy: "OPTIONAL",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "SYNC_CONFLICT",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
  {
    code: "SYSTEM_ANOMALY",
    in_app_policy: "MANDATORY",
    email_policy: "DEFAULT_ON",
    user_configurability: "EMAIL_ONLY",
  },
];

test("shared resolver returns source modern for populated modern preferences", () => {
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
  assert.deepEqual(resolved.effectiveChannels.DISASTER_EVENT_UPDATE, {
    inApp: true,
    email: true,
  });
  assert.deepEqual(resolved.effectiveChannels.HOUSEHOLD_REGISTERED, {
    inApp: true,
    email: false,
  });
});

test("shared resolver returns policy-defaults for missing or malformed modern input", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: "invalid",
  });

  assert.equal(resolved.source, "policy-defaults");
  assert.deepEqual(resolved.normalizedPreferences, {});
  assert.deepEqual(resolved.effectiveChannels.HOUSEHOLD_VERIFICATION, {
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

test("shared resolver preserves approved Barangay backfill behavior for distribution update", () => {
  const resolved = resolveEffectiveNotificationPreferences({
    roleCode: "BARANGAY",
    policyRows: barangayPolicyRows,
    modernPreferences: {
      SYNC_CONFLICT: {
        email: false,
      },
      SYSTEM_ANOMALY: {
        email: false,
      },
      DISTRIBUTION_UPDATE: {
        email: false,
        inApp: false,
      },
      HOUSEHOLD_REGISTERED: {
        inApp: true,
      },
      DISASTER_EVENT_UPDATE: {
        email: false,
      },
      HOUSEHOLD_VERIFICATION: {
        email: false,
      },
      EVACUEE_ATTENDANCE_UPDATE: {
        inApp: true,
      },
    },
  });

  assert.equal(resolved.source, "modern");
  assert.deepEqual(resolved.effectiveChannels.DISTRIBUTION_UPDATE, {
    inApp: false,
    email: false,
  });
  assert.deepEqual(resolved.effectiveChannels.SYNC_CONFLICT, {
    inApp: true,
    email: false,
  });
});

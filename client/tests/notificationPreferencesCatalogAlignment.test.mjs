import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_CODES } from "../src/utils/roleSession.js";
import {
  dedupeNotificationSettings,
  getRuleDescription,
} from "../src/pages/settings/settingsHelpers.js";

test("notification catalog provides canonical SYNC_FAILURE labels and role-specific descriptions", () => {
  const rule = { code: "SYNC_FAILURE", name: "Sync Failure" };
  const catalog = dedupeNotificationSettings({
    roleCode: ROLE_CODES.BARANGAY,
    categories: [
      {
        code: "SYSTEM_OPERATIONS",
        label: "System operations",
        rules: [{ code: "SYNC_FAILURE" }],
      },
    ],
  });

  assert.equal(catalog.categories[0].rules[0].code, rule.code);
  assert.equal(catalog.categories[0].rules[0].name, rule.name);

  assert.match(
    getRuleDescription({ ...rule, roleCode: ROLE_CODES.BARANGAY }),
    /offline evacuee, attendance, stub, or relief distribution transaction from your barangay fails to synchronize/,
  );
  assert.match(
    getRuleDescription({ ...rule, roleCode: ROLE_CODES.MSWDO }),
    /evacuee, attendance, household verification, or relief distribution record fails to synchronize/,
  );
  assert.match(
    getRuleDescription({ ...rule, roleCode: ROLE_CODES.MAYOR }),
    /inventory, donation, or other Mayor-related transaction fails to synchronize/,
  );
});

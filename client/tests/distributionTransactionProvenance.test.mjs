import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  DISTRIBUTION_STUB_PROVENANCE,
  UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE,
  getDistributionTargetKey,
  isServerVerifiedDistributionTarget,
  markDistributionTargetAsServerVerified,
  markDistributionTargetAsUnverified,
} from "../src/features/distribution/distributionTargetProvenance.js";

const readSource = async (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

const routeHintContext = {
  stub_id: "stub-route",
  household_id: "household-route",
  disaster_event_id: "event-route",
  status: "ISSUED",
  barangay_id: "barangay-route",
};

test("BRG-SC-08-H01 TEST A route/search targets are unverified hints only", () => {
  const context = markDistributionTargetAsUnverified(routeHintContext);

  assert.equal(
    context.provenance,
    DISTRIBUTION_STUB_PROVENANCE.UNVERIFIED_NAVIGATION_HINT,
  );
  assert.equal(context.trusted_target_key, "");
  assert.equal(isServerVerifiedDistributionTarget(context), false);
});

test("BRG-SC-08-H01 TEST B location.state cannot smuggle trusted provenance", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /locationState\?\.stubContext/);
  assert.match(source, /markDistributionTargetAsUnverified\(\{/);
  assert.doesNotMatch(source, /return locationState\.stubContext/);
});

test("BRG-SC-08-H01 TEST C valid-looking IDs do not confer submit trust", () => {
  const context = markDistributionTargetAsUnverified({
    stub_id: "11111111-1111-4111-8111-111111111111",
    household_id: "22222222-2222-4222-8222-222222222222",
    disaster_event_id: "33333333-3333-4333-8333-333333333333",
    status: "ISSUED",
  });

  assert.equal(getDistributionTargetKey(context).includes("11111111"), true);
  assert.equal(isServerVerifiedDistributionTarget(context), false);
});

test("BRG-SC-08-H01 TEST D route status manipulation does not confer trust", () => {
  const context = markDistributionTargetAsUnverified({
    ...routeHintContext,
    status: "ISSUED",
    qr_status: "VALID",
  });

  assert.equal(context.status, "ISSUED");
  assert.equal(context.qr_status, "VALID");
  assert.equal(isServerVerifiedDistributionTarget(context), false);
});

test("BRG-SC-08-H01 TEST E successful server resolution establishes submit trust", () => {
  const context = markDistributionTargetAsServerVerified(routeHintContext);

  assert.equal(context.provenance, DISTRIBUTION_STUB_PROVENANCE.SERVER_VERIFIED);
  assert.equal(
    context.trusted_target_key,
    "stub-route|household-route|event-route",
  );
  assert.equal(isServerVerifiedDistributionTarget(context), true);
});

test("BRG-SC-08-H01 TEST F cached offline stub details are not promoted", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /stubDetails\.is_cached_offline/);
  assert.match(source, /markDistributionTargetAsUnverified\(context\)/);
});

test("BRG-SC-08-H01 TEST G server failure leaves the existing hint untrusted", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /catch \(error\) \{/);
  assert.doesNotMatch(source, /catch \(error\) \{[\s\S]*markDistributionTargetAsServerVerified/);
});

test("BRG-SC-08-H01 TEST H network failure alone cannot promote route targets", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /fetchStubDetails\(stubContext\.stub_id\)/);
  assert.match(source, /stubDetails\.is_cached_offline/);
  assert.doesNotMatch(source, /navigator\.onLine[\s\S]*markDistributionTargetAsServerVerified/);
});

test("BRG-SC-08-H01 TEST I direct confirmation boundary checks trusted provenance", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /const handleConfirmDistribution = async \(\) => \{/);
  assert.match(source, /if \(!isServerVerifiedDistributionTarget\(stubContext\)\) \{/);
  assert.match(source, /return;\s*\}\s*if \(!verifiedStubDetails/);
});

test("BRG-SC-08-H01 TEST J claimStub is unreachable for unverified targets", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");
  const guardIndex = source.indexOf("if (!isServerVerifiedDistributionTarget(stubContext))");
  const mutationIndex = source.indexOf("claimStub({");

  assert.notEqual(guardIndex, -1);
  assert.notEqual(mutationIndex, -1);
  assert.equal(guardIndex < mutationIndex, true);
});

test("BRG-SC-08-H01 TEST K confirmation modal is limited to trusted issued targets", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /hasTrustedStubContext/);
  assert.match(source, /verifiedStubDetails\?\.status === "ISSUED"/);
});

test("BRG-SC-08-H01 TEST L confirmation modal reflects the verified target state", async () => {
  const pageSource = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(pageSource, /<StubClaimConfirmModal/);
  assert.match(pageSource, /isSubmitting=\{isSubmitting\}/);
  assert.match(pageSource, /onConfirm=\{handleConfirmDistribution\}/);
});

test("BRG-SC-08-H01 TEST M user-facing untrusted message does not leak internals", () => {
  assert.equal(
    UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE,
    "This distribution target must be verified online before recording distribution.",
  );
  assert.doesNotMatch(
    UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE,
    /provenance|DISTRIBUTION_CREATE|syncQueue|stubContext/i,
  );
});

test("BRG-SC-08-H01 TEST N target identity changes clear trust by key mismatch", () => {
  const trusted = markDistributionTargetAsServerVerified(routeHintContext);
  const changed = {
    ...trusted,
    household_id: "household-other",
  };

  assert.equal(isServerVerifiedDistributionTarget(trusted), true);
  assert.equal(isServerVerifiedDistributionTarget(changed), false);
});

test("BRG-SC-08-H01 TEST O missing target fields are never trusted", () => {
  const context = markDistributionTargetAsServerVerified({
    stub_id: "stub-only",
    household_id: "",
    disaster_event_id: "event-1",
  });

  assert.equal(context.trusted_target_key, "");
  assert.equal(isServerVerifiedDistributionTarget(context), false);
});

test("BRG-SC-08-H01 TEST P QR/manual lookup still uses server verification and details", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /verifyStub\(\{\s*qrCodeValue: normalizedValue/);
  assert.match(source, /fetchStubDetails\(resolvedStubId\)/);
  assert.match(source, /setStubContext\(nextStubContext\)/);
});

test("BRG-SC-08-H01 TEST Q route hint plus server data uses server-built context", async () => {
  const source = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(source, /\.\.\.currentValue,\s*\.\.\.buildStubContextFromDetails\(stubDetails\)/);
  assert.match(source, /markDistributionTargetAsServerVerified\(context\)/);
});

test("BRG-SC-08-H01 TEST R no new sync action is introduced", async () => {
  const serviceSource = await readSource("../src/features/distribution/distributionService.js");
  const pageSource = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.doesNotMatch(serviceSource, /actionKey:\s*"DISTRIBUTION_CREATE"/);
  assert.match(pageSource, /claimStub\(/);
  assert.doesNotMatch(pageSource, /DISTRIBUTION_CREATE_VERIFIED|OFFLINE_DISTRIBUTION_CREATE|SAFE_DISTRIBUTION_CREATE|ROUTE_DISTRIBUTION_CREATE/);
});

test("BRG-SC-08-H01 TEST S STUB_CLAIM workflow is shared", async () => {
  const pageSource = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");
  const stubServiceSource = await readSource("../src/features/stubs/stubService.js");

  assert.match(pageSource, /claimStub\(/);
  assert.match(stubServiceSource, /actionKey:\s*"STUB_CLAIM"/);
});

test("BRG-SC-08-H01 TEST T offline confirmation uses the shared stub claim queue", async () => {
  const pageSource = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");
  const stubServiceSource = await readSource("../src/features/stubs/stubService.js");

  assert.match(pageSource, /UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE/);
  assert.match(pageSource, /response\?\.queued_offline/);
  assert.match(stubServiceSource, /buildOfflineQueuedResponse/);
});

test("BRG-SC-08-H01 TEST U server and database implementation remain untouched by the client guard", async () => {
  const pageSource = await readSource("../src/pages/barangay/DistributionTransactionPage.jsx");

  assert.match(pageSource, /claimStub\(\{/);
  assert.doesNotMatch(pageSource, /fetchInventoryItems|fetchInventoryBatches|inventory_batch_id/);
  assert.doesNotMatch(pageSource, /\/api\/v1\/stubs\/offline|\/api\/v1\/distribution-transactions\/verified/);
});

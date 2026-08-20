import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  CLAIM_ERROR_DIALOG_TITLE,
  NO_ASSIGNED_RELIEF_PACK_MESSAGE,
  getStubClaimErrorDialog,
} from "../src/features/stubs/stubClaimErrors.js";

const readSource = (relativePath) =>
  fs.readFile(new URL(relativePath, import.meta.url), "utf8");

test("DEPLOY-BRG-RGD-02 maps no assigned relief pack to actionable household copy", () => {
  const dialog = getStubClaimErrorDialog({
    code: "NO_ASSIGNED_RELIEF_PACK",
    message: "No active standard relief pack is assigned to this family.",
    statusCode: 400,
  });

  assert.equal(dialog.title, CLAIM_ERROR_DIALOG_TITLE);
  assert.equal(dialog.message, NO_ASSIGNED_RELIEF_PACK_MESSAGE);
  assert.doesNotMatch(dialog.message, /family|NO_ASSIGNED_RELIEF_PACK|UUID|\/api\//);
});

test("DEPLOY-BRG-RGD-02 preserves duplicate claim messages without relief-pack remapping", () => {
  const dialog = getStubClaimErrorDialog({
    code: "STUB_ALREADY_CLAIMED",
    message: "This stub has already been claimed.",
    statusCode: 409,
  });

  assert.equal(dialog.title, CLAIM_ERROR_DIALOG_TITLE);
  assert.equal(dialog.message, "This stub has already been claimed.");
  assert.notEqual(dialog.message, NO_ASSIGNED_RELIEF_PACK_MESSAGE);
});

test("DEPLOY-BRG-RGD-02 keeps generic server errors controlled and distinct", () => {
  const dialog = getStubClaimErrorDialog(
    {
      code: "UNEXPECTED_SERVER_ERROR",
      message: "Unable to mark the stub as claimed.",
      statusCode: 500,
    },
    "Fallback claim failure.",
  );

  assert.equal(dialog.title, CLAIM_ERROR_DIALOG_TITLE);
  assert.equal(dialog.message, "Unable to mark the stub as claimed.");
  assert.notEqual(dialog.message, NO_ASSIGNED_RELIEF_PACK_MESSAGE);
});

test("DEPLOY-BRG-RGD-02 Barangay claim failures use the shared modal shell", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /import FormModalShell from "\.\.\/\.\.\/components\/shared\/FormModalShell"/);
  assert.match(source, /const \[claimErrorDialog, setClaimErrorDialog\] = useState\(null\)/);
  assert.match(source, /OK/);
  assert.doesNotMatch(source, /window\.alert\(/);
});

test("DEPLOY-BRG-RGD-02-UI claim error modal follows established duplicate error layout", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");
  const referenceSource = await readSource(
    "../src/components/disaster-events/DisasterEventFormModal.jsx",
  );
  const claimModalOpenIndex = source.indexOf("Boolean(claimErrorDialog)");
  const modalBlock = source.slice(
    source.lastIndexOf("<FormModalShell", claimModalOpenIndex),
    source.indexOf("</FormModalShell>", claimModalOpenIndex),
  );

  assert.match(source, /import \{ FiPrinter, FiX \} from "react-icons\/fi"/);
  assert.match(referenceSource, /const duplicateErrorModalBodyStyles = \{[\s\S]*textAlign: "center"/);
  assert.match(referenceSource, /<div style=\{duplicateErrorModalBodyStyles\} role="alert" aria-live="assertive">/);
  assert.match(modalBlock, /maxWidth="420px"/);
  assert.match(modalBlock, /bodyStyle=\{\{ marginTop: 0 \}\}/);
  assert.match(modalBlock, /style=\{claimErrorButtonStyles\}/);
  assert.match(modalBlock, /<div style=\{claimErrorModalBodyStyles\} role="alert" aria-live="assertive">/);
  assert.match(modalBlock, /style=\{claimErrorIconStyles\}[\s\S]*<FiX \/>/);
  assert.match(modalBlock, /style=\{claimErrorTitleStyles\}/);
  assert.match(modalBlock, /style=\{claimErrorMessageStyles\}/);
  assert.doesNotMatch(modalBlock, /title=\{claimErrorDialog\?\.title/);
  assert.doesNotMatch(modalBlock, /onClose=\{handleDismissClaimErrorDialog\}/);
  assert.doesNotMatch(modalBlock, /style=\{pageHeaderStyles\.primaryButton\}/);
});

test("DEPLOY-BRG-RGD-02-UI claim error modal reuses established red error proportions", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /const claimErrorIconStyles = \{[\s\S]*width: "48px"[\s\S]*backgroundColor: "#fee2e2"[\s\S]*color: "#c53030"[\s\S]*fontSize: "28px"/);
  assert.match(source, /const claimErrorTitleStyles = \{[\s\S]*fontSize: "18px"[\s\S]*fontWeight: 700/);
  assert.match(source, /const claimErrorMessageStyles = \{[\s\S]*color: "#6b7280"[\s\S]*fontSize: "14px"[\s\S]*maxWidth: "320px"/);
  assert.match(source, /const claimErrorButtonStyles = \{[\s\S]*width: "100%"[\s\S]*minHeight: "40px"[\s\S]*borderRadius: "8px"[\s\S]*backgroundColor: "#c53030"/);
});

test("DEPLOY-BRG-RGD-02 manual and QR confirmation failures share the claim error mapper", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(source, /setPendingClaimStubId\(resolvedStubId\)/);
  assert.match(source, /onConfirm=\{handleConfirmClaim\}/);
  assert.match(source, /catch \(error\) \{[\s\S]*setClaimErrorDialog\(getStubClaimErrorDialog\(error\)\)/);
});

test("DEPLOY-BRG-RGD-02 failed claims close confirmation and do not trigger success UI", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");
  const failureBlock = source.slice(
    source.indexOf("catch (error) {", source.indexOf("if (!pendingClaimStubId)")),
    source.indexOf("} finally {", source.indexOf("if (!pendingClaimStubId)")),
  );

  assert.match(failureBlock, /setPendingClaimStubId\(""\)/);
  assert.match(failureBlock, /setPendingClaimStubDetails\(null\)/);
  assert.match(failureBlock, /setClaimErrorDialog\(getStubClaimErrorDialog\(error\)\)/);
  assert.doesNotMatch(failureBlock, /reloadDashboard\(\)|setScanToast|success/);
});

test("DEPLOY-BRG-RGD-02 offline queued claims remain separate from domain rejection", async () => {
  const serviceSource = await readSource("../src/features/stubs/stubService.js");
  const pageSource = await readSource("../src/pages/barangay/StubDistributionPage.jsx");

  assert.match(serviceSource, /buildOfflineQueuedResponse/);
  assert.match(serviceSource, /Stub claim saved offline\. Pending sync once connection is restored\./);
  assert.match(serviceSource, /await markCachedStubClaimTerminal\(stubId\)/);
  assert.doesNotMatch(serviceSource, /NO_ASSIGNED_RELIEF_PACK_MESSAGE/);
  assert.match(pageSource, /navigator\.onLine === false/);
});

test("DEPLOY-BRG-RGD-02 bulk claim reports failure without all-success messaging", async () => {
  const source = await readSource("../src/pages/barangay/StubDistributionPage.jsx");
  const bulkBlock = source.slice(
    source.indexOf("const claimResults = await Promise.allSettled"),
    source.indexOf("return;", source.indexOf("const claimResults = await Promise.allSettled")),
  );

  assert.match(bulkBlock, /rejectedClaim/);
  assert.match(bulkBlock, /setClaimErrorDialog\(/);
  assert.match(bulkBlock, /Unable to mark one or more selected stubs as claimed\./);
  assert.doesNotMatch(bulkBlock, /setScanToast|success/i);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { buildCachedStubClaimTerminalPatch } from "../src/features/stubs/stubClaimCacheReconciliation.mjs";

test("sparse PHOTO claim result updates status and claimed_at without erasing Stub identity", () => {
  const existingSnapshot = {
    status: "ISSUED",
    stub_no: "STUB-2026-000008",
    serial_no: "SER-2026-000008",
    qr_code_value: "QR-AUTH-8",
    qr_status: "ACTIVE",
    issued_at: "2026-09-25T01:00:00.000Z",
    claimed_at: null,
  };
  const patch = buildCachedStubClaimTerminalPatch(
    {
      sync_status: "SYNCED",
      data: {
        id: "stub-8",
        status: "CLAIMED",
        claimed_at: "2026-09-26T03:00:00.000Z",
      },
    },
    "SYNCED",
    "2026-09-26T03:00:01.000Z",
  );
  const reconciledSnapshot = { ...existingSnapshot, ...patch };

  assert.deepEqual(Object.keys(patch).sort(), [
    "claimed_at",
    "last_terminal_sync_status",
    "status",
    "updated_at",
  ]);
  assert.equal(reconciledSnapshot.status, "CLAIMED");
  assert.equal(reconciledSnapshot.claimed_at, "2026-09-26T03:00:00.000Z");
  assert.equal(reconciledSnapshot.issued_at, "2026-09-25T01:00:00.000Z");
  assert.equal(reconciledSnapshot.stub_no, "STUB-2026-000008");
  assert.equal(reconciledSnapshot.serial_no, "SER-2026-000008");
  assert.equal(reconciledSnapshot.qr_code_value, "QR-AUTH-8");
  assert.equal(reconciledSnapshot.qr_status, "ACTIVE");
});

test("sparse terminal responses without claimed_at preserve the cached claim timestamp", () => {
  const existingClaimedAt = "2026-09-26T03:00:00.000Z";
  const patch = buildCachedStubClaimTerminalPatch(
    { data: { id: "stub-8", status: "CLAIMED", claimed_at: null } },
    "SYNCED",
    "2026-09-26T03:00:01.000Z",
  );
  const reconciledSnapshot = { claimed_at: existingClaimedAt, ...patch };

  assert.equal(Object.hasOwn(patch, "claimed_at"), false);
  assert.equal(reconciledSnapshot.claimed_at, existingClaimedAt);
});

test("offline Stub snapshot mapping retains issued_at and the terminal cache patch", async () => {
  const cacheSource = await fs.readFile(
    new URL("../src/features/stubs/stubCache.js", import.meta.url),
    "utf8",
  );

  assert.match(cacheSource, /issued_at: serverRow\.issued_at \|\| null/);
  assert.match(cacheSource, /issued_at: snapshot\.issued_at \|\| null/);
  assert.match(
    cacheSource,
    /buildCachedStubClaimTerminalPatch\([\s\S]*?claimResult,[\s\S]*?terminalStatus,[\s\S]*?getIsoNow\(\)/,
  );
  assert.match(
    cacheSource,
    /markCachedStubClaimTerminal\([\s\S]*?result\.sync_status,[\s\S]*?result,/,
  );
});

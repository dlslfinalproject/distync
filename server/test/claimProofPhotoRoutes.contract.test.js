const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const readServerSource = (...segments) =>
  fs.readFileSync(path.join(__dirname, "..", ...segments), "utf8");

test("claim-proof retrieval route is exact-transaction, role-gated, and no-store", () => {
  const source = readServerSource("src", "routes", "distributionTransaction.routes.js");
  const endpoint = source.indexOf('"/claim-proof/:transactionId/photo"');
  assert.notEqual(endpoint, -1);
  const route = source.slice(endpoint, endpoint + 1100);

  assert.match(route, /requireRoles\(ROLE_CODES\.BARANGAY, ROLE_CODES\.MSWDO, ROLE_CODES\.MAYOR\)/);
  assert.match(route, /Cache-Control", "private, no-store, max-age=0"/);
  assert.match(route, /getClaimProofPhoto\(\{\s*transactionId: req\.validatedParams\.transactionId/);
  assert.doesNotMatch(route, /getDistributionHistory|signedUrl/);
});

test("claim-proof migration creates a private JPEG-only bucket and enforces transaction metadata", () => {
  const migration = readServerSource("..", "database", "migrations", "2026-09-24_add_claim_proof_photo_storage.sql");

  assert.match(migration, /'distync-claim-proof-photos',[\s\S]*?false,[\s\S]*?ARRAY\['image\/jpeg'\]/);
  assert.match(migration, /proof_type IN \('QR', 'PHOTO'\)/);
  assert.match(migration, /proof_type = 'PHOTO'[\s\S]*?proof_photo_path IS NOT NULL/);
  assert.match(migration, /proof_photo_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /proof_photo_size_bytes BETWEEN 1 AND 2097152/);
  assert.match(migration, /proof_type IS DISTINCT FROM 'PHOTO'[\s\S]*?proof_photo_path IS NULL/);
});

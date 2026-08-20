const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

test("BRG-RGD-PAG validates optional dashboard pagination params", async () => {
  const source = await readSource("src/validators/stub.validator.js");

  assert.match(source, /pageSize/);
  assert.match(source, /Math\.min\(parsePositiveInteger\(pageSize, 25\), 100\)/);
  assert.match(source, /sector_ids/);
  assert.match(source, /status must be one of: all, claimed, unclaimed/);
  assert.match(source, /sort_order must be one of: oldest, newest, az, za/);
  assert.match(source, /is_paginated: hasPagination/);
});

test("BRG-RGD-PAG repository filters and counts before LIMIT/OFFSET", async () => {
  const source = await readSource("src/repositories/stub.repository.js");

  assert.match(source, /const buildBarangayDashboardFilters =/);
  assert.match(source, /s\.status = 'CLAIMED'/);
  assert.match(source, /s\.status = 'ISSUED'/);
  assert.match(source, /dashboard_hs\.sector_id = ANY/);
  assert.match(source, /dashboard_es\.sector_id = ANY/);
  assert.match(source, /CONCAT\('STUB#', \$\{stubSequenceExpression\}\) ILIKE/);
  assert.match(source, /const countBarangayStubDashboardRows = async/);
  assert.match(source, /SELECT COUNT\(s\.id\)::int AS total/);
  assert.match(source, /LIMIT \$\$\{limitIndex\}/);
  assert.match(source, /OFFSET \$\$\{offsetIndex\}/);
});

test("BRG-RGD-PAG service returns pagination metadata and keeps metrics separate", async () => {
  const source = await readSource("src/services/stub.service.js");

  assert.match(source, /const buildPaginationMetadata =/);
  assert.match(source, /getStubDashboardMetrics/);
  assert.match(source, /countBarangayStubDashboardRows/);
  assert.match(source, /count: isPaginated \? totalItems : rows\.length/);
  assert.match(source, /response\.pagination = buildPaginationMetadata/);
});

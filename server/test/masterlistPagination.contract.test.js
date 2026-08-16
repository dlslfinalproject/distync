const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

test("masterlist validator accepts optional pagination/search/sector/sort params", async () => {
  const source = await readSource("src/validators/masterlist.validator.js");

  assert.match(source, /page,/);
  assert.match(source, /pageSize,/);
  assert.match(source, /search,/);
  assert.match(source, /sector_ids,/);
  assert.match(source, /sort_order,/);
  assert.match(source, /pageSize must be an integer between 1 and 100/);
  assert.match(source, /sector_codes: parsedSectorCodes/);
});

test("masterlist repository filters and counts before LIMIT/OFFSET", async () => {
  const source = await readSource("src/repositories/masterlist.repository.js");

  assert.match(source, /filtered_records AS \(/);
  assert.match(source, /LOWER\(records\.family_head_name\) LIKE/);
  assert.match(source, /records\.sector_ids &&/);
  assert.match(source, /records\.sector_codes &&/);
  assert.match(source, /total_count AS \([\s\S]*COUNT\(\*\)::int AS filtered_total_count[\s\S]*FROM filtered_records/);
  assert.match(source, /paged_records AS \([\s\S]*FROM filtered_records/);
  assert.match(source, /paginationClause = `[\s\S]*LIMIT/);
  assert.match(source, /OFFSET/);
});

test("masterlist repository uses deterministic unique ordering", async () => {
  const source = await readSource("src/repositories/masterlist.repository.js");

  assert.match(source, /masterlist_record_id ASC/);
  assert.match(source, /sort_timestamp DESC NULLS LAST/);
  assert.match(source, /family_head_name ASC/);
  assert.match(source, /family_head_name DESC/);
});

test("masterlist service keeps legacy full-data behavior optional", async () => {
  const source = await readSource("src/services/masterlist.service.js");

  assert.match(source, /Array\.isArray\(householdResult\)/);
  assert.match(source, /\? null[\s\S]*: householdResult\.pagination \|\| null/);
  assert.match(source, /if \(pagination\) \{[\s\S]*response\.pagination = pagination/);
  assert.match(source, /count: pagination\?\.totalItems \|\| data\.length/);
});

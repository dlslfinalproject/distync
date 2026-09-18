const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../..");
const seed = fs.readFileSync(
  path.join(repositoryRoot, "database/seeds/initial_seed.sql"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(
    repositoryRoot,
    "database/migrations/2026-09-18_add_bilucao_evacuation_center.sql",
  ),
  "utf8",
);

const canonicalBarangays = [
  "BAGONG_POOK", "BILUCAO", "BULIHAN", "LUTA_DEL_NORTE", "LUTA_DEL_SUR",
  "POBLACION", "SAN_ANDRES", "SAN_FERNANDO", "SAN_GREGORIO",
  "SAN_ISIDRO_EAST", "SAN_JUAN", "SAN_PEDRO_I", "SAN_PEDRO_II",
  "SAN_PIOQUINTO", "SANTIAGO",
];

const centerRows = [
  ...seed.matchAll(
    /INSERT INTO evacuation_centers[\s\S]*?SELECT b\.id, '([^']+)'[^\n]*\nFROM barangays b WHERE b\.code = '([^']+)'/g,
  ),
].map((match) => ({ name: match[1], barangayCode: match[2] }));

test("canonical Malvar barangays have one or more authoritative center seed rows", () => {
  const coveredCodes = new Set(centerRows.map((row) => row.barangayCode));
  assert.equal(canonicalBarangays.length, 15);
  assert.deepEqual(canonicalBarangays.filter((code) => !coveredCodes.has(code)), []);
});

test("Bilucao center seed and migration use the canonical barangay and nullable capacity", () => {
  assert.match(seed, /INSERT INTO evacuation_centers \(barangay_id, name\)\s+SELECT b\.id, 'Bilucao Evacuation Center'\s+FROM barangays b WHERE b\.code = 'BILUCAO'/);
  assert.match(migration, /INSERT INTO public\.evacuation_centers \(barangay_id, name\)\s+SELECT b\.id, 'Bilucao Evacuation Center'\s+FROM public\.barangays b\s+WHERE b\.code = 'BILUCAO'/);
  assert.match(migration, /NOT EXISTS/);
  assert.doesNotMatch(migration, /individual_capacity/);
  assert.doesNotMatch(migration, /DELETE\s+FROM/i);
});

test("Bilucao is not duplicated in the authoritative seed", () => {
  assert.equal(centerRows.filter((row) => row.barangayCode === "BILUCAO").length, 1);
  assert.equal(centerRows.filter((row) => row.name === "Bilucao Evacuation Center").length, 1);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readSource = (...segments) =>
  fs.readFileSync(path.join(__dirname, "..", "src", ...segments), "utf8");

test("masterlist projection includes structured registrar and evacuation-center names", () => {
  const repository = readSource("repositories", "masterlist.repository.js");
  const service = readSource("services", "masterlist.service.js");

  assert.match(repository, /h\.registered_by/);
  assert.match(repository, /registered_by_user\.middle_name/);
  assert.match(repository, /household_evacuation_center\.name AS evacuation_center_name/);
  assert.match(repository, /attendance_evacuation_center\.name AS attendance_evacuation_center_name/);
  assert.match(service, /registered_by_name: household\.registered_by_name/);
  assert.match(service, /evacuation_center_name:/);
});

test("household detail projection resolves the saved center and full registrar name", () => {
  const repository = readSource("repositories", "householdRegistration.repository.js");

  assert.match(repository, /registered_by_user\.middle_name/);
  assert.match(repository, /evacuation_center\.name AS evacuation_center_name/);
  assert.match(repository, /LEFT JOIN evacuation_centers evacuation_center/);
  assert.match(repository, /u\.middle_name/);
});

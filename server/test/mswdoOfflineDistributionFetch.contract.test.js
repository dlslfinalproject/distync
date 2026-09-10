const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (...parts) =>
  fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");

const preparationSource = read("..", "client", "src", "features", "offline", "mswdoOfflinePreparation.js");
const clientServiceSource = read("..", "client", "src", "features", "stubs", "stubService.js");
const routeSource = read("src", "routes", "stub.routes.js");
const serviceSource = read("src", "services", "stub.service.js");

test("DISTFETCH-01 MSWDO preparation uses the event-wide municipal fetch", () => {
  assert.match(preparationSource, /DISTRIBUTION_FETCH[\s\S]*fetchMunicipalStubDashboard/);
});

test("DISTFETCH-02 municipal route authorizes the legitimate MSWDO role", () => {
  assert.match(routeSource, /requireRoles\(ROLE_CODES\.MAYOR, ROLE_CODES\.MSWDO\)/);
  assert.match(serviceSource, /\[MAYOR_ROLE_CODE, MSWDO_ROLE_CODE\]\.includes/);
});

test("DISTFETCH-03 Mayor remains authorized on the shared municipal contract", () => {
  assert.match(routeSource, /requireRoles\(ROLE_CODES\.MAYOR, ROLE_CODES\.MSWDO\)/);
  assert.match(serviceSource, /const MAYOR_ROLE_CODE = \"MAYOR\"/);
});

test("DISTFETCH-04 unsupported roles remain denied by route middleware", () => {
  assert.match(routeSource, /requireRoles\(ROLE_CODES\.MAYOR, ROLE_CODES\.MSWDO\)/);
  assert.doesNotMatch(routeSource, /requireRoles\([^)]*ROLE_CODES\.BARANGAY[^)]*municipal/);
});

test("DISTFETCH-05 preparation passes the selected disaster event", () => {
  assert.match(preparationSource, /fetchMunicipalStubDashboard\(\{ disasterEventId: eventId/);
  assert.match(clientServiceSource, /disaster_event_id: disasterEventId/);
});

test("DISTFETCH-06 preparation does not require a selected Barangay", () => {
  assert.match(clientServiceSource, /fetchMunicipalStubDashboard = async \(\{[\s\S]*?disasterEventId/);
  assert.doesNotMatch(preparationSource, /fetchMunicipalStubDashboard\(\{[^}]*barangay/);
});

test("DISTFETCH-07 municipal preparation keeps the complete response envelope", () => {
  assert.match(serviceSource, /scope: \"municipal\"/);
  assert.match(serviceSource, /data = await Promise\.all/);
  assert.match(serviceSource, /count: data\.length/);
});

test("DISTFETCH-08 valid empty affected scope remains an authoritative empty success", () => {
  assert.match(serviceSource, /if \(barangayIds\.length === 0\)/);
  assert.match(serviceSource, /count: 0,[\s\S]*?data: \[\]/);
});

test("DISTFETCH-09 fetch failures remain classified as DISTRIBUTION_FETCH", () => {
  assert.match(preparationSource, /runPreparationStage\(MSWDO_PREPARATION_FAILURE_STAGES\.DISTRIBUTION_FETCH/);
});

test("DISTFETCH-10 invalid distribution payload remains DISTRIBUTION_VALIDATE", () => {
  assert.match(preparationSource, /MSWDO_PREPARATION_FAILURE_STAGES\.DISTRIBUTION_VALIDATE/);
  assert.match(preparationSource, /DISTRIBUTION_ID_OR_QR/);
});

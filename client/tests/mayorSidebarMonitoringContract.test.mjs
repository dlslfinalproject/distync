import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.jsx");
const routesPath = path.join(process.cwd(), "src", "routes", "AppRoutes.jsx");
const layoutPath = path.join(process.cwd(), "src", "components", "layout", "BarangayLayout.jsx");

const getRoleNavBlock = (source, role) =>
  source.match(
    new RegExp(`\\[ROLE_CODES\\.${role}\\]: \\{[\\s\\S]*?navItems: \\[([\\s\\S]*?)\\],`),
  )?.[1] || "";

const getRoutes = (navBlock) =>
  [...navBlock.matchAll(/to: "([^"]+)"/g)].map((match) => match[1]);

const getIndex = (navBlock, label, route) =>
  navBlock.indexOf(`{ label: "${label}", to: "${route}"`);

const monitoringSection = '{ type: "section", label: "Monitoring" }';

test("Mayor sidebar groups all proven monitoring surfaces in the required order", async () => {
  const source = await fs.readFile(sidebarPath, "utf8");
  const mayor = getRoleNavBlock(source, "MAYOR");
  const monitoringIndex = mayor.indexOf(monitoringSection);

  assert.ok(monitoringIndex >= 0, "Mayor Monitoring section is present");

  const expectedMonitoringItems = [
    ["Inventory Tracking Management", "/inventory/transactions"],
    ["Audit Trail", "/inventory/system-logs"],
    ["Sync Center", "/inventory/sync"],
    ["Anomaly Tracking", "/inventory/anomalies"],
  ];

  let previousIndex = monitoringIndex;
  for (const [label, route] of expectedMonitoringItems) {
    const itemText = `{ label: "${label}", to: "${route}", isSectionChild: true }`;
    const itemIndex = mayor.indexOf(itemText);

    assert.ok(itemIndex > previousIndex, `${label} follows the Monitoring heading and prior child`);
    previousIndex = itemIndex;
    assert.equal(
      (mayor.match(new RegExp(`label: "${label}"`, "g")) || []).length,
      1,
      `${label} appears exactly once in the Mayor navigation`,
    );
  }

  assert.equal(getRoutes(mayor).length, 9, "Mayor navigation keeps all nine existing links");
  assert.equal(new Set(getRoutes(mayor)).size, getRoutes(mayor).length, "Mayor links remain unique");
  assert.doesNotMatch(mayor, /\/inventory\/monitoring/, "Monitoring is not a fake destination route");
  assert.match(
    source,
    /item\.type === "section"[\s\S]*className="distync-sidebar__nav-section-label"/,
    "Monitoring uses the shared non-link section renderer",
  );
});

test("Mayor operational and analytics modules remain outside Monitoring", async () => {
  const source = await fs.readFile(sidebarPath, "utf8");
  const mayor = getRoleNavBlock(source, "MAYOR");
  const monitoringIndex = mayor.indexOf(monitoringSection);

  const operationalOrAnalyticsItems = [
    ["Inventory Items Management", "/inventory/items"],
    ["Relief Pack Templates Management", "/inventory/relief-pack-templates"],
    ["Inventory Distribution Management", "/inventory/distribution"],
    ["Inventory Forecasting Management", "/inventory/forecasts"],
    ["Donation Management", "/inventory/donations"],
  ];

  for (const [label, route] of operationalOrAnalyticsItems) {
    const itemIndex = getIndex(mayor, label, route);
    assert.ok(itemIndex >= 0, `${label} remains a Mayor navigation item`);
    assert.ok(itemIndex < monitoringIndex, `${label} remains outside Monitoring`);
  }
});

test("Mayor monitoring links preserve routes and shared active, role, and responsive contracts", async () => {
  const [sidebarSource, routesSource, layoutSource] = await Promise.all([
    fs.readFile(sidebarPath, "utf8"),
    fs.readFile(routesPath, "utf8"),
    fs.readFile(layoutPath, "utf8"),
  ]);

  assert.match(routesSource, /path: "system-logs", element: <SystemLogReviewPage \/>/);
  assert.match(routesSource, /path: "sync", element: <SyncManagementPage \/>/);
  assert.match(routesSource, /path: "anomalies", element: <MayorAnomalyTrackingPage \/>/);
  assert.match(routesSource, /path: "transactions",\s*element: <InventoryTransactionsPage \/>/);

  assert.match(
    sidebarSource,
    /<NavLink[\s\S]*to=\{item\.to\}[\s\S]*\{\(\{ isActive \}\) =>/,
    "sidebar links use NavLink's established active-route matching",
  );
  assert.match(
    sidebarSource,
    /backgroundColor: isActive[\s\S]*color: isActive[\s\S]*border:/,
    "active styling is applied to child links rather than the section heading",
  );
  assert.match(
    sidebarSource,
    /marginLeft: item\.isSectionChild && !isCollapsed \? "8px" : 0/,
    "Monitoring children retain the shared expanded-sidebar indentation",
  );
  assert.match(
    sidebarSource,
    /display: isCollapsed \? "none" : sidebarStyles\.navSectionLabel\.display/,
    "the non-navigable section heading remains hidden in the collapsed shell",
  );
  assert.match(
    layoutSource,
    /onNavigate=\{\(\) => \{[\s\S]*?if \(isMobileNavigation\)[\s\S]*?setIsSidebarCollapsed\(true\)/,
    "mobile navigation still closes after selecting a child route",
  );
  assert.match(layoutSource, /distync-sidebar__scrim/);
  assert.match(sidebarSource, /if \(currentRole === ROLE_CODES\.DONOR\) return null;/);
});

test("Barangay, MSWDO, and guest navigation boundaries remain unchanged", async () => {
  const source = await fs.readFile(sidebarPath, "utf8");
  const barangay = getRoleNavBlock(source, "BARANGAY");
  const mswdo = getRoleNavBlock(source, "MSWDO");

  assert.deepEqual(getRoutes(barangay), [
    "/barangay/masterlist",
    "/barangay/stub-distribution",
    "/barangay/distribution-history",
    "/barangay/sync",
    "/barangay/anomalies",
  ]);
  assert.deepEqual(getRoutes(mswdo), [
    "/mswdo/disaster-events",
    "/mswdo/disaster-reports",
    "/mswdo/consolidated-masterlist",
    "/mswdo/stub-distribution",
    "/mswdo/distribution-history",
    "/mswdo/analytics",
    "/mswdo/sync",
    "/mswdo/anomalies",
  ]);

  const barangayMonitoringIndex = barangay.indexOf(monitoringSection);
  const barangaySyncIndex = getIndex(barangay, "Sync Center", "/barangay/sync");
  const barangayAnomalyIndex = getIndex(barangay, "Anomaly Tracking", "/barangay/anomalies");
  assert.ok(barangayMonitoringIndex < barangaySyncIndex);
  assert.ok(barangaySyncIndex < barangayAnomalyIndex);

  const mswdoMonitoringIndex = mswdo.indexOf(monitoringSection);
  const mswdoAnalyticsIndex = getIndex(mswdo, "Evacuee Analytics Dashboard", "/mswdo/analytics");
  const mswdoSyncIndex = getIndex(mswdo, "Sync Center", "/mswdo/sync");
  const mswdoAnomalyIndex = getIndex(mswdo, "Anomaly Tracking", "/mswdo/anomalies");
  assert.ok(mswdoMonitoringIndex < mswdoAnalyticsIndex);
  assert.ok(mswdoAnalyticsIndex < mswdoSyncIndex);
  assert.ok(mswdoSyncIndex < mswdoAnomalyIndex);

  assert.doesNotMatch(barangay, /\/inventory\//);
  assert.doesNotMatch(mswdo, /\/inventory\//);
  assert.match(source, /if \(currentRole === ROLE_CODES\.DONOR\) return null;/);
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sidebarPath = path.join(process.cwd(), "src", "components", "layout", "Sidebar.jsx");
const accountPath = path.join(process.cwd(), "src", "components", "layout", "SidebarAccountMenu.jsx");
const layoutPath = path.join(process.cwd(), "src", "components", "layout", "BarangayLayout.jsx");

const getRoleNavBlock = (source, role) =>
  source.match(new RegExp(`\\[ROLE_CODES\\.${role}\\]: \\{[\\s\\S]*?navItems: \\[([\\s\\S]*?)\\],`))?.[1] || "";

const expectNavItem = (block, label, route, extra = "") => {
  assert.match(
    block,
    new RegExp(`\\{ label: "${label}", to: "${route}"${extra} \\}`),
  );
};

test("Barangay and MSWDO retain separate role-specific navigation routes", async () => {
  const source = await fs.readFile(sidebarPath, "utf8");
  const barangay = getRoleNavBlock(source, "BARANGAY");
  const mswdo = getRoleNavBlock(source, "MSWDO");

  expectNavItem(barangay, "Evacuee Masterlist Management", "/barangay/masterlist");
  expectNavItem(barangay, "Relief Goods Distribution", "/barangay/stub-distribution");
  expectNavItem(barangay, "Distribution History", "/barangay/distribution-history");
  expectNavItem(barangay, "Sync Center", "/barangay/sync", ', isSectionChild: true');
  expectNavItem(barangay, "Anomaly Tracking", "/barangay/anomalies", ', isSectionChild: true');

  expectNavItem(mswdo, "Disaster Event Management", "/mswdo/disaster-events");
  expectNavItem(mswdo, "Disaster Events Summary", "/mswdo/disaster-reports");
  expectNavItem(mswdo, "Evacuee Masterlist Management", "/mswdo/consolidated-masterlist");
  expectNavItem(mswdo, "Relief Goods Distribution", "/mswdo/stub-distribution");
  expectNavItem(mswdo, "Distribution History", "/mswdo/distribution-history");
  expectNavItem(mswdo, "Evacuee Analytics Dashboard", "/mswdo/analytics", ', isSectionChild: true');
  expectNavItem(mswdo, "Anomaly Tracking", "/mswdo/anomalies", ', isSectionChild: true');
  expectNavItem(mswdo, "Sync Center", "/mswdo/sync", ', isSectionChild: true');

  assert.doesNotMatch(barangay, /\/mswdo\//);
  assert.doesNotMatch(mswdo, /\/barangay\//);
  assert.doesNotMatch(mswdo, /Inventory Items Management|Audit Trail/);
  assert.doesNotMatch(barangay, /Disaster Event Management|Evacuee Analytics Dashboard/);
});

test("MSWDO uses the shared Monitoring section hierarchy without changing primary order", async () => {
  const source = await fs.readFile(sidebarPath, "utf8");
  const mswdo = getRoleNavBlock(source, "MSWDO");
  const primaryLastIndex = mswdo.indexOf('{ label: "Distribution History", to: "/mswdo/distribution-history" }');
  const sectionIndex = mswdo.indexOf('{ type: "section", label: "Monitoring" }');
  const analyticsIndex = mswdo.indexOf('{ label: "Evacuee Analytics Dashboard", to: "/mswdo/analytics", isSectionChild: true }');
  const syncIndex = mswdo.indexOf('{ label: "Sync Center", to: "/mswdo/sync", isSectionChild: true }');
  const anomalyIndex = mswdo.indexOf('{ label: "Anomaly Tracking", to: "/mswdo/anomalies", isSectionChild: true }');

  assert.ok(primaryLastIndex >= 0);
  assert.ok(sectionIndex > primaryLastIndex);
  assert.ok(analyticsIndex > sectionIndex);
  assert.ok(syncIndex > analyticsIndex);
  assert.ok(anomalyIndex > syncIndex);
  assert.match(source, /item\.type === "section"[\s\S]*distync-sidebar__nav-section-label/);
  assert.match(source, /marginLeft: item\.isSectionChild && !isCollapsed \? "8px" : 0/);
});

test("Barangay and MSWDO share the shell, active-item, responsive, and profile contracts", async () => {
  const [sidebar, account, layout] = await Promise.all([
    fs.readFile(sidebarPath, "utf8"),
    fs.readFile(accountPath, "utf8"),
    fs.readFile(layoutPath, "utf8"),
  ]);

  assert.equal((sidebar.match(/className="distync-sidebar__nav-item"/g) || []).length, 1);
  assert.equal((sidebar.match(/className="distync-sidebar__nav-section-label"/g) || []).length, 1);
  assert.match(sidebar, /<NavLink[\s\S]*\{\(\{ isActive \}\) =>/);
  assert.match(sidebar, /backgroundColor: isActive[\s\S]*borderRadius: "10px"/);
  assert.match(sidebar, /aria-hidden=\{isCollapsed \? "true" : undefined\}/);
  assert.match(sidebar, /className="distync-sidebar__account-area"/);
  assert.match(sidebar, /accountArea:[\s\S]*marginTop: "auto"/);
  assert.match(sidebar, /overflowY: "auto"/);
  assert.match(sidebar, /<SidebarAccountMenu \/>/);
  assert.match(account, /MSWDO Personnel/);
  assert.match(account, /Barangay Official/);
  assert.match(layout, /<Sidebar[\s\S]*isMobileNavigation=\{isMobileNavigation\}/);
  assert.match(layout, /distync-sidebar__scrim/);
});

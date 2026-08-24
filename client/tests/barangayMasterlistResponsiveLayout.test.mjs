import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) =>
  path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("Barangay masterlist toolbar and event summary expose mobile responsive hooks", async () => {
  const [dashboardSource, toolbarSource, cssSource] = await Promise.all([
    readSource([
      "components",
      "barangay-dashboard",
      "BarangayDashboardOverview.jsx",
    ]),
    readSource(["components", "masterlist", "MasterlistToolbar.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(dashboardSource, /className="barangay-dashboard-event-title"/);
  assert.match(dashboardSource, /className="barangay-dashboard-event-meta"/);
  assert.match(toolbarSource, /className="masterlist-toolbar-search"/);
  assert.match(toolbarSource, /className="masterlist-toolbar-actions"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.barangay-dashboard-event-meta \{[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.masterlist-toolbar-search,[\s\S]*?\.masterlist-toolbar-actions \{[\s\S]*?flex: 1 1 100% !important;/,
  );
});

test("Shared shell releases page width through a mobile navigation drawer", async () => {
  const [layoutSource, sidebarSource, headerSource, cssSource] =
    await Promise.all([
      readSource(["components", "layout", "BarangayLayout.jsx"]),
      readSource(["components", "layout", "Sidebar.jsx"]),
      readSource(["components", "layout", "ShellHeader.jsx"]),
      readSource(["index.css"]),
    ]);

  assert.match(layoutSource, /MOBILE_NAV_QUERY = "\[?\(max-width: 1024px\)/);
  assert.match(layoutSource, /window\.matchMedia\(MOBILE_NAV_QUERY\)/);
  assert.match(layoutSource, /className="distync-sidebar__scrim"/);
  assert.match(layoutSource, /onClose=\{\(\) => \{[\s\S]*?setIsSidebarCollapsed\(true\);[\s\S]*?sidebarToggleRef\.current\?\.focus\(\);/);
  assert.match(layoutSource, /onNavigate=\{\(\) => \{[\s\S]*?setIsSidebarCollapsed\(true\)/);
  assert.match(sidebarSource, /aria-label=\{title \|\| \(isCollapsed \? "Open navigation menu" : "Close navigation menu"\)\}/);
  assert.match(sidebarSource, /onClick=\{onNavigate\}/);
  assert.match(headerSource, /className="distync-shell__brand-area"/);
  assert.match(headerSource, /className="distync-shell__actions-area"/);
  assert.match(headerSource, /data-sidebar-collapsed=\{isSidebarCollapsed \? "true" : "false"\}/);
  assert.match(headerSource, /gridTemplateColumns: "var\(--header-brand-width, 280px\) minmax\(0, 1fr\)"/);
  assert.match(headerSource, /backgroundColor: "#f4f8fc"/);
  assert.doesNotMatch(headerSource, /borderRight: "1px solid #ccdceb"/);
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar \{[\s\S]*?position: fixed !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar\[data-collapsed="false"\] \{[\s\S]*?transform: translateX\(0\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar__scrim \{[\s\S]*?position: fixed;/,
  );
  assert.doesNotMatch(cssSource, /\.distync-shell \{[\s\S]*?height: 100dvh;/);
  assert.match(cssSource, /\.distync-shell__main \{[^}]*overflow: visible;/);
  assert.match(cssSource, /\.distync-shell__main \{[^}]*overflow-y: visible;/);
  assert.doesNotMatch(cssSource, /\.distync-shell__main \{[^}]*overflow-x: hidden;/);
  assert.doesNotMatch(cssSource, /\.distync-shell__main \{[^}]*overflow-y: auto;/);
  assert.match(cssSource, /\.distync-sidebar__body \{[\s\S]*?overscroll-behavior: contain;/);
  assert.match(sidebarSource, /const containDesktopSidebarWheel = useCallback\(\(event\) => \{/);
  assert.match(sidebarSource, /event\.preventDefault\(\);/);
  assert.match(sidebarSource, /scrollRegion\.scrollTop \+= event\.deltaY;/);
  assert.match(sidebarSource, /addEventListener\("wheel", containDesktopSidebarWheel, \{\s*passive: false,/);
  assert.match(sidebarSource, /top: "var\(--shell-header-height, 68px\)"/);
});

test("Shared shell switches its inline grid to one track with the fixed navigation drawer", async () => {
  const [layoutSource, cssSource] = await Promise.all([
    readSource(["components", "layout", "BarangayLayout.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(
    layoutSource,
    /gridTemplateColumns: isDonorPortal \|\| isMobileNavigation\s*\n\s*\? "minmax\(0, 1fr\)"/,
  );
  assert.match(
    layoutSource,
    /\[headerBrandWidth, isDonorPortal, isMobileNavigation, sidebarWidth\]/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-shell \{[\s\S]*?grid-template-columns: 1fr;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar \{[\s\S]*?position: fixed !important;/,
  );
});

test("Mobile drawer adds compact DISTYNC branding with an explicit close button", async () => {
  const [layoutSource, sidebarSource, cssSource] = await Promise.all([
    readSource(["components", "layout", "BarangayLayout.jsx"]),
    readSource(["components", "layout", "Sidebar.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(sidebarSource, /import \{ FiMenu, FiX \} from "react-icons\/fi"/);
  assert.match(sidebarSource, /import distyncLogo from "\.\.\/\.\.\/assets\/distync-logo\.png"/);
  assert.match(sidebarSource, /className="distync-sidebar__mobile-header"/);
  assert.match(sidebarSource, /className="distync-sidebar__mobile-brand"/);
  assert.match(sidebarSource, /src=\{distyncLogo\}/);
  assert.match(sidebarSource, /alt="DISTYNC logo"/);
  assert.match(sidebarSource, /className="distync-sidebar__mobile-wordmark">DISTYNC/);
  assert.match(sidebarSource, /className="distync-sidebar__mobile-close"/);
  assert.match(sidebarSource, /aria-label="Close navigation menu"/);
  assert.match(sidebarSource, /onClick=\{onClose\}/);
  assert.match(layoutSource, /onClose=\{\(\) => \{[\s\S]*?setIsSidebarCollapsed\(true\);[\s\S]*?sidebarToggleRef\.current\?\.focus\(\);/);
  assert.match(
    cssSource,
    /\.distync-sidebar__mobile-header \{[\s\S]*?display: none;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar__mobile-header \{[\s\S]*?display: flex;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar__mobile-logo \{[\s\S]*?width: 36px;[\s\S]*?height: 36px;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 1024px\)[\s\S]*?\.distync-sidebar__mobile-close:hover,[\s\S]*?\.distync-sidebar__mobile-close:focus-visible \{/,
  );
});

test("Household registration grids collapse to one column at mobile widths", async () => {
  const [familyHeadSource, membersSource, modalSource, cssSource] =
    await Promise.all([
      readSource([
        "components",
        "household-registration",
        "FamilyHeadSection.jsx",
      ]),
      readSource(["components", "household-registration", "MembersSection.jsx"]),
      readSource([
        "components",
        "household-registration",
        "RegisterFamilyModal.jsx",
      ]),
      readSource(["index.css"]),
    ]);

  [
    "household-registration-name-grid",
    "household-registration-detail-grid",
    "household-registration-photo-grid",
  ].forEach((className) =>
    assert.match(familyHeadSource, new RegExp(`className="${className}"`)),
  );

  [
    "household-registration-member-name-grid",
    "household-registration-member-detail-grid",
  ].forEach((className) =>
    assert.match(membersSource, new RegExp(`className="${className}"`)),
  );

  assert.match(modalSource, /className="household-registration-modal-backdrop"/);
  assert.match(modalSource, /className="household-registration-modal"/);
  assert.match(modalSource, /className="household-registration-modal-topbar"/);
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.household-registration-name-grid,[\s\S]*?\.household-registration-member-detail-grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.household-registration-modal,[\s\S]*?\.masterlist-detail-modal \{[\s\S]*?max-height: calc\(100vh - 24px\) !important;/,
  );
});

test("Household contact number field uses a bounded shared responsive layout", async () => {
  const [householdFormSource, modalSource, barangayPageSource] =
    await Promise.all([
      readSource([
        "components",
        "household-registration",
        "HouseholdFormSection.jsx",
      ]),
      readSource([
        "components",
        "household-registration",
        "RegisterFamilyModal.jsx",
      ]),
      readSource(["pages", "barangay", "BarangayMasterlistPage.jsx"]),
    ]);

  assert.match(householdFormSource, /phoneInputGroup: \{[\s\S]*?width: "100%"/);
  assert.match(householdFormSource, /phoneInputGroup: \{[\s\S]*?maxWidth: "100%"/);
  assert.match(householdFormSource, /phoneInputGroup: \{[\s\S]*?minWidth: 0/);
  assert.match(householdFormSource, /phonePrefix: \{[\s\S]*?minWidth: "124px"/);
  assert.match(householdFormSource, /phonePrefix: \{[\s\S]*?flex: "0 0 auto"/);
  assert.match(householdFormSource, /phoneInput: \{[\s\S]*?flex: "1 1 auto"/);
  assert.match(householdFormSource, /phoneInput: \{[\s\S]*?minWidth: 0/);
  assert.match(householdFormSource, /phoneInput: \{[\s\S]*?width: "100%"/);
  assert.match(householdFormSource, /<div style=\{fieldStyles\.phonePrefix\}>PH \+63<\/div>/);
  assert.match(householdFormSource, /type="text"/);
  assert.match(householdFormSource, /inputMode="numeric"/);
  assert.match(householdFormSource, /placeholder="912 345 6789"/);
  assert.match(modalSource, /<HouseholdFormSection form=\{form\} \/>/);
  assert.match(
    barangayPageSource,
    /<RegisterFamilyModal[\s\S]*?form=\{registrationForm\}[\s\S]*?<RegisterFamilyModal[\s\S]*?form=\{editHouseholdForm\}/,
  );
});

test("Data privacy notice footer stacks compact actions without shortening the required label", async () => {
  const [modalSource, privacyNoticeSource] = await Promise.all([
    readSource([
      "components",
      "household-registration",
      "DataPrivacyConsentModal.jsx",
    ]),
    readSource(["features", "household-registration", "privacyNotice.mjs"]),
  ]);

  assert.match(
    privacyNoticeSource,
    /HOUSEHOLD_PRIVACY_CONFIRM_BUTTON_LABEL[\s\S]*Confirm Acknowledgment and Continue/,
  );
  assert.match(modalSource, /compactFooter: \{/);
  assert.match(modalSource, /flexDirection: "column"/);
  assert.match(modalSource, /compactFooterButton: \{/);
  assert.match(modalSource, /whiteSpace: "normal"/);
  assert.match(modalSource, /overflowWrap: "normal"/);
  assert.match(
    modalSource,
    /\.\.\.\(isCompactViewport[\s\S]*modalStyles\.compactFooterButton/,
  );
});

test("Household detail modal keeps a phone-safe shell without moving privacy acknowledgement", async () => {
  const [detailSource, cssSource] = await Promise.all([
    readSource(["components", "masterlist", "HouseholdDetailModal.jsx"]),
    readSource(["index.css"]),
  ]);

  assert.match(detailSource, /className="masterlist-detail-modal-backdrop"/);
  assert.match(detailSource, /className="masterlist-detail-modal"/);
  assert.match(detailSource, /className="masterlist-detail-modal-topbar"/);
  assert.match(
    detailSource,
    /Family Members[\s\S]*showDataPrivacyAcknowledgement \? \([\s\S]*Data Privacy Acknowledgement/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 768px\)[\s\S]*?\.masterlist-detail-modal-topbar \{[\s\S]*?flex-wrap: wrap;/,
  );
  assert.match(
    cssSource,
    /@media \(max-width: 480px\)[\s\S]*?\.masterlist-detail-modal \{[\s\S]*?max-height: calc\(100vh - 24px\) !important;/,
  );
});

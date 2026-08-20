import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir = path.dirname(fileURLToPath(import.meta.url));
const viewports = [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [820, 1180],
  [768, 1024],
  [430, 932],
  [390, 844],
  [360, 800],
  [1366, 600],
  [390, 700],
];

const eventId = "event-long-1";
const barangayId = "barangay-long-1";
const longEventTitle =
  "Super Typhoon Responsive Verification Event With Extended Official Name For MSWDO Relief Goods Distribution";
const longBarangayName = "Barangay San Isidro Long Name Verification District";

const eventPayload = [
  {
    id: eventId,
    title: longEventTitle,
    status: "ACTIVE",
    start_date: "2026-08-01",
    end_date: null,
    affected_barangays: [{ id: barangayId, name: longBarangayName }],
  },
];
const barangayPayload = [{ id: barangayId, name: longBarangayName }];
const sectorPayload = [
  { id: "senior_citizen", code: "senior_citizen", name: "Senior Citizen" },
  { id: "pregnant_woman", code: "pregnant_woman", name: "Pregnant Woman" },
  { id: "pwd", code: "pwd", name: "Person with Disability" },
  { id: "solo_parent", code: "solo_parent", name: "Solo Parent" },
  { id: "child", code: "child", name: "Child" },
];
const rows = [
  {
    id: "stub-1",
    household: {
      id: "household-1",
      family_head_name:
        "Maria Consuelo De La Cruz Santiago With A Very Long Household Head Name",
      members_count: 9,
      is_active: true,
    },
    household_id: "household-1",
    display_stub_no: "STUB#2026-00000000012345",
    stub_sequence_no: 12345,
    stub_no: "STUB-2026-00000000012345",
    serial_no: "SERIAL-RESPONSIVE-0000000001",
    qr_code_value: "RAW-QR-VALUE-SHOULD-NOT-BE-VISIBLE-1234567890",
    qr_generated_at: "2026-08-16T01:00:00.000Z",
    relief_pack_name:
      "Family Relief Pack With Extra Long Donated Pack Name For Wrapping Verification",
    assigned_relief_packs: [
      {
        name: "Family Relief Pack With Extra Long Donated Pack Name For Wrapping Verification",
        description: "5",
        based_on_family_size: true,
        is_additional_pack: false,
      },
    ],
    sectors_text: "Senior Citizen, Pregnant Woman, Person with Disability, Solo Parent",
    sector_ids: ["senior_citizen", "pregnant_woman", "pwd", "solo_parent"],
    status: "ISSUED",
    disaster_event: { id: eventId, title: longEventTitle },
    barangay: { id: barangayId, name: longBarangayName },
  },
  {
    id: "stub-2",
    household: {
      id: "household-2",
      family_head_name: "Juan Dela Cruz",
      members_count: 4,
      is_active: true,
    },
    household_id: "household-2",
    display_stub_no: "STUB#2026-0002",
    stub_sequence_no: 2,
    qr_code_value: "ANOTHER-RAW-QR-VALUE-SHOULD-STAY-HIDDEN",
    relief_pack_name: "Standard Family Pack",
    assigned_relief_packs: [
      {
        name: "Standard Family Pack",
        description: "5",
        based_on_family_size: true,
        is_additional_pack: false,
      },
    ],
    sectors_text: "Child",
    sector_ids: ["child"],
    status: "CLAIMED",
    disaster_event: { id: eventId, title: longEventTitle },
    barangay: { id: barangayId, name: longBarangayName },
  },
];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

for (const [width, height] of viewports) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
  });

  await context.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let body;

    if (
      url.pathname === "/api/v1/disaster-events" ||
      url.pathname === "/api/v1/disaster-events/active"
    ) {
      body = eventPayload;
    } else if (url.pathname === "/api/v1/barangays") {
      body = barangayPayload;
    } else if (url.pathname === "/api/v1/sectors/mswdo") {
      body = sectorPayload;
    } else if (url.pathname === "/api/v1/stubs/barangay-dashboard") {
      body = {
        metrics: {
          total_issued_stubs: 9999,
          beneficiary_families: 8888,
          claimed_stubs: 7777,
          unclaimed_stubs: 2222,
        },
        data: rows,
      };
    } else {
      body = { message: "Mocked empty response", data: [] };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await context.addInitScript(() => {
    const session = {
      accessMode: "DEVELOPMENT",
      token: "layout-only-token",
      user: { id: "mswdo-layout-user", role: "MSWDO", name: "MSWDO Layout User" },
    };

    localStorage.setItem("distync:DEVELOPMENT:selected-role", "MSWDO");
    localStorage.setItem(
      "distync:DEVELOPMENT:auth-session",
      JSON.stringify(session),
    );
  });

  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/mswdo/stub-distribution", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const tableScroll = document.querySelector(".stub-results-table-scroll");
    const toolbar = document.querySelector(".stub-distribution-toolbar");
    const eventSummary = document.querySelector(".mswdo-stub-event-summary");
    const rawQrVisible =
      document.body.innerText.includes("RAW-QR-VALUE-SHOULD-NOT-BE-VISIBLE") ||
      document.body.innerText.includes("ANOTHER-RAW-QR-VALUE-SHOULD-STAY-HIDDEN");

    return {
      path: location.pathname,
      docClientWidth: doc.clientWidth,
      docScrollWidth: doc.scrollWidth,
      tableClientWidth: tableScroll?.clientWidth || 0,
      tableScrollWidth: tableScroll?.scrollWidth || 0,
      toolbarClientWidth: toolbar?.clientWidth || 0,
      toolbarScrollWidth: toolbar?.scrollWidth || 0,
      eventClientWidth: eventSummary?.clientWidth || 0,
      eventScrollWidth: eventSummary?.scrollWidth || 0,
      rawQrVisible,
      hasMswdoPage: Boolean(document.querySelector(".mswdo-stub-scope-card")),
      hasResultsTable: Boolean(tableScroll),
    };
  });
  const screenshot = `mswdo-rgd-${width}x${height}.png`;

  await page.screenshot({ path: path.join(outDir, screenshot), fullPage: true });
  results.push({
    viewport: `${width}x${height}`,
    screenshot,
    ...metrics,
    pageOverflow: metrics.docScrollWidth > metrics.docClientWidth + 1,
    toolbarOverflow: metrics.toolbarScrollWidth > metrics.toolbarClientWidth + 1,
    eventOverflow: metrics.eventScrollWidth > metrics.eventClientWidth + 1,
  });
  await context.close();
}

await browser.close();
await fs.writeFile(
  path.join(outDir, "browser-metrics.json"),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));

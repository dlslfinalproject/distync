const { createRequire } = require("module");
const fs = require("fs/promises");
const path = require("path");

const requireFromRoot = createRequire(path.join(process.cwd(), "visual-check.cjs"));
const { chromium } = requireFromRoot("playwright");

const baseUrl = "http://127.0.0.1:5173";
const outputDir = path.join(
  process.cwd(),
  "tmp",
  "mswdo-evacuee-masterlist-responsive",
);

const barangays = [
  {
    id: "brgy-long-poblacion",
    name: "Poblacion 3 - Malvar Batangas With Long Barangay Name",
    code: "POB3",
  },
  {
    id: "brgy-san-isidro-extension",
    name: "San Isidro Extension Riverside Low-Lying Community",
    code: "SIE",
  },
];

const event = {
  id: "event-mswdo-long-001",
  event_code: "DE-2026-0007",
  title:
    "Typhoon Maymay Extended Preparedness and Multi-Barangay Evacuation Operations With Long Name",
  event_name:
    "Typhoon Maymay Extended Preparedness and Multi-Barangay Evacuation Operations With Long Name",
  disaster_type: "Typhoon",
  status: "ACTIVE",
  start_date: "2026-08-10T00:00:00.000Z",
  end_date: "2026-08-20T00:00:00.000Z",
  affected_barangays: barangays,
};

const endedEvent = {
  ...event,
  id: "event-mswdo-ended-001",
  title: "Completed Monsoon Flooding Recovery and Evacuation Consolidation",
  status: "CLOSED",
  ended_at: "2026-08-12T10:30:00.000Z",
};

const sectors = [
  {
    id: "sector-senior",
    code: "SENIOR_CITIZEN",
    name: "Senior Citizen",
    display_name: "Senior Citizen",
  },
  {
    id: "sector-pwd",
    code: "PWD",
    name: "Person with Disability",
    display_name: "Person with Disability",
  },
  {
    id: "sector-pregnant",
    code: "PREGNANT",
    name: "Pregnant",
    display_name: "Pregnant",
  },
  {
    id: "sector-child",
    code: "CHILD",
    name: "Child",
    display_name: "Child",
  },
  {
    id: "sector-lactating",
    code: "LACTATING_MOTHER",
    name: "Lactating Mother",
    display_name: "Lactating Mother",
  },
];

const households = [
  {
    household_id: "hh-mswdo-001",
    masterlist_record_id: "ml-mswdo-001",
    evacuation_log_id: "elog-mswdo-001",
    family_head_name:
      "Maria Consuelo De La Cruz Santos Longname Extension Family Head",
    current_address_details:
      "Zone 7, Purok Maharlika Extension, Poblacion 3, Malvar, Batangas near the long covered walkway and water station",
    barangay: barangays[0],
    disaster_event: event,
    disaster_event_id: event.id,
    contact_number: "+639171234567",
    residency_status: "RESIDENT",
    current_stay_type: "EVAC_CENTER",
    is_active: true,
    registered_at: "2026-08-15T08:00:00.000Z",
    latest_attendance: {
      id: "att-mswdo-001",
      status: "PRESENT",
      time_in: "2026-08-15T08:15:00.000Z",
      time_out: null,
      evacuation_center_id: "evac-1",
    },
    household_sectors: sectors.slice(0, 3),
    members: [
      {
        id: "member-head",
        first_name: "Maria Consuelo",
        middle_name: "De La Cruz",
        last_name: "Santos Longname Extension",
        suffix: "",
        is_family_head: true,
        sex: "FEMALE",
        age_value: 67,
        age_unit: "YEARS",
        relationship_to_head: "Family Head",
        sectors: sectors.slice(0, 2),
      },
      {
        id: "member-child",
        first_name: "Juan Miguel Alejandro",
        middle_name: "Reyes",
        last_name: "Santos Longname Extension",
        suffix: "",
        is_family_head: false,
        sex: "MALE",
        age_value: 12,
        age_unit: "YEARS",
        relationship_to_head: "Child",
        sectors: [sectors[3]],
      },
      {
        id: "member-adult",
        first_name: "Ana Patricia Lourdes",
        middle_name: "Lopez",
        last_name: "Santos Longname Extension",
        suffix: "",
        is_family_head: false,
        sex: "FEMALE",
        age_value: 34,
        age_unit: "YEARS",
        relationship_to_head: "Daughter",
        sectors: [sectors[2], sectors[4]],
      },
    ],
  },
];

const householdDetails = {
  household: {
    id: "hh-mswdo-001",
    household_id: "hh-mswdo-001",
    family_head_first_name: "Maria Consuelo",
    family_head_middle_name: "De La Cruz",
    family_head_last_name: "Santos Longname Extension",
    family_head_suffix: "",
    family_head_photo_url: "",
    current_address_details: households[0].current_address_details,
    contact_number: "+639171234567",
    residency_status: "RESIDENT",
    current_stay_type: "EVAC_CENTER",
    barangay_name: barangays[0].name,
    household_size: 3,
    registered_at: "2026-08-15T08:00:00.000Z",
  },
  latest_attendance: households[0].latest_attendance,
  members: households[0].members,
  sectors,
  privacy_consent: {
    consent_status: "ACKNOWLEDGED",
    notice_version: "2026-07-30-v2",
    recorded_at: "2026-08-15T08:05:00.000Z",
    acknowledged_by_name: "Maria Consuelo Santos Longname Extension",
    representative_relationship: "Family Head",
    sync_status: "SYNCED",
    is_offline_encoded: false,
  },
};

const jsonResponse = (payload, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(payload),
});

const setupMocks = async (page) => {
  await page.route("http://localhost:5000/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (
      request.method() !== "GET" &&
      !(pathname.includes("/duplicate-suggestions") && request.method() === "POST")
    ) {
      await route.fulfill(
        jsonResponse({ message: "Mocked visual run blocks mutations" }, 409),
      );
      return;
    }

    if (pathname.endsWith("/api/v1/disaster-events")) {
      await route.fulfill(jsonResponse([event, endedEvent]));
    } else if (pathname.endsWith("/api/v1/disaster-events/active")) {
      await route.fulfill(jsonResponse([event]));
    } else if (pathname.endsWith("/api/v1/barangays")) {
      await route.fulfill(jsonResponse(barangays));
    } else if (
      pathname.endsWith("/api/v1/sectors") ||
      pathname.endsWith("/api/v1/sectors/mswdo")
    ) {
      await route.fulfill(jsonResponse({ data: sectors }));
    } else if (pathname.endsWith("/api/v1/masterlist/mswdo-dashboard")) {
      await route.fulfill(
        jsonResponse({
          disaster_event: event,
          filters: {
            disaster_event_id: event.id,
            barangay_id: url.searchParams.get("barangay_id"),
          },
          summary_metrics: {
            total_number_of_evacuees_individuals: 12,
            total_number_of_families: 4,
            average_household_size: 3,
            currently_admitted_evacuees: 9,
            total_departed_evacuees: 3,
            total_barangays_covered: 2,
          },
          charts: { per_barangay: [] },
          has_data: true,
        }),
      );
    } else if (pathname.endsWith("/api/v1/masterlist")) {
      await route.fulfill(
        jsonResponse({
          disaster_event: event,
          filters: {
            disaster_event_id: event.id,
            barangay_id: url.searchParams.get("barangay_id"),
          },
          count: households.length,
          data: households,
        }),
      );
    } else if (pathname.includes("/api/v1/households/hh-mswdo-001")) {
      await route.fulfill(jsonResponse({ data: householdDetails }));
    } else if (pathname.includes("/api/v1/households/duplicate-suggestions")) {
      await route.fulfill(
        jsonResponse({
          data: { total_matches: 0, has_strong_matches: false, groups: [] },
        }),
      );
    } else if (pathname.includes("/api/v1/notifications")) {
      await route.fulfill(
        jsonResponse(
          pathname.includes("unread-count")
            ? { unread_count: 0 }
            : { data: [], next_cursor: null },
        ),
      );
    } else {
      await route.fulfill(jsonResponse({ data: [] }));
    }
  });
};

const seedAuth = async (context) => {
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("distync:DEVELOPMENT:selected-role", "MSWDO");
    localStorage.setItem(
      "distync:DEVELOPMENT:auth-session",
      JSON.stringify({
        accessMode: "DEVELOPMENT",
        token: "visual-mock-token",
        user: {
          id: "visual-mswdo-user",
          role: "MSWDO",
          name: "Visual MSWDO User",
          email: "visual-mswdo@example.test",
        },
      }),
    );
  });
};

const collect = async (page, label) =>
  page.evaluate((label) => {
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };

    const tableScroll = document.querySelector("section table")?.parentElement;
    const modal = document.querySelector(
      ".household-registration-modal, .masterlist-detail-modal",
    );

    return {
      label,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      body: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overflowX:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      },
      scope: rectFor(document.querySelector(".mswdo-masterlist-scope-card")),
      tabs: rectFor(document.querySelector(".mswdo-masterlist-tabs")),
      eventSummary: rectFor(
        document.querySelector(".mswdo-masterlist-event-summary-card"),
      ),
      summaryGrid: rectFor(document.querySelector(".mswdo-masterlist-summary-grid")),
      toolbar: rectFor(document.querySelector(".mswdo-masterlist-toolbar")),
      toolbarActions: rectFor(document.querySelector(".masterlist-toolbar-actions")),
      table: {
        wrapper: rectFor(tableScroll),
        scrollWidth: tableScroll?.scrollWidth || 0,
        clientWidth: tableScroll?.clientWidth || 0,
        localOverflow: (tableScroll?.scrollWidth || 0) > (tableScroll?.clientWidth || 0),
      },
      modal: rectFor(modal),
      visibleText: {
        registeredFamily: document.body.innerText.includes("Registered Family"),
        privacy: document.body.innerText.includes("Data Privacy Acknowledgement"),
        registerFamily: document.body.innerText.includes("Register Family"),
      },
    };
  }, label);

const run = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
  });
  await seedAuth(context);
  const page = await context.newPage();
  await setupMocks(page);

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

  const results = [];

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/mswdo/consolidated-masterlist`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".mswdo-masterlist-scope-card", {
      timeout: 8000,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    results.push(await collect(page, `${width}x${height}`));
    if ([390, 360, 1366].includes(width)) {
      await page.screenshot({
        path: path.join(outputDir, `${width}x${height}-masterlist.png`),
        fullPage: false,
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/mswdo/consolidated-masterlist`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".mswdo-masterlist-toolbar", { timeout: 8000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /Filter/i }).click();
  await page.waitForTimeout(300);
  const filterOpen = await collect(page, "390x844 filter open");
  await page.screenshot({
    path: path.join(outputDir, "390x844-filter-open.png"),
    fullPage: false,
  });

  await page.keyboard.press("Escape").catch(() => {});
  await page.mouse.click(20, 20).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /Register Family/i }).click();
  await page.waitForTimeout(500);
  const privacy = await collect(page, "390x844 privacy notice");
  await page.screenshot({
    path: path.join(outputDir, "390x844-privacy-notice.png"),
    fullPage: false,
  });

  await page.getByLabel(/I have read/i).check();
  await page
    .getByRole("button", { name: /Confirm Acknowledgment and Continue/i })
    .click();
  await page.waitForTimeout(800);
  const registration = await collect(page, "390x844 registration");
  await page.screenshot({
    path: path.join(outputDir, "390x844-registration.png"),
    fullPage: false,
  });

  await page.goto(`${baseUrl}/mswdo/consolidated-masterlist`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector('[data-masterlist-action-button="true"]', {
    timeout: 8000,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('[data-masterlist-action-button="true"]').first().click({
    force: true,
  });
  await page.waitForTimeout(300);
  await page
    .locator('[data-masterlist-action-menu="true"] button[aria-label="View Details"]')
    .click({ timeout: 5000 });
  await page.waitForTimeout(800);
  const details = await collect(page, "390x844 details");
  await page.screenshot({
    path: path.join(outputDir, "390x844-details.png"),
    fullPage: false,
  });

  await browser.close();
  const report = { results, filterOpen, privacy, registration, details };
  await fs.writeFile(
    path.join(outputDir, "visual-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

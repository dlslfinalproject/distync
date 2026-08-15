const { createRequire } = require("module");
const fs = require("fs/promises");
const path = require("path");

const requireFromClient = createRequire(
  path.join(process.cwd(), "client", "visual-check.cjs"),
);
const { chromium } = requireFromClient("playwright");

const baseUrl = "http://127.0.0.1:5173";
const outputDir = path.join(process.cwd(), "tmp", "barangay-masterlist-visual");

const barangay = {
  id: "brgy-poblacion",
  name: "Poblacion 3 - Malvar Batangas With Long Barangay Name",
  code: "POB3",
};

const event = {
  id: "event-typhoon-maymay",
  event_code: "DE-2026-0007",
  title: "Typhoon Response Maymay Extended Preparedness and Evacuation Operations",
  event_name: "Typhoon Response Maymay Extended Preparedness and Evacuation Operations",
  disaster_type: "Typhoon",
  status: "ACTIVE",
  start_date: "2026-08-10T00:00:00.000Z",
  end_date: "2026-08-20T00:00:00.000Z",
  affected_barangays: [barangay],
};

const sectors = [
  { id: "sector-senior", code: "SENIOR_CITIZEN", name: "Senior Citizen", display_name: "Senior Citizen" },
  { id: "sector-pwd", code: "PWD", name: "Person with Disability", display_name: "Person with Disability" },
  { id: "sector-pregnant", code: "PREGNANT", name: "Pregnant", display_name: "Pregnant" },
  { id: "sector-child", code: "CHILD", name: "Child", display_name: "Child" },
  { id: "sector-lactating", code: "LACTATING_MOTHER", name: "Lactating Mother", display_name: "Lactating Mother" },
];

const evacCenters = [
  {
    id: "evac-1",
    name: "Malvar Municipal Covered Court Evacuation Center",
    barangay_id: barangay.id,
    is_active: true,
  },
];

const households = [
  {
    household_id: "hh-001",
    masterlist_record_id: "ml-001",
    attendance_log_id: "att-001",
    family_head_name: "Maria Consuelo De La Cruz Santos Longname",
    current_address_details:
      "Zone 7, Purok Maharlika Extension, Poblacion 3, Malvar, Batangas near the long covered walkway",
    barangay,
    disaster_event: event,
    disaster_event_id: event.id,
    contact_number: "+639171234567",
    residency_status: "RESIDENT",
    current_stay_type: "EVAC_CENTER",
    is_active: true,
    registered_at: "2026-08-15T08:00:00.000Z",
    latest_attendance: {
      id: "att-001",
      status: "PRESENT",
      time_in: "2026-08-15T08:15:00.000Z",
      time_out: null,
      evacuation_center_id: "evac-1",
    },
    household_sectors: [sectors[0], sectors[1], sectors[2]],
    members: [
      {
        id: "m-head",
        first_name: "Maria",
        middle_name: "Consuelo",
        last_name: "Santos",
        suffix: "",
        is_family_head: true,
        sex: "FEMALE",
        age_value: 67,
        age_unit: "YEARS",
        relationship_to_head: "Family Head",
        sectors: [sectors[0], sectors[1]],
      },
      {
        id: "m-2",
        first_name: "Juan Miguel",
        middle_name: "Reyes",
        last_name: "Santos",
        suffix: "",
        is_family_head: false,
        sex: "MALE",
        age_value: 12,
        age_unit: "YEARS",
        relationship_to_head: "Child",
        sectors: [sectors[3]],
      },
      {
        id: "m-3",
        first_name: "Ana Patricia",
        middle_name: "Lopez",
        last_name: "Santos",
        suffix: "",
        is_family_head: false,
        sex: "FEMALE",
        age_value: 34,
        age_unit: "YEARS",
        relationship_to_head: "Daughter",
        sectors: [sectors[2]],
      },
    ],
  },
];

const householdDetails = {
  household: {
    id: "hh-001",
    household_id: "hh-001",
    family_head_first_name: "Maria",
    family_head_middle_name: "Consuelo",
    family_head_last_name: "Santos Longname",
    family_head_suffix: "",
    family_head_photo_url: "",
    current_address_details:
      "Zone 7, Purok Maharlika Extension, Poblacion 3, Malvar, Batangas near the long covered walkway and temporary water station",
    contact_number: "+639171234567",
    residency_status: "RESIDENT",
    current_stay_type: "EVAC_CENTER",
    barangay_name: barangay.name,
    household_size: 3,
    registered_at: "2026-08-15T08:00:00.000Z",
  },
  latest_attendance: households[0].latest_attendance,
  members: households[0].members,
  sectors: sectors.slice(0, 4),
  privacy_consent: {
    consent_status: "ACKNOWLEDGED",
    notice_version: "2026-07-30-v2",
    recorded_at: "2026-08-15T08:05:00.000Z",
    acknowledged_by_name: "Maria Consuelo Santos Longname",
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

    if (pathname.endsWith("/api/v1/barangays")) {
      await route.fulfill(jsonResponse([barangay]));
    } else if (
      pathname.endsWith("/api/v1/sectors") ||
      pathname.endsWith("/api/v1/sectors/barangay")
    ) {
      await route.fulfill(jsonResponse({ data: sectors }));
    } else if (pathname.endsWith("/api/v1/disaster-events/active")) {
      await route.fulfill(jsonResponse([event]));
    } else if (pathname.endsWith("/api/v1/disaster-events/ended")) {
      await route.fulfill(jsonResponse([]));
    } else if (pathname.endsWith("/api/v1/evacuation-centers")) {
      await route.fulfill(jsonResponse(evacCenters));
    } else if (pathname.includes("/api/v1/evacuation-centers/barangay/")) {
      await route.fulfill(jsonResponse(evacCenters));
    } else if (pathname.endsWith("/api/v1/masterlist/barangay-dashboard")) {
      await route.fulfill(
        jsonResponse({
          assigned_barangay: barangay,
          assigned_barangay_id: barangay.id,
          event_scope: "active",
          available_events: [event],
          selected_event: event,
          metrics: {
            total_evacuees_individuals: 3,
            total_families: 1,
            currently_admitted_evacuees: 3,
            total_departed_evacuees: 0,
          },
          has_data: true,
          is_dev_override: false,
        }),
      );
    } else if (pathname.endsWith("/api/v1/masterlist")) {
      await route.fulfill(jsonResponse({ disaster_event: event, data: households }));
    } else if (pathname.includes("/api/v1/households/hh-001")) {
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

const seedAuth = async (page) => {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("distync:DEVELOPMENT:selected-role", "BARANGAY");
    localStorage.setItem(
      "distync:DEVELOPMENT:auth-session",
      JSON.stringify({
        accessMode: "DEVELOPMENT",
        token: "visual-mock-token",
        user: {
          id: "visual-barangay-user",
          role: "BARANGAY",
          name: "Visual Barangay User",
          email: "visual@example.test",
          barangay_id: "brgy-poblacion",
          barangay_name: "Poblacion 3",
        },
      }),
    );
  });
};

const collect = async (page, label) =>
  page.evaluate((label) => {
    const byText = (text) =>
      [...document.querySelectorAll("button,input,select,h3,h2,p,span")].find((el) =>
        (el.innerText || el.value || "").includes(text),
      );
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        right: Math.round(rect.right),
      };
    };
    const sidebar = document.querySelector(".distync-sidebar");
    const main = document.querySelector(".distync-shell__main");
    const search = document.querySelector('input[placeholder*="Search"]');
    const status = [...document.querySelectorAll("select")].find((el) =>
      [...el.options].some((option) => option.text.includes("Active")),
    );
    const register = byText("Register Family");
    const filter = byText("Filter");
    const exportButton = byText("Export");
    const eventTitle = document.querySelector(".barangay-dashboard-event-title");

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
      sidebar: sidebar
        ? {
            collapsed: sidebar.dataset.collapsed,
            rect: rectFor(sidebar),
            position: getComputedStyle(sidebar).position,
            transform: getComputedStyle(sidebar).transform,
          }
        : null,
      main: rectFor(main),
      eventTitle: {
        rect: rectFor(eventTitle),
        text: eventTitle?.innerText || "",
        lineHeight: eventTitle ? getComputedStyle(eventTitle).lineHeight : "",
      },
      controls: {
        search: rectFor(search),
        status: rectFor(status),
        filter: rectFor(filter),
        register: rectFor(register),
        export: rectFor(exportButton),
      },
      emptyVisible: document.body.innerText.includes("No matching records found"),
      registeredFamilyVisible: document.body.innerText.includes("Registered Family"),
    };
  }, label);

const run = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  await context.addInitScript(() => {
    localStorage.setItem("distync:DEVELOPMENT:selected-role", "BARANGAY");
    localStorage.setItem(
      "distync:DEVELOPMENT:auth-session",
      JSON.stringify({
        accessMode: "DEVELOPMENT",
        token: "visual-mock-token",
        user: {
          id: "visual-barangay-user",
          role: "BARANGAY",
          name: "Visual Barangay User",
          email: "visual@example.test",
          barangay_id: "brgy-poblacion",
          barangay_name: "Poblacion 3",
        },
      }),
    );
  });
  const page = await context.newPage();
  await setupMocks(page);
  await seedAuth(page);

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
  ];
  const results = [];

  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}/barangay/masterlist`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    results.push(await collect(page, `${width}x${height}`));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/barangay/masterlist`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const navBefore = await collect(page, "390x844 nav closed");
  await page.screenshot({
    path: path.join(outputDir, "390-masterlist-nav-closed.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: /open navigation menu/i }).click();
  await page.waitForTimeout(300);
  const navOpen = await collect(page, "390x844 nav open");
  await page.screenshot({
    path: path.join(outputDir, "390-masterlist-nav-open.png"),
    fullPage: false,
  });
  await page.mouse.click(382, 120);
  await page.waitForTimeout(300);
  const navAfter = await collect(page, "390x844 nav closed again");

  await page.getByRole("button", { name: /Register Family/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outputDir, "390-privacy-notice.png"),
    fullPage: false,
  });
  const privacy = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")]
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.innerText,
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          right: Math.round(rect.right),
          whiteSpace: getComputedStyle(button).whiteSpace,
        };
      })
      .filter((button) => /Cancel|Confirm Acknowledg/.test(button.text));
    const dialog = document.querySelector('[role="dialog"]');
    const rect = dialog?.getBoundingClientRect();
    return {
      viewport: { w: innerWidth, h: innerHeight },
      bodyOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      dialog: rect
        ? {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
          }
        : null,
      buttons,
    };
  });

  await page.getByLabel(/I have read/i).check();
  await page
    .getByRole("button", { name: /Confirm Acknowledgment and Continue/i })
    .click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outputDir, "390-registration-form.png"),
    fullPage: false,
  });
  const registration = await page.evaluate(() => ({
    viewport: { w: innerWidth, h: innerHeight },
    overflowX:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
    hasFamilyHead: document.body.innerText.includes("Family Head"),
    hasPhoto:
      document.body.innerText.includes("Family Head Photo") ||
      document.body.innerText.toLowerCase().includes("photo"),
    hasMembers:
      document.body.innerText.includes("Household Members") ||
      document.body.innerText.includes("Members"),
    addMemberButton: [...document.querySelectorAll("button")].some((button) =>
      /Add Member/i.test(button.innerText),
    ),
    firstInputs: [...document.querySelectorAll("input,select,textarea")]
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          x: Math.round(rect.x),
          w: Math.round(rect.width),
          right: Math.round(rect.right),
        };
      }),
  }));

  let details;
  try {
    await page.goto(`${baseUrl}/barangay/masterlist`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.locator('[data-masterlist-action-button="true"]').first().click({ force: true });
    await page.waitForTimeout(300);
    await page
      .locator('[data-masterlist-action-menu="true"] button[aria-label="View Details"]')
      .click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outputDir, "390-household-details.png"),
      fullPage: false,
    });
    details = await page.evaluate(() => ({
      viewport: { w: innerWidth, h: innerHeight },
      overflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      hasDialog: Boolean(document.querySelector(".masterlist-detail-modal")),
      hasMembers: document.body.innerText.includes("Family Members"),
      hasPrivacyAck: document.body.innerText.includes("Data Privacy Acknowledgement"),
      blocked: false,
    }));
  } catch (error) {
    details = {
      blocked: true,
      reason: error.message,
    };
  }

  await browser.close();
  const report = { results, navBefore, navOpen, navAfter, privacy, registration, details };
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

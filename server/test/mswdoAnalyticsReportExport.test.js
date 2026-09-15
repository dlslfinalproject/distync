const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildMswdoAnalyticsPdfBuffer,
  buildMswdoAnalyticsPdfFilename,
} = require("../src/utils/mswdoAnalyticsReportExport");

const dashboard = {
  summary_metrics: {
    total_number_of_evacuees_individuals: 97,
    total_number_of_families: 62,
    average_household_size: 1.6,
    currently_admitted_evacuees: 18,
    total_departed_evacuees: 77,
    total_barangays_covered: 15,
  },
  charts: {
    per_barangay: [
      {
        barangay_name: "Bagong Pook",
        evacuees_count: 14,
        families_count: 11,
        admitted_evacuees_count: 10,
        departed_evacuees_count: 4,
      },
    ],
    sex_distribution: [{ name: "Female", value: 53 }],
    sector_distribution: [{ name: "Senior Citizen", value: 6 }],
    stay_type_distribution: [{ name: "Evacuation Center", value: 97 }],
    evacuation_center_distribution: [
      { name: "Santiago Evacuation Center", value: 68 },
    ],
  },
};

test("MSWDO analytics report exports directly as a PDF", () => {
  const pdfBuffer = buildMswdoAnalyticsPdfBuffer({
    dashboard,
    eventLabel: "Habagat Flood Response 2026",
    eventCode: "DE-2026-0001",
    barangayLabel: "All barangays",
  });
  const pdfSource = pdfBuffer.toString("latin1");

  assert.match(pdfSource, /^%PDF-1\.4/);
  assert.match(pdfSource, /Evacuee Analytics Report/);
  assert.match(pdfSource, /TOTAL AFFECTED INDIVIDUALS/);
  assert.match(pdfSource, /Bagong Pook/);
  assert.match(pdfSource, /Santiago Evacuation Center/);
  assert.match(pdfSource, /Page 1 of/);
});

test("MSWDO analytics report filenames stay PDF-only and filter-specific", () => {
  const filename = buildMswdoAnalyticsPdfFilename({
    eventCode: "DE-2026-0001",
    eventTitle: "Habagat Flood Response 2026",
    barangayName: "All barangays",
  });

  assert.match(
    filename,
    /^mswdo-evacuee-analytics-de-2026-0001-all-barangays-\d{8}\.pdf$/,
  );
});

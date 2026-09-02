const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", "src", ...relativePath), "utf8");

const formatDisplayStubNumber = (row) => {
  const sequenceNo = Number(row?.stub_sequence_no || 0);
  return sequenceNo > 0 ? `STUB#${sequenceNo}` : row?.stub_no || "--";
};

const oldDetailSearchMatches = (row, searchTerm) => {
  const normalizedSearchTerm = String(searchTerm || "").trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  return [
    row.family_head_name,
    row.barangay_name,
    row.sectors_text,
    row.stub_no,
    formatDisplayStubNumber(row),
    row.serial_no,
    row.disaster_event_title,
    row.event_code,
    row.relief_pack_template_name,
    row.released_items_summary,
    row.verified_by_name,
  ].some((value) =>
    String(value || "").toLowerCase().includes(normalizedSearchTerm),
  );
};

const getRowTime = (row) => {
  const parsedTime = new Date(row?.distribution_date || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const buildOldCompleteSummaryRows = ({
  rows,
  disasterEvents,
  selectedBarangayId = "",
}) => {
  const summaryByEventId = new Map();

  disasterEvents.forEach((event) => {
    const affectedBarangays = Array.isArray(event?.affected_barangays)
      ? event.affected_barangays
      : [];
    const affectedBarangayIds = affectedBarangays
      .map((barangay) => barangay?.id || barangay?.barangay_id || "")
      .filter(Boolean);

    if (
      selectedBarangayId &&
      affectedBarangayIds.length > 0 &&
      !affectedBarangayIds.includes(selectedBarangayId)
    ) {
      return;
    }

    const barangayNames = selectedBarangayId
      ? affectedBarangays
          .filter(
            (barangay) =>
              (barangay?.id || barangay?.barangay_id || "") === selectedBarangayId,
          )
          .map((barangay) => barangay?.name)
          .filter(Boolean)
      : affectedBarangays.map((barangay) => barangay?.name).filter(Boolean);

    summaryByEventId.set(event.id, {
      id: event.id,
      event_code: event.event_code || "",
      disaster_event_title: event.title || "--",
      disaster_event_status: event.status || "",
      start_date: event.start_date || null,
      barangayNames: new Set(barangayNames),
      reliefPacks: new Set(),
      issuedStubsCount: 0,
      claimedStubsCount: 0,
      unclaimedStubsCount: 0,
      latest_distribution_date: null,
    });
  });

  rows.forEach((row) => {
    const eventId = row.disaster_event_id || "unknown-event";
    const existingSummary = summaryByEventId.get(eventId) || {
      id: eventId,
      event_code: row.event_code || "",
      disaster_event_title: row.disaster_event_title || "--",
      disaster_event_status: row.disaster_event_status || "",
      start_date: row.start_date || null,
      barangayNames: new Set(),
      reliefPacks: new Set(),
      issuedStubsCount: Number(row.issued_stubs_count || 0),
      claimedStubsCount: Number(row.claimed_stubs_count || 0),
      unclaimedStubsCount: Number(row.unclaimed_stubs_count || 0),
      latest_distribution_date: null,
    };

    if (row.barangay_name) {
      existingSummary.barangayNames.add(row.barangay_name);
    }

    const reliefPack = row.relief_pack_template_name || row.released_items_summary;

    if (reliefPack) {
      existingSummary.reliefPacks.add(reliefPack);
    }

    existingSummary.issuedStubsCount = Number(
      row.issued_stubs_count || existingSummary.issuedStubsCount || 0,
    );
    existingSummary.claimedStubsCount = Number(
      row.claimed_stubs_count || existingSummary.claimedStubsCount || 0,
    );
    existingSummary.unclaimedStubsCount = Number(
      row.unclaimed_stubs_count || existingSummary.unclaimedStubsCount || 0,
    );

    if (getRowTime(row) > getRowTime({
      distribution_date: existingSummary.latest_distribution_date,
    })) {
      existingSummary.latest_distribution_date = row.distribution_date;
    }

    summaryByEventId.set(eventId, existingSummary);
  });

  return Array.from(summaryByEventId.values()).map((summary) => ({
    id: summary.id,
    event_code: summary.event_code,
    disaster_event_title: summary.disaster_event_title,
    disaster_event_status: summary.disaster_event_status,
    start_date: summary.start_date,
    barangay_summary: Array.from(summary.barangayNames).sort().join(", ") || "--",
    barangay_count: summary.barangayNames.size,
    issued_stubs_count: summary.issuedStubsCount,
    claimed_stubs_count: summary.claimedStubsCount,
    unclaimed_stubs_count: summary.unclaimedStubsCount,
    relief_pack_summary: Array.from(summary.reliefPacks).sort().join(", ") || "--",
    latest_distribution_date: summary.latest_distribution_date,
  }));
};

test("distribution history validator accepts page/pageSize/search/mode and caps pageSize at 100", async () => {
  const source = await readSource([
    "validators",
    "distributionTransaction.validator.js",
  ]);

  assert.match(source, /page,/);
  assert.match(source, /pageSize,/);
  assert.match(source, /search,/);
  assert.match(source, /mode,/);
  assert.match(source, /pageSize must be an integer between 1 and 100/);
  assert.match(source, /isPaginated: hasPage \|\| hasPageSize/);
});

test("distribution history repository applies search before count and LIMIT/OFFSET", async () => {
  const source = await readSource([
    "repositories",
    "distributionTransaction.repository.js",
  ]);

  assert.match(source, /const buildDistributionHistoryFilters =/);
  assert.match(source, /countDistributionHistory = async/);
  assert.match(source, /COUNT\(DISTINCT dt\.id\)::int AS total_items/);
  assert.match(source, /LIMIT \$\{limitParam\} OFFSET/);
  assert.match(source, /CONCAT_WS\([\s\S]*?family_head_first_name/);
  assert.match(source, /household_sectors hs_search/);
  assert.match(source, /evacuee_sectors es_search/);
  assert.match(source, /CONCAT_WS\(' ', u\.first_name, u\.middle_name, u\.last_name\) ILIKE/);
  assert.match(source, /CONCAT\(\s*'STUB#'[\s\S]*?sequence_stubs\.id <= s\.id/);
});

test("distribution history detail search fields match release client predicate", async () => {
  const repositorySource = await readSource([
    "repositories",
    "distributionTransaction.repository.js",
  ]);
  const row = {
    id: "row-a",
    family_head_name: "ALPHA_HEAD",
    barangay_name: "BARANGAY_ONLY_A",
    sectors_text: "SECTOR_ONLY_A",
    stub_no: "STUB_ONLY_A",
    stub_sequence_no: 7,
    serial_no: "SERIAL_ONLY_A",
    disaster_event_title: "EVENT_ONLY_A",
    event_code: "EVENT_CODE_ONLY_A",
    relief_pack_template_name: "PACK_ONLY_A",
    released_items_summary: "ITEM_ONLY_A x2",
    verified_by_name: "VERIFIED_ONLY_A",
  };

  const searchableTokens = [
    ["ALPHA_HEAD", /family_head_first_name/],
    ["BARANGAY_ONLY_A", /b\.name ILIKE/],
    ["SECTOR_ONLY_A", /household_sector_search\.name ILIKE/],
    ["STUB_ONLY_A", /s\.stub_no ILIKE/],
    ["STUB#7", /CONCAT\(\s*'STUB#'/],
    ["SERIAL_ONLY_A", /s\.serial_no ILIKE/],
    ["EVENT_ONLY_A", /de\.title ILIKE/],
    ["EVENT_CODE_ONLY_A", /de\.event_code ILIKE/],
    ["PACK_ONLY_A", /dtrpt_search\.name_snapshot ILIKE/],
    ["ITEM_ONLY_A", /dti_search\.item_name_snapshot ILIKE/],
    ["VERIFIED_ONLY_A", /u\.first_name/],
  ];

  searchableTokens.forEach(([token, repositoryPattern]) => {
    assert.equal(oldDetailSearchMatches(row, token), true, token);
    assert.match(repositorySource, repositoryPattern, token);
  });

  ["missing-token", "alpha   head"].forEach((token) => {
    assert.equal(oldDetailSearchMatches(row, token), false, token);
  });
  assert.equal(oldDetailSearchMatches(row, "alpha_head"), true);
  assert.equal(oldDetailSearchMatches(row, " item_only_a "), true);
});

test("distribution history summary search stays raw-row based before aggregation", async () => {
  const repositorySource = await readSource([
    "repositories",
    "distributionTransaction.repository.js",
  ]);
  const summarySearchBody = repositorySource.match(
    /const buildSummarySearchClause =[\s\S]*?const buildDistributionHistorySummaryQuery =/,
  )?.[0];

  assert.ok(summarySearchBody);
  assert.doesNotMatch(summarySearchBody, /de\.title ILIKE/);
  assert.doesNotMatch(summarySearchBody, /de\.event_code ILIKE/);
  assert.match(summarySearchBody, /EXISTS \(\s*SELECT 1\s*FROM distribution_transactions dt_search/);
  assert.match(summarySearchBody, /b_search\.name ILIKE/);
  assert.match(summarySearchBody, /s_search\.serial_no ILIKE/);
  assert.match(summarySearchBody, /u_search\.first_name/);
  assert.match(summarySearchBody, /CONCAT\(\s*'STUB#'[\s\S]*?s_search\.id/);
});

test("old complete-data summary fixture verifies every user-visible value", () => {
  const disasterEvents = [
    {
      id: "event-alpha",
      event_code: "EVT-A",
      title: "Alpha Flood",
      status: "ACTIVE",
      start_date: "2026-08-01T00:00:00.000Z",
      affected_barangays: [
        { id: "barangay-a", name: "San Pedro" },
        { id: "barangay-b", name: "Poblacion" },
      ],
    },
    {
      id: "event-beta",
      event_code: "EVT-B",
      title: "Beta Quake",
      status: "CLOSED",
      start_date: "2026-08-02T00:00:00.000Z",
      affected_barangays: [{ id: "barangay-b", name: "Poblacion" }],
    },
    {
      id: "event-zero",
      event_code: "EVT-Z",
      title: "Zero Wind",
      status: "ACTIVE",
      start_date: "2026-08-03T00:00:00.000Z",
      affected_barangays: [{ id: "barangay-a", name: "San Pedro" }],
    },
  ];
  const rows = [
    {
      id: "row-alpha-1",
      disaster_event_id: "event-alpha",
      event_code: "EVT-A",
      disaster_event_title: "Alpha Flood",
      disaster_event_status: "ACTIVE",
      start_date: "2026-08-01T00:00:00.000Z",
      barangay_name: "San Pedro",
      relief_pack_template_name: "Family Pack",
      released_items_summary: "Rice x1",
      issued_stubs_count: 3,
      claimed_stubs_count: 2,
      unclaimed_stubs_count: 1,
      distribution_date: "2026-08-10T08:00:00.000Z",
      family_head_name: "Maria Santos",
      sectors_text: "Senior Citizen",
      stub_no: "STUB-A-1",
    },
    {
      id: "row-alpha-2",
      disaster_event_id: "event-alpha",
      event_code: "EVT-A",
      disaster_event_title: "Alpha Flood",
      disaster_event_status: "ACTIVE",
      start_date: "2026-08-01T00:00:00.000Z",
      barangay_name: "Poblacion",
      relief_pack_template_name: "",
      released_items_summary: "Water x4",
      issued_stubs_count: 3,
      claimed_stubs_count: 2,
      unclaimed_stubs_count: 1,
      distribution_date: "2026-08-11T09:30:00.000Z",
      family_head_name: "Jose Cruz",
      sectors_text: "PWD",
      stub_no: "STUB-A-2",
    },
    {
      id: "row-beta-1",
      disaster_event_id: "event-beta",
      event_code: "EVT-B",
      disaster_event_title: "Beta Quake",
      disaster_event_status: "CLOSED",
      start_date: "2026-08-02T00:00:00.000Z",
      barangay_name: "Poblacion",
      relief_pack_template_name: "Hygiene Kit",
      released_items_summary: "Soap x3",
      issued_stubs_count: 1,
      claimed_stubs_count: 1,
      unclaimed_stubs_count: 0,
      distribution_date: "2026-08-09T07:15:00.000Z",
      family_head_name: "Lina Ramos",
      sectors_text: "Solo Parent",
      stub_no: "STUB-B-1",
    },
  ];

  const summaryRows = buildOldCompleteSummaryRows({ rows, disasterEvents });

  assert.deepEqual(
    summaryRows.map((row) => ({
      event: row.disaster_event_title,
      status: row.disaster_event_status,
      barangays: row.barangay_summary,
      barangayCount: row.barangay_count,
      issued: row.issued_stubs_count,
      claimed: row.claimed_stubs_count,
      unclaimed: row.unclaimed_stubs_count,
      reliefPack: row.relief_pack_summary,
      latestClaim: row.latest_distribution_date,
    })),
    [
      {
        event: "Alpha Flood",
        status: "ACTIVE",
        barangays: "Poblacion, San Pedro",
        barangayCount: 2,
        issued: 3,
        claimed: 2,
        unclaimed: 1,
        reliefPack: "Family Pack, Water x4",
        latestClaim: "2026-08-11T09:30:00.000Z",
      },
      {
        event: "Beta Quake",
        status: "CLOSED",
        barangays: "Poblacion",
        barangayCount: 1,
        issued: 1,
        claimed: 1,
        unclaimed: 0,
        reliefPack: "Hygiene Kit",
        latestClaim: "2026-08-09T07:15:00.000Z",
      },
      {
        event: "Zero Wind",
        status: "ACTIVE",
        barangays: "San Pedro",
        barangayCount: 1,
        issued: 0,
        claimed: 0,
        unclaimed: 0,
        reliefPack: "--",
        latestClaim: null,
      },
    ],
  );

  const searchedRows = rows.filter((row) => oldDetailSearchMatches(row, "PWD"));
  const searchedSummaryRows = buildOldCompleteSummaryRows({
    rows: searchedRows,
    disasterEvents,
  });
  const alphaSummary = searchedSummaryRows.find((row) => row.id === "event-alpha");

  assert.equal(alphaSummary.barangay_summary, "Poblacion, San Pedro");
  assert.equal(alphaSummary.relief_pack_summary, "Water x4");
  assert.equal(alphaSummary.latest_distribution_date, "2026-08-11T09:30:00.000Z");
  assert.equal(searchedSummaryRows.find((row) => row.id === "event-zero").relief_pack_summary, "--");

  const eventTitleOnlyRows = rows.filter((row) =>
    oldDetailSearchMatches(row, "Zero Wind"),
  );
  assert.deepEqual(eventTitleOnlyRows, []);
});

test("distribution history repository uses deterministic tie-breakers for every sort", async () => {
  const source = await readSource([
    "repositories",
    "distributionTransaction.repository.js",
  ]);

  assert.match(source, /distribution_date DESC, created_at DESC, id DESC/);
  assert.match(source, /distribution_date ASC, created_at ASC, id ASC/);
  assert.match(source, /family_head_name ASC[\s\S]*id DESC/);
  assert.match(source, /family_head_name DESC[\s\S]*id DESC/);
  assert.match(source, /disaster_event_id DESC/);
  assert.match(source, /disaster_event_id ASC/);
});

test("distribution history service returns pagination metadata and keeps legacy array compatibility", async () => {
  const source = await readSource(["services", "distributionTransaction.service.js"]);

  assert.match(source, /const buildPaginationMetadata =/);
  assert.match(source, /filters\.mode === "summary"/);
  assert.match(source, /countDistributionHistorySummaryRows/);
  assert.match(source, /countDistributionHistory\(commonFilters\)/);
  assert.match(source, /if \(isPaginated\) \{\s*return \{\s*data:/);
  assert.match(source, /return rowsWithStubCounts;/);
});

test("distribution history export is uncapped and ignores current page parameters", async () => {
  const [repositorySource, serviceSource] = await Promise.all([
    readSource(["repositories", "distributionTransaction.repository.js"]),
    readSource(["services", "distributionTransaction.service.js"]),
  ]);

  assert.match(repositorySource, /const getDistributionHistoryExportRows = async/);
  assert.match(repositorySource, /limit: null/);
  assert.doesNotMatch(serviceSource, /limit:\s*1000/);
  assert.match(serviceSource, /getDistributionHistoryExportRows/);
  assert.match(serviceSource, /search: filters\.search \|\| ""/);
});

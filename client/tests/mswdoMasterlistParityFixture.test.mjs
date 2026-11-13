import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const REPO_ROOT = new URL("..", import.meta.url);
const SERVER_REPOSITORY_PATH = new URL(
  "../server/src/repositories/masterlist.repository.js",
  REPO_ROOT,
);

const sectorLabels = {
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRE_SCHOOLER: "Pre-schooler",
  SCHOOL_AGE: "School Age",
  TEENAGE: "Teenage",
  ADULT: "Adult",
  SENIOR_CITIZEN: "Senior Citizen",
  PREGNANT: "Pregnant",
  LACTATING_MOTHER: "Lactating Mother",
  PWD: "Persons with Disabilities",
  INDIGENOUS: "Indigenous",
  FOUR_PS: "4Ps Beneficiaries",
  CHILD_HEADED: "Child-Headed Family",
  SINGLE_HEADED: "Single-Headed Family",
  SOLO_PARENT: "Solo Parents",
};

const sectorAliases = {
  LACTATING: "LACTATING_MOTHER",
  INFANT_0_6_MONTHS: "INFANT",
  TODDLER_7M_2Y: "TODDLER",
  PRESCHOOL_3_5: "PRE_SCHOOLER",
  CHILD_6_12: "SCHOOL_AGE",
  TEEN_13_17: "TEENAGE",
  ADULT_18_59: "ADULT",
  SENIOR_60_ABOVE: "SENIOR_CITIZEN",
};

const sectorOrder = [
  "INFANT",
  "TODDLER",
  "PRE_SCHOOLER",
  "SCHOOL_AGE",
  "TEENAGE",
  "ADULT",
  "SENIOR_CITIZEN",
  "PREGNANT",
  "LACTATING_MOTHER",
  "PWD",
  "INDIGENOUS",
  "FOUR_PS",
  "CHILD_HEADED",
  "SINGLE_HEADED",
  "SOLO_PARENT",
];

const canonicalSectorCode = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  return sectorAliases[normalized] || normalized;
};

const operationallyActive = (row) => {
  const attendanceStatus = String(row.attendance?.status || "").toUpperCase();

  return (
    row.isActive !== false &&
    !row.attendance?.timeOut &&
    attendanceStatus !== "LEFT"
  );
};

const getSectorCodes = (row, recordStatus) => {
  const codes = [
    ...(row.householdSectorCodes || []),
    ...(row.members || [])
      .filter(
        (member) =>
          recordStatus !== "active" || member.isActive === true,
      )
      .flatMap((member) => member.sectorCodes || []),
  ]
    .map(canonicalSectorCode)
    .filter(Boolean);

  return [...new Set(codes)];
};

const getSectorText = (row, recordStatus) => {
  const codes = getSectorCodes(row, recordStatus);

  return codes
    .sort(
      (left, right) =>
        (sectorOrder.indexOf(left) === -1 ? 1000 : sectorOrder.indexOf(left)) -
        (sectorOrder.indexOf(right) === -1 ? 1000 : sectorOrder.indexOf(right)),
    )
    .map((code) => sectorLabels[code] || code)
    .join(", ") || "-";
};

const getDisplayFields = (row, recordStatus) => ({
  familyHeadName: row.familyHeadName || "-",
  address: row.address || row.barangayName || "-",
  sectorText: getSectorText(row, recordStatus),
  arrivalText: row.arrivalText || "-",
  departureText: row.departureText || "-",
  barangayName: row.barangayName || "",
});

const statusMatches = (row, recordStatus) => {
  if (recordStatus === "all") {
    return true;
  }

  const active = operationallyActive(row);
  return recordStatus === "archived" ? !active : active;
};

const sortRows = (rows, sortOrder) => {
  const getTime = (row) => new Date(row.registeredAt || 0).getTime();

  return [...rows].sort((left, right) => {
    const leftTime = getTime(left);
    const rightTime = getTime(right);
    const leftName = String(left.familyHeadName || "").trim().toUpperCase();
    const rightName = String(right.familyHeadName || "").trim().toUpperCase();

    if (sortOrder === "oldest" || sortOrder === "newest") {
      if (leftTime !== rightTime) {
        return sortOrder === "oldest"
          ? leftTime - rightTime
          : rightTime - leftTime;
      }
    }

    if (leftName !== rightName) {
      return sortOrder === "za"
        ? rightName.localeCompare(leftName)
        : leftName.localeCompare(rightName);
    }

    return rightTime - leftTime;
  });
};

const applyClientOracle = ({
  rows,
  recordStatus,
  search = "",
  sectorCodes = [],
  sortOrder = "newest",
}) => {
  const normalizedSearch = search.trim().toLowerCase();
  const selectedCodes = sectorCodes.map(canonicalSectorCode);

  return sortRows(
    rows.filter((row) => {
      if (!statusMatches(row, recordStatus)) {
        return false;
      }

      const displayFields = getDisplayFields(row, recordStatus);
      const rowSectorCodes = getSectorCodes(row, recordStatus);

      if (
        selectedCodes.length > 0 &&
        !selectedCodes.some((code) => rowSectorCodes.includes(code))
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        displayFields.familyHeadName,
        displayFields.address,
        displayFields.sectorText,
        displayFields.arrivalText,
        displayFields.departureText,
        displayFields.barangayName,
      ].some((value) =>
        String(value || "").toLowerCase().includes(normalizedSearch),
      );
    }),
    sortOrder,
  );
};

const applyServerSemanticOracle = ({
  rows,
  recordStatus,
  search = "",
  sectorCodes = [],
  sortOrder = "newest",
}) => {
  const normalizedSearch = search.trim().toLowerCase();
  const selectedCodes = sectorCodes.map(canonicalSectorCode);

  return sortRows(
    rows.filter((row) => {
      const active =
        row.isActive !== false &&
        row.attendance?.timeOut == null &&
        String(row.attendance?.status || "").toUpperCase() !== "LEFT";

      if (
        (recordStatus === "active" && !active) ||
        (recordStatus === "archived" && active)
      ) {
        return false;
      }

      const displayFields = getDisplayFields(row, recordStatus);
      const rowSectorCodes = getSectorCodes(row, recordStatus);

      if (
        selectedCodes.length > 0 &&
        !rowSectorCodes.some((code) => selectedCodes.includes(code))
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        displayFields.familyHeadName,
        displayFields.address,
        displayFields.sectorText,
        displayFields.arrivalText,
        displayFields.departureText,
        displayFields.barangayName,
      ].some((value) =>
        String(value || "").toLowerCase().includes(normalizedSearch),
      );
    }),
    sortOrder,
  );
};

const fixtureRows = [
  {
    id: "active-present",
    isActive: true,
    familyHeadName: "Alpha Head",
    address: "12 Main Street",
    barangayName: "Barangay Uno",
    householdSectorCodes: ["PWD"],
    members: [
      { isActive: true, sectorCodes: ["ADULT_18_59"] },
      { isActive: false, sectorCodes: ["SENIOR_60_ABOVE"] },
    ],
    attendance: {
      status: "PRESENT",
      timeIn: "2026-01-10T08:00:00.000Z",
      timeOut: null,
    },
    registeredAt: "2026-01-10T08:00:00.000Z",
    arrivalText: "Jan 10, 2026, 4:00 PM",
    departureText: "-",
  },
  {
    id: "active-no-attendance",
    isActive: true,
    familyHeadName: "No Attendance",
    address: null,
    barangayName: "Barangay Uno",
    householdSectorCodes: [],
    members: [],
    attendance: null,
    registeredAt: "2026-01-08T08:00:00.000Z",
    arrivalText: "-",
    departureText: "-",
  },
  {
    id: "active-unknown",
    isActive: true,
    familyHeadName: "Unknown Status",
    address: "Unknown Road",
    barangayName: "Barangay Two",
    householdSectorCodes: ["LACTATING"],
    members: [],
    attendance: { status: null, timeIn: null, timeOut: null },
    registeredAt: "2026-01-07T08:00:00.000Z",
    arrivalText: "-",
    departureText: "-",
  },
  {
    id: "left",
    isActive: true,
    familyHeadName: "Left Family",
    address: "Left Road",
    barangayName: "Barangay Uno",
    householdSectorCodes: [],
    members: [],
    attendance: {
      status: "LEFT",
      timeIn: "2026-01-06T08:00:00.000Z",
      timeOut: null,
    },
    registeredAt: "2026-01-06T08:00:00.000Z",
    arrivalText: "Jan 6, 2026, 4:00 PM",
    departureText: "-",
  },
  {
    id: "timed-out",
    isActive: true,
    familyHeadName: "Timed Out",
    address: "Exit Road",
    barangayName: "Barangay Uno",
    householdSectorCodes: [],
    members: [],
    attendance: {
      status: "PRESENT",
      timeIn: "2026-01-05T08:00:00.000Z",
      timeOut: "2026-01-05T12:00:00.000Z",
    },
    registeredAt: "2026-01-05T08:00:00.000Z",
    arrivalText: "Jan 5, 2026, 4:00 PM",
    departureText: "Jan 5, 2026, 8:00 PM",
  },
  {
    id: "inactive-relatives",
    isActive: false,
    familyHeadName: "Archived Relatives",
    address: "Old Road",
    barangayName: "Barangay Uno",
    householdSectorCodes: ["CHILD_HEADED"],
    members: [],
    attendance: null,
    registeredAt: "2026-01-04T08:00:00.000Z",
    arrivalText: "Staying with Relatives",
    departureText: "None",
  },
  {
    id: "inactive-member-sector",
    isActive: true,
    familyHeadName: "Inactive Sector",
    address: "Sector Road",
    barangayName: "Barangay Two",
    householdSectorCodes: [],
    members: [{ isActive: false, sectorCodes: ["PWD"] }],
    attendance: null,
    registeredAt: "2026-01-03T08:00:00.000Z",
    arrivalText: "-",
    departureText: "-",
  },
  {
    id: "null-time",
    isActive: true,
    familyHeadName: "Null Time",
    address: null,
    barangayName: "Barangay Two",
    householdSectorCodes: [],
    members: [],
    attendance: null,
    registeredAt: null,
    arrivalText: "-",
    departureText: "-",
  },
];

const ids = (rows) => rows.map((row) => row.id);

test("MSWDO parity fixture preserves active, archived, all, and successor-safe row universes", () => {
  const expected = {
    active: [
      "active-present",
      "active-no-attendance",
      "active-unknown",
      "inactive-member-sector",
      "null-time",
    ],
    archived: ["left", "timed-out", "inactive-relatives"],
    all: [
      "active-present",
      "active-no-attendance",
      "active-unknown",
      "left",
      "timed-out",
      "inactive-relatives",
      "inactive-member-sector",
      "null-time",
    ],
  };

  for (const recordStatus of ["active", "archived", "all"]) {
    assert.deepEqual(
      ids(
        applyClientOracle({
          rows: fixtureRows,
          recordStatus,
          sortOrder: "newest",
        }),
      ),
      expected[recordStatus],
    );
    assert.deepEqual(
      ids(
        applyServerSemanticOracle({
          rows: fixtureRows,
          recordStatus,
          sortOrder: "newest",
        }),
      ),
      expected[recordStatus],
    );
  }
});

test("MSWDO parity fixture preserves search fields, trimming, case-insensitivity, and sector OR semantics", () => {
  const searches = [
    ["  ALPHA HEAD  ", ["active-present"]],
    ["main street", ["active-present"]],
    ["PERSONS WITH DISABILITIES", ["active-present", "inactive-member-sector"]],
    ["staying with relatives", ["inactive-relatives"]],
    ["BARANGAY TWO", ["active-unknown", "inactive-member-sector", "null-time"]],
    ["no such household", []],
  ];

  for (const [search, expected] of searches) {
    const input = {
      rows: fixtureRows,
      recordStatus: "all",
      search,
      sortOrder: "newest",
    };
    assert.deepEqual(ids(applyClientOracle(input)), expected, search);
    assert.deepEqual(ids(applyServerSemanticOracle(input)), expected, search);
  }

  const sectorInput = {
    rows: fixtureRows,
    recordStatus: "active",
    sectorCodes: ["PWD", "LACTATING_MOTHER"],
    sortOrder: "newest",
  };
  assert.deepEqual(ids(applyClientOracle(sectorInput)), [
    "active-present",
    "active-unknown",
  ]);
  assert.deepEqual(ids(applyServerSemanticOracle(sectorInput)), [
    "active-present",
    "active-unknown",
  ]);

  const archivedSectorInput = {
    ...sectorInput,
    recordStatus: "all",
    sectorCodes: ["PWD"],
  };
  assert.deepEqual(ids(applyClientOracle(archivedSectorInput)), [
    "active-present",
    "inactive-member-sector",
  ]);
  assert.deepEqual(ids(applyServerSemanticOracle(archivedSectorInput)), [
    "active-present",
    "inactive-member-sector",
  ]);
});

test("MSWDO parity fixture preserves registration-time sorting and deterministic tie behavior", () => {
  const rows = [
    {
      id: "tie-a",
      familyHeadName: "Same Name",
      registeredAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "tie-b",
      familyHeadName: "same name",
      registeredAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "newest",
      familyHeadName: "Zed",
      registeredAt: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "oldest",
      familyHeadName: "Amy",
      registeredAt: "2025-12-01T00:00:00.000Z",
    },
    {
      id: "null-time",
      familyHeadName: "Null",
      registeredAt: null,
    },
  ];

  for (const sortOrder of ["newest", "oldest", "az", "za"]) {
    const input = {
      rows,
      recordStatus: "all",
      sortOrder,
    };
    assert.deepEqual(
      ids(applyClientOracle(input)),
      ids(applyServerSemanticOracle(input)),
      sortOrder,
    );
  }

  assert.deepEqual(
    ids(
      applyServerSemanticOracle({
        rows,
        recordStatus: "all",
        sortOrder: "newest",
      }),
    ),
    ["newest", "tie-a", "tie-b", "oldest", "null-time"],
  );
  assert.deepEqual(
    ids(
      applyServerSemanticOracle({
        rows,
        recordStatus: "all",
        sortOrder: "az",
      }),
    ),
    ["oldest", "null-time", "tie-a", "tie-b", "newest"],
  );
});

test("MSWDO server query contains the parity fixture dimensions before LIMIT/OFFSET", async () => {
  const source = await readFile(SERVER_REPOSITORY_PATH, "utf8");

  for (const marker of [
    "records.is_active IS NOT FALSE",
    "records.attendance_time_out IS NULL",
    "records.client_family_head_name",
    "records.client_address",
    "records.client_sector_text",
    "records.client_arrival_time_text",
    "records.client_departure_time_text",
    "records.barangay_name",
    "records.sector_codes &&",
    "client_sort_timestamp",
    "total_count AS",
    "paged_records AS",
    "LIMIT $",
    "OFFSET $",
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  assert.ok(
    source.indexOf("FROM filtered_records") <
      source.indexOf("paged_records AS"),
  );
});

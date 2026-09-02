import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const pageSourcePath = new URL("../src/pages/SyncManagementPage.jsx", import.meta.url);
const helperSourcePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);
const serviceSourcePath = new URL(
  "../src/features/sync/syncHistoryService.js",
  import.meta.url,
);
const syncHealthComponentSourcePath = new URL(
  "../src/components/shared/SyncHealthStatus.jsx",
  import.meta.url,
);
const conflictModalSourcePath = new URL(
  "../src/components/shared/SyncConflictDetailModal.jsx",
  import.meta.url,
);
const syncStatusSourcePath = new URL(
  "../src/offline/syncStatus.js",
  import.meta.url,
);
const masterlistServiceSourcePath = new URL(
  "../src/features/masterlist/masterlistService.js",
  import.meta.url,
);
const barangayMasterlistPageSourcePath = new URL(
  "../src/pages/barangay/BarangayMasterlistPage.jsx",
  import.meta.url,
);
const stubServiceSourcePath = new URL(
  "../src/features/stubs/stubService.js",
  import.meta.url,
);
const barangayStubDistributionPageSourcePath = new URL(
  "../src/pages/barangay/StubDistributionPage.jsx",
  import.meta.url,
);
const helperModulePath = new URL(
  "../src/features/sync/syncManagementHelpers.js",
  import.meta.url,
);

test("BRG-SC-P01 Sync Center omits the introductory description", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.doesNotMatch(
    source,
    /Monitor offline actions from this device and confirm whether they have/,
  );
});

test("BRG-SC-P02 Sync Center renders last successful sync from status-summary", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(serviceSourcePath, "utf8");
  const componentSource = await fs.readFile(syncHealthComponentSourcePath, "utf8");

  assert.match(source, /fetchSyncStatusSummary/);
  assert.match(source, /lastSuccessfulSyncAt:\s*summaryResponse\.lastSuccessfulSyncAt/);
  assert.match(source, /<SyncHealthStatus health=\{syncHealth\} \/>/);
  assert.match(componentSource, /Last successful sync:/);
  assert.match(componentSource, /formatSyncDateTime\(presentation\.lastSuccessfulSyncAt\)/);
  assert.match(serviceSource, /return payload\?\.data \|\| \{\}/);
});

test("BRG-SC-P03 conflict details use an accessible eye icon action", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /import \{ FiEye,/);
  assert.match(source, /aria-label="View synchronization details"/);
  assert.match(source, /<FiEye size=\{18\} aria-hidden="true" focusable="false" \/>/);
  assert.doesNotMatch(source, />\s*View Details\s*</);
});

test("BRG-SC-P04 Sync Center uses final tab names without duplicate panel titles", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /\{ value: "QUEUE", label: "Offline Queue" \}/);
  assert.match(source, /\{ value: "AUDIT", label: "Sync History" \}/);
  assert.match(source, /\{ value: "CONFLICTS", label: "Conflict Review" \}/);
  assert.doesNotMatch(source, /Sync Audit Trail/);
  assert.doesNotMatch(source, /Server Sync History/);
});

test("BRG-SC-P04B permanent tab descriptions are removed while empty states remain", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.doesNotMatch(
    source,
    /Local device actions waiting to be sent or retried from this browser\./,
  );
  assert.doesNotMatch(
    source,
    /Central server records for synchronization attempts associated with your account\./,
  );
  assert.doesNotMatch(
    source,
    /Server-recorded conflicts from synchronization attempts\. Open conflicts/,
  );
  assert.match(source, /No offline actions are waiting to sync on this device\./);
  assert.match(source, /No synchronization history is available yet\./);
  assert.match(source, /No synchronization conflicts require review\./);
});

test("BRG-SC-P04C tab panels keep accessible labels without visible duplicate headings", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-label="Sync Center sections"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-selected=\{activeSyncTab === tab\.value\}/);
  assert.match(source, /aria-controls=\{SYNC_TABPANEL_IDS\[tab\.value\]\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{SYNC_TAB_IDS\.AUDIT\}/);
  assert.match(source, /<h2 style=\{srOnlyStyles\}>Sync History<\/h2>/);
  assert.doesNotMatch(source, /<h3[^>]*>Offline Queue<\/h3>/);
  assert.doesNotMatch(source, /<h3[^>]*>Conflict Review<\/h3>/);
});

test("BRG-SC-P05 transaction and conflict status filters are not mixed", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const TRANSACTION_STATUS_OPTIONS = \[[\s\S]*LOCAL_SYNC_STATUS\.CONFLICT/);
  assert.doesNotMatch(
    source.match(/const TRANSACTION_STATUS_OPTIONS = \[[\s\S]*?\];/)?.[0] || "",
    /RESOLVED/,
  );
  assert.match(source, /const CONFLICT_STATUS_OPTIONS = \[[\s\S]*\{ value: "RESOLVED", label: "Resolved" \}/);
  assert.match(source, /activeSyncTab === "CONFLICTS" \? "Conflict Status" : "Sync Status"/);
});

test("BRG-SC-P06 non-retryable queue entries do not offer a retry action", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /const canRetry = isSafeRetryableQueueEntry\(entry\)/);
  assert.match(source, /<span aria-label="No action available">—<\/span>/);
  assert.match(source, /disabled=\{!isOnline \|\| isRetrying\}/);
});

test("BRG-SC-P07 raw UUIDs are not primary record labels", async () => {
  const helperSource = await fs.readFile(helperSourcePath, "utf8");

  assert.match(helperSource, /uuidPattern\.test/);
  assert.match(helperSource, /fallbackSubject/);
  assert.doesNotMatch(helperSource, /Technical reference available in the sync record\./);
});

test("BRG-SC-P08 server history table uses affected record and processed timestamp semantics", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");

  assert.match(source, /<th style=\{tableStyles\.th\}>Affected Record<\/th>/);
  assert.match(source, /<th style=\{tableStyles\.th\}>Processed At<\/th>/);
  assert.match(source, /formatSyncHistoryDateTime\(transaction\.server_timestamp\)/);
  assert.doesNotMatch(source, /<th style=\{tableStyles\.th\}>Synced At<\/th>/);
});

test("BRG-SC-P08B Barangay Sync History has the final eight columns in order", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const historySection = source.match(
    /activeSyncTab === "AUDIT" \? \([\s\S]*?\{activeSyncTab === "CONFLICTS"/,
  )?.[0] || "";

  assert.match(
    historySection,
    /Record Type[\s\S]*Action[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Status[\s\S]*Queued At[\s\S]*Processed At[\s\S]*Notes/,
  );
  assert.doesNotMatch(historySection, /<th style=\{tableStyles\.th\}>Barangay<\/th>/);
  assert.match(historySection, /renderRecordCells\(transaction, \{ includeBarangay: false \}\)/);
  assert.match(historySection, /<table style=\{syncHistoryTableStyles\}>/);
  assert.match(source, /minWidth: "1080px"/);
});

test("BRG-SC-P08C history row data stays aligned after removing Barangay", async () => {
  const { getSyncRecordDetails } = await import(helperModulePath.href);
  const details = getSyncRecordDetails({
    sync_status: "SYNCED",
    entity_type: "HOUSEHOLD",
    operation_type: "CREATE",
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      payload: {
        family_head: { first_name: "Claudine", last_name: "Barreto" },
        disaster_event_title: "Typhoon Response Maymay",
        barangay_name: "Barangay Hidden From History",
      },
    },
  });

  assert.equal(details.subject, "Claudine Barreto");
  assert.equal(details.disasterEvent, "Typhoon Response Maymay");
  assert.equal(details.status, "SYNCED");
});

test("BRG-SC-P09 affected record suppresses duplicate family secondary values but keeps distinct stub values", async () => {
  const { getSyncRecordDetails } = await import(helperModulePath.href);
  const householdDetails = getSyncRecordDetails({
    sync_status: "SYNCED",
    entity_type: "HOUSEHOLD",
    operation_type: "CREATE",
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      entity_type: "HOUSEHOLD",
      payload: {
        family_head: { first_name: "Claudine", last_name: "Barreto" },
        barangay_name: "Barangay 1",
        disaster_event_title: "Typhoon Falcon",
      },
    },
  });
  const claimDetails = getSyncRecordDetails({
    sync_status: "SYNCED",
    entity_type: "DISTRIBUTION_TRANSACTION",
    operation_type: "CLAIM",
    payload_json: {
      action_key: "DISTRIBUTION_CREATE",
      payload: {
        claimed_by_name: "Daniel Padilla",
        stub_number: "RS-00042",
      },
    },
  });

  assert.equal(householdDetails.subject, "Claudine Barreto");
  assert.equal(householdDetails.secondaryLabel, "");
  assert.equal(claimDetails.subject, "Daniel Padilla");
  assert.equal(claimDetails.secondaryLabel, "Stub No. RS-00042");
});

test("BRG-SC-P10 server history notes omit duplicate family notes and preserve meaningful failure reasons", async () => {
  const { getSyncHistoryNotes, SYNC_MISSING_VALUE } = await import(
    helperModulePath.href
  );

  assert.deepEqual(
    getSyncHistoryNotes({
      sync_status: "SYNCED",
      payload_json: {
        action_key: "HOUSEHOLD_REGISTER",
        payload: {
          family_head: { first_name: "Claudine", last_name: "Barreto" },
          family_head_name: "Claudine Barreto",
        },
      },
    }),
    [SYNC_MISSING_VALUE],
  );
  assert.deepEqual(
    getSyncHistoryNotes({
      sync_status: "FAILED",
      error_message: "No active standard relief pack is assigned to this family.",
      payload_json: {
        action_key: "STUB_CLAIM",
        payload: {},
      },
    }),
    ["No active standard relief pack is assigned to this family."],
  );
});

test("BRG-SC-P11 action-aware fallbacks replace generic sync record labels without raw UUIDs", async () => {
  const { getSyncRecordDetails } = await import(helperModulePath.href);

  const departureDetails = getSyncRecordDetails({
    sync_status: "SYNCED",
    entity_type: "HOUSEHOLD",
    operation_type: "TIME_OUT",
    entity_server_id: "11111111-1111-4111-8111-111111111111",
    payload_json: {
      action_key: "HOUSEHOLD_DEPART",
      payload: {},
    },
  });
  const failedClaimDetails = getSyncRecordDetails({
    sync_status: "FAILED",
    entity_type: "STUB",
    operation_type: "CLAIM",
    entity_server_id: "22222222-2222-4222-8222-222222222222",
    payload_json: {
      action_key: "STUB_CLAIM",
      payload: {},
    },
  });

  assert.equal(departureDetails.subject, "Evacuee departure record");
  assert.equal(failedClaimDetails.subject, "Relief distribution claim");
  assert.doesNotMatch(departureDetails.subject, /11111111/);
  assert.doesNotMatch(failedClaimDetails.subject, /22222222/);
});

test("BRG-SC-P12 barangay and event missing values are clean and timestamps do not show double hyphen in server history", async () => {
  const {
    SYNC_MISSING_VALUE,
    formatSyncHistoryDateTime,
    getSyncRecordDetails,
  } = await import(helperModulePath.href);

  const details = getSyncRecordDetails({
    sync_status: "CONFLICT",
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      payload: {
        family_head: { first_name: "Janna", last_name: "Paray" },
      },
    },
  });

  assert.equal(details.barangay, SYNC_MISSING_VALUE);
  assert.equal(details.disasterEvent, SYNC_MISSING_VALUE);
  assert.equal(formatSyncHistoryDateTime(null), SYNC_MISSING_VALUE);
  assert.notEqual(formatSyncHistoryDateTime("2026-08-20T09:44:00.000Z"), SYNC_MISSING_VALUE);
});

test("BRG-SC-P13 table scroll and prior Sync Center fixes remain present", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const componentSource = await fs.readFile(syncHealthComponentSourcePath, "utf8");

  assert.match(
    source,
    /<div className="sync-center-table-scroll" style=\{\{ overflowX: "auto" \}\}>[\s\S]*syncHistoryTableStyles/,
  );
  assert.match(source, /aria-label="View synchronization details"/);
  assert.match(componentSource, /Last successful sync:/);
});

test("BRG-SC-P14 Barangay search no longer advertises or indexes Barangay", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const helperSource = await fs.readFile(helperSourcePath, "utf8");
  const { buildSyncSearchText } = await import(helperModulePath.href);

  assert.match(
    source,
    /placeholder="Search record type, affected record, stub number, action, status, event, sector, relief pack, or notes"/,
  );
  assert.doesNotMatch(source, /placeholder="[^"]*barangay/i);
  assert.doesNotMatch(
    helperSource.match(/export const buildSyncSearchText = \([\s\S]*?\n\};/)?.[0] || "",
    /details\.barangay/,
  );
  assert.doesNotMatch(
    buildSyncSearchText({
      payload_json: {
        action_key: "HOUSEHOLD_REGISTER",
        payload: {
          barangay_name: "Barangay Hidden Search",
        },
      },
    }),
    /barangay hidden search/,
  );
});

test("BRG-OQ-P01 Offline Queue uses the final eight operational columns", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const queueSection = source.match(
    /activeSyncTab === "QUEUE" \? \([\s\S]*?\{activeSyncTab === "AUDIT"/,
  )?.[0] || "";

  assert.match(
    queueSection,
    /Record Type[\s\S]*Operation[\s\S]*Affected Record[\s\S]*Disaster Event[\s\S]*Status[\s\S]*Queued At[\s\S]*Notes[\s\S]*Action/,
  );
  assert.doesNotMatch(queueSection, /<th[^>]*>Barangay<\/th>|Family \/ Stub/);
  assert.match(queueSection, /offlineQueueTableStyles/);
});

test("BRG-OQ-P02 Offline Queue uses operation-aware affected record details", async () => {
  const { getSyncRecordDetails } = await import(helperModulePath.href);
  const details = getSyncRecordDetails({
    status: "FAILED",
    entity_type: "HOUSEHOLD",
    operation_type: "TIME_OUT",
    entity_server_id: "11111111-1111-4111-8111-111111111111",
    payload: {
      disaster_event_title: "Typhoon Falcon",
    },
  });

  assert.equal(details.operation, "Time Out");
  assert.equal(details.subject, "Evacuee departure record");
  assert.equal(details.disasterEvent, "Typhoon Falcon");
  assert.doesNotMatch(details.subject, /11111111/);
});

test("BRG-OQ-P03 Offline Queue Notes map technical failures to actionable language", async () => {
  const { getSyncQueueNotes } = await import(helperModulePath.href);

  assert.equal(
    getSyncQueueNotes({
      status: "FAILED",
      lastError: "current transaction is aborted, commands ignored until end of transaction block",
    }),
    "Synchronization could not be completed. Try again.",
  );
  assert.equal(
    getSyncQueueNotes({ status: "FAILED", lastError: "Failed to fetch" }),
    "Could not connect to DISTYNC. Reconnect and try again.",
  );
  assert.equal(
    getSyncQueueNotes({ status: "CONFLICT" }),
    "A synchronization conflict was detected. Review it in Conflict Review.",
  );
  assert.equal(
    getSyncQueueNotes({ status: "PENDING" }),
    "Waiting for a connection to DISTYNC.",
  );
});

test("BRG-OQ-P04 Offline Queue row action is an accessible icon with actual-outcome feedback", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const serviceSource = await fs.readFile(
    new URL("../src/offline/syncService.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-label=\{`Retry synchronization for \$\{details\.subject\}`\}/);
  assert.match(source, /title="Retry synchronization"/);
  assert.match(source, /window\.addEventListener\("online", updateConnectivity\)/);
  assert.match(source, /window\.addEventListener\("offline", updateConnectivity\)/);
  assert.match(source, /minWidth: "44px"/);
  assert.match(source, /aria-busy=\{isRetrying\}/);
  assert.doesNotMatch(source, /Retry is unavailable for this entry/);
  assert.doesNotMatch(source, /Failed sync entries were retried safely/);
  assert.match(serviceSource, /:\s*"SUCCESS";/);
  assert.match(serviceSource, /outcome: "OFFLINE"/);
  assert.match(serviceSource, /outcome: isNetworkFailure\(error\) \? "NETWORK_FAILURE"/);
});

test("BRG-SC-CONFLICT-P01 Conflict Review table uses the final six operational columns", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const conflictSection =
    source.match(/activeSyncTab === "CONFLICTS" \? \([\s\S]*?<SyncConflictDetailModal/)?.[0] || "";

  assert.match(
    conflictSection,
    /Record Type[\s\S]*Affected Record[\s\S]*Conflict Reason[\s\S]*Status[\s\S]*Resolved At[\s\S]*Action/,
  );
  assert.match(conflictSection, /<table style=\{conflictReviewTableStyles\}>/);
  assert.match(source, /minWidth: "820px"/);
  assert.doesNotMatch(conflictSection, /Family \/ Stub|Local Record|Server Record|Decision/);
  assert.doesNotMatch(conflictSection, /buildConflictPayloadSummary|getWinningSide/);
});

test("BRG-SC-CONFLICT-P02 Conflict Review table keeps reason and status concise", async () => {
  const source = await fs.readFile(pageSourcePath, "utf8");
  const conflictSection =
    source.match(/activeSyncTab === "CONFLICTS" \? \([\s\S]*?<SyncConflictDetailModal/)?.[0] || "";
  const { getConflictReasonLabel, getResolutionStatusLabel } = await import(
    helperModulePath.href
  );

  assert.equal(
    getConflictReasonLabel({
      conflict_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
      error_message:
        "Possible duplicate evacuee registration detected. Review the matched household before registering again.",
    }),
    "Duplicate Household Registration",
  );
  assert.equal(getResolutionStatusLabel({ status: "OPEN" }), "Open");
  assert.equal(
    getResolutionStatusLabel({
      status: "RESOLVED",
      resolved_payload_json: { automatic: true },
    }),
    "Resolved",
  );
  assert.doesNotMatch(conflictSection, /error_message[\s\S]*getResolutionStrategyLabel/);
  assert.doesNotMatch(conflictSection, /getResolutionStatusLabel\(conflict\)[\s\S]*detailTextStyles/);
  assert.match(conflictSection, /status=\{conflict\.status === "RESOLVED" \? "RESOLVED" : "OPEN"\}/);
});

test("BRG-SC-CONFLICT-P03 Sync Conflict Detail removes technical diagnostic headings and duplicate status", async () => {
  const modalSource = await fs.readFile(conflictModalSourcePath, "utf8");

  assert.match(modalSource, /Sync Conflict Detail/);
  assert.match(modalSource, /Conflict Summary/);
  assert.match(modalSource, /Why It Happened/);
  assert.match(modalSource, /Resolution/);
  assert.match(modalSource, /Record Comparison/);
  assert.doesNotMatch(
    modalSource,
    /Review what happened during synchronization|Winning Side|Resolution Strategy|Resolution Action|Local Payload Summary|Server Payload Summary|Affected Sync Record|Conflict - Resolved|Conflict - For Review/,
  );
  assert.doesNotMatch(modalSource, /status="CONFLICT"/);
});

test("BRG-SC-CONFLICT-P04 Conflict detail comparison is allow-listed and hides raw identifiers", async () => {
  const {
    SYNC_MISSING_VALUE,
    getConflictComparisonRows,
    getConflictExplanation,
    getConflictResolutionSummary,
  } = await import(helperModulePath.href);

  const conflict = {
    status: "RESOLVED",
    conflict_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
    resolution_strategy: "FIRST_ACCEPTED",
    resolved_payload_json: { winner: "SERVER" },
    local_payload_json: {
      payload: {
        family_head: { first_name: "Janna", last_name: "Paray" },
        disaster_event_id: "11111111-1111-4111-8111-111111111111",
        disaster_event_title: "Typhoon Response Maymay",
        updated_at: "2026-08-18T05:24:28.421Z",
      },
    },
    server_payload_json: {
      family_head_name: "Janna Paray",
      disaster_event_id: "22222222-2222-4222-8222-222222222222",
      disaster_event_title: "Typhoon Response Maymay",
      updated_at: "2026-08-18T05:25:00.000Z",
    },
  };
  const rows = getConflictComparisonRows(conflict);
  const rendered = JSON.stringify(rows);

  assert.equal(getConflictExplanation(conflict), "A household with matching information was already recorded for this disaster event.");
  assert.equal(getConflictResolutionSummary(conflict).result, "Saved DISTYNC record kept");
  assert.match(rendered, /Janna Paray/);
  assert.match(rendered, /Typhoon Response Maymay/);
  assert.doesNotMatch(rendered, /11111111|22222222|disaster_event_id|2026-08-18T05:24:28\.421Z/);
  assert.equal(
    rows.find((row) => row.label === "Barangay")?.localValue || SYNC_MISSING_VALUE,
    SYNC_MISSING_VALUE,
  );
});

test("BRG-SC-CONFLICT-P05 Open conflict UX stays honest and keeps authorization separate", async () => {
  const { getConflictResolutionSummary } = await import(helperModulePath.href);
  const syncStatusSource = await fs.readFile(syncStatusSourcePath, "utf8");
  const modalSource = await fs.readFile(conflictModalSourcePath, "utf8");

  assert.deepEqual(
    getConflictResolutionSummary({
      status: "OPEN",
      availableResolutionActions: [],
    }),
    {
      result: "Waiting for authorized review",
      whatHappened: "This conflict is open. Only an authorized reviewer can close it.",
    },
  );
  assert.match(syncStatusSource, /if \(status === "OPEN"\) \{[\s\S]*return "Open"/);
  assert.match(modalSource, /availableActions\.length > 0/);
  assert.doesNotMatch(modalSource, /fake|force|inventory.*mutat/i);
});

test("BRG-SC-CONFLICT-P06 Sync Conflict Detail uses the shared DISTYNC modal shell", async () => {
  const modalSource = await fs.readFile(conflictModalSourcePath, "utf8");

  assert.match(modalSource, /import FormModalShell from "\.\/FormModalShell"/);
  assert.match(modalSource, /<FormModalShell[\s\S]*title="Sync Conflict Detail"/);
  assert.match(modalSource, /closeButtonLabel="Close sync conflict detail"/);
  assert.match(modalSource, /contentStyle=\{modalStyles\.panel\}/);
  assert.match(modalSource, /bodyStyle=\{modalStyles\.body\}/);
  assert.match(modalSource, /footerStyle=\{modalStyles\.footer\}/);
  assert.match(modalSource, /footer=\{footer\}/);
  assert.match(modalSource, /maxHeight: "calc\(100vh - 32px\)"/);
  assert.match(modalSource, /overflowY: "hidden"[\s\S]*overflowX: "hidden"/);
  assert.doesNotMatch(modalSource, /modalStyles\.overlay|role="dialog"|aria-modal|document\.addEventListener|document\.body\.style\.overflow/);
});

test("BRG-SC-CONFLICT-P07 Sync Conflict Detail mirrors Anomaly Details section-card hierarchy", async () => {
  const modalSource = await fs.readFile(conflictModalSourcePath, "utf8");

  assert.match(modalSource, /<div style=\{\{ \.\.\.modalStyles\.card, marginBottom: "16px" \}\}>[\s\S]*Conflict[\s\S]*<SyncStatusBadge/);
  assert.match(modalSource, /gridTemplateColumns: "repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\)"/);
  assert.match(modalSource, /fieldGrid:[\s\S]*minmax\(min\(210px, 100%\), 1fr\)/);
  assert.match(modalSource, /Conflict Summary[\s\S]*Why It Happened[\s\S]*\{isResolved \? "Resolution" : "Current Action"\}/);
  assert.match(modalSource, /This Device Record[\s\S]*Saved DISTYNC Record/);
  assert.match(modalSource, /comparisonGrid:[\s\S]*minmax\(min\(260px, 100%\), 1fr\)/);
  assert.doesNotMatch(modalSource, /Reason required for Keep Server or Apply Local|status="CONFLICT"/);
});

test("BRG-SC-EVENT-P01 Sync History prefers enriched event title from API", async () => {
  const { getSyncRecordDetails } = await import(helperModulePath.href);
  const details = getSyncRecordDetails({
    sync_history_disaster_event_title: "Typhoon Response Maymay",
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      payload: {
        disaster_event_id: "11111111-1111-4111-8111-111111111111",
      },
    },
  });

  assert.equal(details.disasterEvent, "Typhoon Response Maymay");
});

test("BRG-SC-EVENT-P02 legacy event title is still used and missing event stays unavailable", async () => {
  const { getSyncRecordDetails, SYNC_MISSING_VALUE } = await import(
    helperModulePath.href
  );

  assert.equal(
    getSyncRecordDetails({
      payload_json: {
        action_key: "HOUSEHOLD_REGISTER",
        payload: {
          disaster_event_title: "Typhoon Falcon",
        },
      },
    }).disasterEvent,
    "Typhoon Falcon",
  );
  assert.equal(
    getSyncRecordDetails({
      payload_json: {
        action_key: "HOUSEHOLD_DEPART",
        payload: {
          remarks: "Legacy departure",
        },
      },
    }).disasterEvent,
    SYNC_MISSING_VALUE,
  );
});

test("BRG-SC-EVENT-P03 raw event UUID is never promoted as the event label", async () => {
  const { getSyncRecordDetails, SYNC_MISSING_VALUE } = await import(
    helperModulePath.href
  );
  const details = getSyncRecordDetails({
    payload_json: {
      action_key: "HOUSEHOLD_REGISTER",
      payload: {
        disaster_event_id: "22222222-2222-4222-8222-222222222222",
      },
    },
  });

  assert.equal(details.disasterEvent, SYNC_MISSING_VALUE);
});

test("BRG-SC-EVENT-P04 enriched event title participates in Sync History search", async () => {
  const { buildSyncSearchText } = await import(helperModulePath.href);

  assert.match(
    buildSyncSearchText({
      sync_history_disaster_event_title: "Typhoon Response Maymay",
      payload_json: {
        action_key: "HOUSEHOLD_REGISTER",
        payload: {},
      },
    }),
    /typhoon/,
  );
});

test("BRG-SC-EVENT-P05 departure queue preserves event only from row/detail source", async () => {
  const serviceSource = await fs.readFile(masterlistServiceSourcePath, "utf8");
  const pageSource = await fs.readFile(barangayMasterlistPageSourcePath, "utf8");

  assert.match(serviceSource, /disasterEventId = null/);
  assert.match(serviceSource, /\.\.\.\(disasterEventId \? \{ disaster_event_id: disasterEventId \} : \{\}\)/);
  assert.match(pageSource, /const getDepartureDisasterEventId = \(householdId\) =>/);
  assert.match(pageSource, /row\?\.disaster_event\?\.id \|\| row\?\.disaster_event_id/);
  assert.doesNotMatch(
    pageSource.match(/departHousehold\({[\s\S]*?}\)/)?.[0] || "",
    /selectedEvent\?\.id/,
  );
});

test("BRG-SC-EVENT-P06 stub claim queue preserves event from verified stub source", async () => {
  const serviceSource = await fs.readFile(stubServiceSourcePath, "utf8");
  const pageSource = await fs.readFile(
    barangayStubDistributionPageSourcePath,
    "utf8",
  );

  assert.match(serviceSource, /disasterEventId,/);
  assert.match(serviceSource, /\.\.\.\(disasterEventId \? \{ disaster_event_id: disasterEventId \} : \{\}\)/);
  assert.match(pageSource, /disasterEventId: row\?\.disaster_event\?\.id \|\| row\?\.disaster_event_id/);
  assert.match(pageSource, /pendingClaimStubDetails\?\.disaster_event\?\.id/);
});

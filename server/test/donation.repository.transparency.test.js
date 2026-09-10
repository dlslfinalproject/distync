const test = require("node:test");
const assert = require("node:assert/strict");

const repositoryPath = require.resolve(
  "../src/repositories/donation.repository",
);
const dbPath = require.resolve("../src/config/db");

const withStubbedRepository = async (runTest) => {
  const originalRepositoryEntry = require.cache[repositoryPath];
  const originalDbEntry = require.cache[dbPath];

  delete require.cache[repositoryPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {},
  };

  try {
    await runTest(require(repositoryPath));
  } finally {
    delete require.cache[repositoryPath];

    if (originalRepositoryEntry) {
      require.cache[repositoryPath] = originalRepositoryEntry;
    }

    if (originalDbEntry) {
      require.cache[dbPath] = originalDbEntry;
    } else {
      delete require.cache[dbPath];
    }
  }
};

const createCapturingDbClient = ({
  hasDonorNamePublicColumn = true,
  hasInventoryItemIsActiveColumn = true,
} = {}) => {
  const calls = [];

  return {
    calls,
    query: async (sql, values) => {
      const normalizedSql = String(sql).trim();
      calls.push({ sql: normalizedSql, values });

      if (normalizedSql.includes("information_schema.columns")) {
        const [tableName, columnName] = values || [];
        const hasColumn =
          tableName === "donations" && columnName === "donor_name_public"
            ? hasDonorNamePublicColumn
            : tableName === "inventory_items" && columnName === "is_active"
              ? hasInventoryItemIsActiveColumn
              : true;
        return { rows: [{ has_column: hasColumn }] };
      }

      if (normalizedSql.includes("total_donations_received")) {
        return {
          rows: [
            {
              total_donations_received: 1,
              total_quantity_received: 5,
            },
          ],
        };
      }

      if (normalizedSql.includes("total_donated_items_distributed")) {
        return { rows: [{ total_donated_items_distributed: 3 }] };
      }

      if (normalizedSql.includes("total_donated_items_written_off")) {
        return { rows: [{ total_donated_items_written_off: 1 }] };
      }

      if (normalizedSql.includes("remaining_donated_inventory")) {
        return { rows: [{ remaining_donated_inventory: 1 }] };
      }

      return { rows: [] };
    },
  };
};

test("donation transparency totals exclude cancelled donations and count distribution outflows", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient();
    const eventIds = ["event-1", "event-2"];

    const totals = await repository.getDonationSummaryTotals(eventIds, dbClient);

    assert.deepEqual(totals, {
      total_donations_received: 1,
      total_quantity_received: 5,
      total_donated_items_distributed: 3,
      total_donated_items_written_off: 1,
      remaining_donated_inventory: 1,
    });

    const receiptQuery = dbClient.calls.find((call) =>
      call.sql.includes("total_donations_received"),
    );
    const distributionQuery = dbClient.calls.find((call) =>
      call.sql.includes("total_donated_items_distributed"),
    );
    const writeOffQuery = dbClient.calls.find((call) =>
      call.sql.includes("total_donated_items_written_off"),
    );
    const remainingQuery = dbClient.calls.find((call) =>
      call.sql.includes("remaining_donated_inventory"),
    );

    assert.match(receiptQuery.sql, /d\.status <> 'CANCELLED'/);
    assert.match(receiptQuery.sql, /INNER JOIN inventory_batches/);
    assert.match(receiptQuery.sql, /ib\.source_type = 'DONATED'/);
    assert.match(distributionQuery.sql, /it\.transaction_type = 'OUTFLOW'/);
    assert.doesNotMatch(distributionQuery.sql, /RETURN/);
    assert.match(distributionQuery.sql, /d\.status <> 'CANCELLED'/);
    assert.match(writeOffQuery.sql, /d\.status <> 'CANCELLED'/);
    assert.match(remainingQuery.sql, /d\.status <> 'CANCELLED'/);
    assert.deepEqual(receiptQuery.values, [eventIds]);
    assert.deepEqual(distributionQuery.values, [eventIds]);
  });
});

test("donation transparency rows and exports use the same cancelled and net movement rules", async () => {
  await withStubbedRepository(async (repository) => {
    const itemDbClient = createCapturingDbClient();

    await repository.getDonationItemTransparencySummary(["event-1"], itemDbClient);

    const itemQuery = itemDbClient.calls.find((call) =>
      call.sql.includes("d.donor_name_public"),
    );

    assert.ok(itemQuery);
    assert.match(itemQuery.sql, /d\.status <> 'CANCELLED'/);
    assert.match(itemQuery.sql, /d\.donor_name_public/);
    assert.match(itemQuery.sql, /it\.transaction_type = 'OUTFLOW'/);
    assert.doesNotMatch(itemQuery.sql, /RETURN/);
    assert.match(itemQuery.sql, /d2\.status <> 'CANCELLED'/);

    const exportDbClient = createCapturingDbClient();
    await repository.getDonationTransparencyExportRows("event-1", exportDbClient);

    assert.equal(exportDbClient.calls.length, 1);
    assert.match(exportDbClient.calls[0].sql, /d\.status <> 'CANCELLED'/);
    assert.match(exportDbClient.calls[0].sql, /ii\.unit_of_measure/);
    assert.match(exportDbClient.calls[0].sql, /it\.transaction_type = 'OUTFLOW'/);
    assert.match(exportDbClient.calls[0].sql, /distribution_event_breakdown/);
    assert.match(exportDbClient.calls[0].sql, /transfer_event_breakdown/);
    assert.match(
      exportDbClient.calls[0].sql,
      /it\.remarks ILIKE 'Reassigned leftover donated stock%'/,
    );
    assert.match(exportDbClient.calls[0].sql, /de2\.title/);
    assert.doesNotMatch(exportDbClient.calls[0].sql, /RETURN/);
    assert.deepEqual(exportDbClient.calls[0].values, ["event-1"]);
  });
});

test("management transparency keeps cross-event movement in the batch total", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient();

    await repository.getDonationSummaryTotals(
      ["event-1"],
      { includeCrossEventDistributions: true },
      dbClient,
    );
    await repository.getDonationItemTransparencySummary(
      ["event-1"],
      { scope: "management" },
      dbClient,
    );

    const distributionTotalsQuery = dbClient.calls.find((call) =>
      call.sql.includes("total_donated_items_distributed"),
    );
    const managementRowsQuery = dbClient.calls.find((call) =>
      call.sql.includes("distribution_event_breakdown"),
    );

    assert.ok(distributionTotalsQuery);
    assert.ok(managementRowsQuery);
    assert.doesNotMatch(
      distributionTotalsQuery.sql,
      /it\.disaster_event_id = ANY\(\$\d+::uuid\[\]\)/,
    );
    assert.match(
      managementRowsQuery.sql,
      /it\.disaster_event_id IS DISTINCT FROM d\.disaster_event_id/,
    );
    assert.doesNotMatch(
      managementRowsQuery.sql,
      /AND it\.disaster_event_id = ANY\(\$1::uuid\[\]\)/,
    );
    assert.match(managementRowsQuery.sql, /transfer_event_breakdown/);
  });
});

test("donation edits preserve reassigned transfer event attribution", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient();

    await repository.syncDonationInventoryTransactions(
      "donation-1",
      {
        disaster_event_id: "event-a",
        received_at: "2026-09-10T00:00:00.000Z",
      },
      dbClient,
    );

    assert.equal(dbClient.calls.length, 3);
    dbClient.calls.forEach((call) => {
      assert.match(
        call.sql,
        /COALESCE\(it\.remarks, ''\) NOT ILIKE 'Reassigned leftover donated stock%'/,
      );
    });
  });
});

test("public recent donation summaries select an explicit donor-name visibility flag", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient();

    await repository.getPublicRecentDonationSummaries(["event-1"], 6, dbClient);

    const summaryQuery = dbClient.calls.find((call) =>
      call.sql.includes("BOOL_OR(COALESCE(d.donor_name_public, FALSE))"),
    );

    assert.ok(summaryQuery);
    assert.match(summaryQuery.sql, /BOOL_OR\(COALESCE\(d\.donor_name_public, FALSE\)\)/);
    assert.match(
      summaryQuery.sql,
      /WHEN donor_groups\.donor_name_public THEN donor_groups\.donor_name/,
    );
    assert.deepEqual(summaryQuery.values, [["event-1"], 6]);
  });
});

test("donation transparency reads remain anonymous when the visibility migration is missing", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient({
      hasDonorNamePublicColumn: false,
    });

    await repository.getDonations({}, dbClient);

    const donationQuery = dbClient.calls.find((call) =>
      call.sql.includes("FROM donations d"),
    );

    assert.ok(donationQuery);
    assert.match(donationQuery.sql, /FALSE AS donor_name_public/);
    assert.doesNotMatch(donationQuery.sql, /d\.donor_name_public/);
  });
});

test("public transparency pagination groups before applying SQL LIMIT/OFFSET", async () => {
  await withStubbedRepository(async (repository) => {
    const calls = [];
    const pageRows = Array.from({ length: 25 }, (_, index) => ({
      source_key: `donation-${index}`,
      source_type: "LOOSE_ITEM",
      donor_name: null,
      donor_name_public: false,
      donor_type: "INDIVIDUAL",
      item_name: `Item ${index}`,
      quantity_received: 1,
      quantity_distributed: 0,
      quantity_written_off: 0,
      quantity_remaining: 1,
      write_off_reasons: [],
      donor_label_number: index + 1,
    }));
    const dbClient = {
      query: async (sql, values) => {
        const normalizedSql = String(sql).trim();
        calls.push({ sql: normalizedSql, values });

        if (normalizedSql.includes("information_schema.columns")) {
          return { rows: [{ has_column: true }] };
        }

        if (normalizedSql.includes("COUNT(*)::int AS total_items")) {
          return {
            rows: [
              {
                total_items: 60,
                total_loose_items_received: 60,
                total_loose_items_distributed: 20,
                total_loose_items_remaining: 40,
                total_relief_packs_received: 0,
                total_relief_packs_distributed: 0,
                total_relief_packs_remaining: 0,
              },
            ],
          };
        }

        return { rows: pageRows };
      },
    };

    const result = await repository.getDonationItemTransparencySummary(
      ["event-1"],
      { page: 2, pageSize: 25 },
      dbClient,
    );

    assert.equal(result.rows.length, 25);
    assert.equal(result.totalItems, 60);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 25);
    assert.deepEqual(result.totals, {
      loose_items_received: 60,
      loose_items_distributed: 20,
      loose_items_remaining: 40,
      relief_packs_received: 0,
      relief_packs_distributed: 0,
      relief_packs_remaining: 0,
    });

    const countQuery = calls.find((call) =>
      call.sql.includes("COUNT(*)::int AS total_items"),
    );
    const dataQuery = calls.find((call) => call.sql.includes("LIMIT $2"));

    assert.ok(countQuery);
    assert.ok(dataQuery);
    assert.match(countQuery.sql, /GROUP BY eligible_rows\.source_key/);
    assert.match(countQuery.sql, /RELIEF_PACK/);
    assert.match(dataQuery.sql, /ORDER BY[\s\S]*sort_donation_item_id/);
    assert.match(dataQuery.sql, /LIMIT \$2/);
    assert.match(dataQuery.sql, /OFFSET \$3/);
    assert.deepEqual(dataQuery.values, [["event-1"], 25, 25]);
  });
});

test("donation insert values stay aligned with the target columns", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient();

    await repository.insertDonation(
      {
        disaster_event_id: "event-1",
        donor_name: "Test Donor",
        donor_type: "INDIVIDUAL",
        donor_type_other: null,
        contact_information: null,
        received_by: "user-1",
        received_at: "2026-09-03T08:00:00.000Z",
        status: "RECEIVED",
        remarks: null,
      },
      dbClient,
    );

    const insertQuery = dbClient.calls.find((call) =>
      call.sql.includes("INSERT INTO donations"),
    );

    assert.ok(insertQuery);
    assert.match(
      insertQuery.sql,
      /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, COALESCE\(\$7, NOW\(\)\), \$8, \$9, NOW\(\), NOW\(\)\)/,
    );
    assert.doesNotMatch(insertQuery.sql, /VALUES \(\$1, \$2, FALSE/);
  });
});

test("donor-name publication fails safely when the deployed schema lacks the flag", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient({
      hasDonorNamePublicColumn: false,
    });

    await assert.rejects(
      repository.updateDonationPublicName(
        "donation-1",
        true,
        dbClient,
      ),
      (error) =>
        error.code === "DONATION_PUBLIC_NAME_COLUMN_MISSING" &&
        error.statusCode === 503,
    );

    assert.equal(
      dbClient.calls.some((call) => call.sql.includes("UPDATE donations")),
      false,
    );
  });
});

test("donor-name publication rechecks schema after a missing column becomes available", async () => {
  await withStubbedRepository(async (repository) => {
    const calls = [];
    let hasColumn = false;
    const dbClient = {
      query: async (sql, values) => {
        const normalizedSql = String(sql).trim();
        calls.push({ sql: normalizedSql, values });

        if (normalizedSql.includes("information_schema.columns")) {
          const result = { rows: [{ has_column: hasColumn }] };
          hasColumn = true;
          return result;
        }

        if (normalizedSql.includes("UPDATE donations")) {
          return { rows: [{ id: "donation-1", donor_name_public: true }] };
        }

        return { rows: [] };
      },
    };

    await assert.rejects(
      repository.updateDonationPublicName("donation-1", true, dbClient),
      (error) =>
        error.code === "DONATION_PUBLIC_NAME_COLUMN_MISSING" &&
        error.statusCode === 503,
    );

    const updatedDonation = await repository.updateDonationPublicName(
      "donation-1",
      true,
      dbClient,
    );

    assert.deepEqual(updatedDonation, {
      id: "donation-1",
      donor_name_public: true,
    });
    assert.equal(
      calls.filter((call) => call.sql.includes("information_schema.columns"))
        .length,
      2,
    );
  });
});

test("donation inventory lookups remain compatible without inventory_items.is_active", async () => {
  await withStubbedRepository(async (repository) => {
    const dbClient = createCapturingDbClient({
      hasInventoryItemIsActiveColumn: false,
    });

    await repository.getInventoryItemById("item-1", dbClient);
    await repository.getInventoryItemByName("Rice", dbClient);

    const inventoryQueries = dbClient.calls.filter((call) =>
      call.sql.includes("FROM inventory_items"),
    );

    assert.equal(inventoryQueries.length, 2);
    inventoryQueries.forEach((query) => {
      assert.match(query.sql, /TRUE AS is_active/);
      assert.doesNotMatch(query.sql, /inventory_items\.is_active/);
      assert.doesNotMatch(query.sql, /ORDER BY\s+is_active/i);
    });
  });
});

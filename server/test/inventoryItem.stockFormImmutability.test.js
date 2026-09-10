const assert = require("node:assert/strict");
const test = require("node:test");

const servicePath = require.resolve("../src/services/inventoryItem.service");
const dbPath = require.resolve("../src/config/db");
const inventoryItemRepositoryPath = require.resolve(
  "../src/repositories/inventoryItem.repository",
);
const inventoryItemStockFormRepositoryPath = require.resolve(
  "../src/repositories/inventoryItemStockForm.repository",
);
const inventoryBatchRepositoryPath = require.resolve(
  "../src/repositories/inventoryBatch.repository",
);
const inventoryTransactionRepositoryPath = require.resolve(
  "../src/repositories/inventoryTransaction.repository",
);
const forecastRepositoryPath = require.resolve("../src/repositories/forecast.repository");
const systemLogRepositoryPath = require.resolve("../src/repositories/systemLog.repository");
const inventoryItemExportPath = require.resolve("../src/utils/inventoryItemExport");
const inventoryStateBasisPath = require.resolve("../src/utils/inventoryStateBasis");
const mayorReportExportPath = require.resolve("../src/utils/mayorReportExport");
const systemLogPath = require.resolve("../src/utils/systemLog");
const inventoryBatchStatusServicePath = require.resolve(
  "../src/services/inventoryBatchStatus.service",
);

const dependencyPaths = [
  dbPath,
  inventoryItemRepositoryPath,
  inventoryItemStockFormRepositoryPath,
  inventoryBatchRepositoryPath,
  inventoryTransactionRepositoryPath,
  forecastRepositoryPath,
  systemLogRepositoryPath,
  inventoryItemExportPath,
  inventoryStateBasisPath,
  mayorReportExportPath,
  systemLogPath,
  inventoryBatchStatusServicePath,
];

const withStubbedInventoryItemService = async (stubs, runTest) => {
  const originalEntries = new Map(
    dependencyPaths.map((modulePath) => [modulePath, require.cache[modulePath]]),
  );

  delete require.cache[servicePath];

  try {
    dependencyPaths.forEach((modulePath) => {
      require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports: stubs[modulePath] || {},
      };
    });

    return await runTest(require(servicePath));
  } finally {
    delete require.cache[servicePath];

    dependencyPaths.forEach((modulePath) => {
      const originalEntry = originalEntries.get(modulePath);

      if (originalEntry) {
        require.cache[modulePath] = originalEntry;
      } else {
        delete require.cache[modulePath];
      }
    });
  }
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const makeInventoryItem = (overrides = {}) => ({
  id: "item-1",
  item_code: "ITEM-1",
  item_name: "Rice",
  category: "Non-Perishable",
  unit_of_measure: "pc",
  unit_of_measure_value: 1,
  packaging: "box",
  packaging_count: 1,
  quantity: 12,
  reorder_level: 2,
  expiration_date: null,
  barcode: null,
  is_perishable: false,
  created_at: "2026-09-08T00:00:00.000Z",
  updated_at: "2026-09-08T00:00:00.000Z",
  ...overrides,
});

const makeStockForm = (id, overrides = {}) => ({
  id,
  inventory_item_id: "item-1",
  barcode: null,
  packaging: "box",
  units_per_packaging: 12,
  unit_of_measure: "pc",
  unit_of_measure_value: 1,
  is_active: true,
  created_at: "2026-09-08T01:00:00.000Z",
  updated_at: "2026-09-08T01:00:00.000Z",
  ...overrides,
});

const buildUpdatePayload = (item, overrides = {}) => ({
  item_code: item.item_code,
  item_name: item.item_name,
  category: item.category,
  unit_of_measure: item.unit_of_measure,
  unit_of_measure_value: item.unit_of_measure_value,
  packaging: item.packaging,
  packaging_count: item.packaging_count,
  quantity: item.quantity,
  reorder_level: item.reorder_level,
  expiration_date: item.expiration_date,
  barcode: item.barcode,
  is_perishable: item.is_perishable,
  skip_opening_stock: false,
  ...overrides,
});

const createHarness = ({
  item = makeInventoryItem(),
  stockForms = [makeStockForm("form-a")],
  referencedStockFormIds = [],
  insertError = null,
  onInsertError = null,
} = {}) => {
  const state = {
    item: clone(item),
    stockForms: clone(stockForms),
    referencedStockFormIds: new Set(referencedStockFormIds),
  };
  const calls = {
    updateItem: [],
    insertStockForms: [],
    updateStockForms: [],
    audit: [],
  };
  const events = [];
  const client = {
    query: async (sql) => {
      const event = String(sql).trim();
      events.push(event);
      return { rows: [] };
    },
    release: () => events.push("RELEASE"),
  };

  const stubs = {
    [dbPath]: {
      connect: async () => client,
    },
    [inventoryItemRepositoryPath]: {
      getInventoryItemByIdForUpdate: async () => clone(state.item),
      getInventoryItemById: async (id) =>
        String(id) === String(state.item.id) ? clone(state.item) : null,
      getInventoryItemByBarcode: async (barcode) =>
        state.item.barcode === barcode ? clone(state.item) : null,
      getInventoryItemByCode: async (itemCode) =>
        state.item.item_code === itemCode ? clone(state.item) : null,
      getInventoryItemByName: async (itemName) =>
        state.item.item_name === itemName ? clone(state.item) : null,
      updateInventoryItem: async (id, itemData) => {
        calls.updateItem.push({ id, itemData: clone(itemData) });
        const persistedItemData = clone(itemData);
        delete persistedItemData.expiration_date;
        state.item = { ...state.item, ...persistedItemData, id };
        return clone(state.item);
      },
    },
    [inventoryItemStockFormRepositoryPath]: {
      getInventoryItemStockFormsByItemId: async () => clone(state.stockForms),
      getInventoryItemStockFormByBarcode: async (barcode) =>
        clone(
          state.stockForms.find((stockForm) => stockForm.barcode === barcode) ||
            null,
        ),
      isInventoryItemStockFormReferencedByBatch: async (id) =>
        state.referencedStockFormIds.has(id),
      insertInventoryItemStockForm: async (stockFormData) => {
        calls.insertStockForms.push(clone(stockFormData));

        if (insertError) {
          onInsertError?.(state);
          throw insertError;
        }

        const createdStockForm = {
          ...clone(stockFormData),
          id: `form-${state.stockForms.length + 1}`,
          created_at: "2026-09-10T00:00:00.000Z",
          updated_at: "2026-09-10T00:00:00.000Z",
        };
        state.stockForms.push(createdStockForm);
        return clone(createdStockForm);
      },
      updateInventoryItemStockForm: async (id, stockFormData) => {
        calls.updateStockForms.push({ id, stockFormData: clone(stockFormData) });
        const stockForm = state.stockForms.find((candidate) => candidate.id === id);

        if (!stockForm) {
          return null;
        }

        Object.assign(stockForm, clone(stockFormData));
        return clone(stockForm);
      },
    },
    [inventoryBatchRepositoryPath]: {},
    [inventoryTransactionRepositoryPath]: {},
    [forecastRepositoryPath]: {},
    [systemLogRepositoryPath]: {},
    [inventoryItemExportPath]: {},
    [inventoryStateBasisPath]: {
      createInventoryStateBasis: () => ({ basisVersion: 1 }),
    },
    [mayorReportExportPath]: {
      formatDateOnly: () => "",
      formatDateTime: () => "",
      buildExportFile: () => ({}),
      ALLOWED_EXPORT_FORMATS: ["csv", "excel", "pdf"],
    },
    [systemLogPath]: {
      logAuditSafely: async (auditEntry) => {
        calls.audit.push(clone(auditEntry));
      },
      pickDefined: (value, keys) =>
        keys.reduce((picked, key) => {
          if (value[key] !== undefined) {
            picked[key] = value[key];
          }
          return picked;
        }, {}),
    },
    [inventoryBatchStatusServicePath]: {
      refreshDerivedInventoryBatchStatusesForItem: async () => {},
    },
  };

  return { state, calls, events, stubs };
};

const runUpdate = async (harness, payload) =>
  withStubbedInventoryItemService(harness.stubs, async ({ updateInventoryItem }) =>
    updateInventoryItem("item-1", payload, { userId: "mayor-1", roleCode: "MAYOR" }),
  );

test("referenced stock-form definition fields copy on write independently", async (t) => {
  const cases = [
    ["packaging", { packaging: "sack" }],
    ["units_per_packaging", { quantity: 24 }],
    ["unit_of_measure", { unit_of_measure: "kg" }],
    ["unit_of_measure_value", { unit_of_measure_value: 2.5 }],
  ];

  for (const [field, overrides] of cases) {
    await t.test(field, async () => {
      const originalStockForm = makeStockForm("form-a");
      const harness = createHarness({
        stockForms: [originalStockForm],
        referencedStockFormIds: [originalStockForm.id],
      });

      await runUpdate(
        harness,
        buildUpdatePayload(harness.state.item, overrides),
      );

      assert.equal(harness.state.stockForms.length, 2);
      assert.equal(harness.calls.insertStockForms.length, 1);
      assert.equal(harness.calls.updateStockForms.length, 0);
      assert.equal(harness.state.stockForms[0].id, originalStockForm.id);
      assert.equal(harness.state.stockForms[0].packaging, "box");
      assert.equal(harness.state.stockForms[0].units_per_packaging, 12);
      assert.equal(harness.state.stockForms[0].unit_of_measure, "pc");
      assert.equal(harness.state.stockForms[0].unit_of_measure_value, 1);
      assert.equal(harness.state.stockForms[1].inventory_item_id, "item-1");
      assert.deepEqual(
        [...harness.state.referencedStockFormIds],
        [originalStockForm.id],
      );
      assert.deepEqual(harness.events, ["BEGIN", "COMMIT", "RELEASE"]);
    });
  }
});

test("an exact active requested form is reused instead of creating a duplicate", async () => {
  const formA = makeStockForm("form-a");
  const formB = makeStockForm("form-b", {
    packaging: "sack",
    units_per_packaging: 24,
  });
  const harness = createHarness({
    stockForms: [formA, formB],
    referencedStockFormIds: [formA.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
    }),
  );

  assert.equal(harness.state.stockForms.length, 2);
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.deepEqual(harness.state.stockForms, [formA, formB]);
  assert.deepEqual([...harness.state.referencedStockFormIds], [formA.id]);
});

test("an unreferenced current form keeps the existing in-place update behavior", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({ stockForms: [formA] });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
    }),
  );

  assert.equal(harness.state.stockForms.length, 1);
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 1);
  assert.equal(harness.calls.updateStockForms[0].id, formA.id);
  assert.equal(harness.state.stockForms[0].packaging, "sack");
  assert.equal(harness.state.stockForms[0].units_per_packaging, 24);
});

test("an unrelated item edit is a stock-form no-op even when the current form is historical", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, { item_name: "Renamed Rice" }),
  );

  assert.equal(harness.state.item.item_name, "Renamed Rice");
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.deepEqual(harness.state.stockForms, [formA]);
});

test("expiration-only item update is an accepted persistence no-op", async () => {
  const cases = [
    { existingExpiration: "2027-01-01", incomingExpiration: "2027-01-01" },
    { existingExpiration: "2027-01-01", incomingExpiration: "2027-06-30" },
    { existingExpiration: "2027-01-01", incomingExpiration: null },
    { existingExpiration: "2027-01-01", incomingExpiration: "" },
    { existingExpiration: null, incomingExpiration: "2028-05-01" },
  ];

  for (const { existingExpiration, incomingExpiration } of cases) {
    const formA = makeStockForm("form-a");
    const harness = createHarness({
      item: makeInventoryItem({ expiration_date: existingExpiration }),
      stockForms: [formA],
    });

    const result = await runUpdate(harness, {
      expiration_date: incomingExpiration,
    });

    assert.equal(result.expiration_date, existingExpiration);
    assert.equal(harness.calls.updateItem.length, 0);
    assert.equal(harness.state.item.expiration_date, existingExpiration);
    assert.equal(harness.calls.insertStockForms.length, 0);
    assert.equal(harness.calls.updateStockForms.length, 0);
    assert.equal(harness.calls.audit.length, 0);
    assert.deepEqual(harness.state.stockForms, [formA]);
    assert.equal(harness.state.item.updated_at, "2026-09-08T00:00:00.000Z");
    assert.deepEqual(harness.events, ["BEGIN", "COMMIT", "RELEASE"]);
  }
});

test("mixed item update persists legitimate fields while ignoring parent expiration", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    item: makeInventoryItem({ expiration_date: "2027-01-01" }),
    stockForms: [formA],
  });

  const result = await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      item_name: "Premium Rice",
      expiration_date: "2028-01-01",
    }),
  );

  assert.equal(result.item_name, "Premium Rice");
  assert.equal(result.expiration_date, "2027-01-01");
  assert.equal(harness.state.item.item_name, "Premium Rice");
  assert.equal(harness.state.item.expiration_date, "2027-01-01");
  assert.equal(harness.calls.updateItem.length, 1);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      harness.calls.updateItem[0].itemData,
      "expiration_date",
    ),
    false,
  );
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.equal(harness.calls.audit.length, 1);
  assert.equal(harness.calls.audit[0].oldValues.expiration_date, "2027-01-01");
  assert.equal(harness.calls.audit[0].newValues.expiration_date, "2027-01-01");
});

test("a full legacy item payload with only expiration changed remains a no-op", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    item: makeInventoryItem({ expiration_date: "2027-01-01" }),
    stockForms: [formA],
  });

  const result = await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      expiration_date: "2028-05-01",
    }),
  );

  assert.equal(result.expiration_date, "2027-01-01");
  assert.equal(harness.calls.updateItem.length, 0);
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.equal(harness.calls.audit.length, 0);
  assert.deepEqual(harness.state.stockForms, [formA]);
});

test("stock-form copy on write remains independent when an update also carries legacy expiration", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    item: makeInventoryItem({ expiration_date: "2027-01-01" }),
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
      expiration_date: "2028-01-01",
    }),
  );

  assert.equal(harness.state.item.expiration_date, "2027-01-01");
  assert.equal(harness.state.stockForms.length, 2);
  assert.equal(harness.calls.insertStockForms.length, 1);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      harness.calls.updateItem[0].itemData,
      "expiration_date",
    ),
    false,
  );
});

test("A to B to C creates a new form each time the current form is referenced", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
    }),
  );
  harness.state.referencedStockFormIds.add("form-2");

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "case",
      quantity: 6,
    }),
  );

  assert.deepEqual(
    harness.state.stockForms.map((stockForm) => [
      stockForm.id,
      stockForm.packaging,
      stockForm.units_per_packaging,
    ]),
    [
      ["form-a", "box", 12],
      ["form-2", "sack", 24],
      ["form-3", "case", 6],
    ],
  );
  assert.deepEqual([...harness.state.referencedStockFormIds], ["form-a", "form-2"]);
  assert.equal(harness.calls.insertStockForms.length, 2);
  assert.equal(harness.calls.updateStockForms.length, 0);
});

test("current-parent matching wins over the legacy earliest-form fallback", async () => {
  const earliestLegacyForm = makeStockForm("form-legacy", {
    packaging: "piece",
    units_per_packaging: 1,
  });
  const currentForm = makeStockForm("form-current");
  const harness = createHarness({
    stockForms: [earliestLegacyForm, currentForm],
    referencedStockFormIds: [currentForm.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
    }),
  );

  assert.equal(harness.state.stockForms.length, 3);
  assert.equal(harness.state.stockForms[0].packaging, "piece");
  assert.equal(harness.state.stockForms[1].packaging, "box");
  assert.equal(harness.state.stockForms[2].packaging, "sack");
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.deepEqual([...harness.state.referencedStockFormIds], [currentForm.id]);
});

test("replaying the same update is idempotent after copy on write", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });
  const firstPayload = buildUpdatePayload(harness.state.item, {
    packaging: "sack",
    quantity: 24,
  });

  await runUpdate(harness, firstPayload);
  harness.state.referencedStockFormIds.add("form-2");
  await runUpdate(harness, buildUpdatePayload(harness.state.item));

  assert.equal(harness.state.stockForms.length, 2);
  assert.equal(harness.calls.insertStockForms.length, 1);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.deepEqual([...harness.state.referencedStockFormIds], ["form-a", "form-2"]);
});

test("a concurrent definition insert race reuses the committed exact form", async () => {
  const formA = makeStockForm("form-a");
  const concurrentForm = makeStockForm("form-concurrent", {
    packaging: "sack",
    units_per_packaging: 24,
  });
  const uniqueDefinitionError = new Error("unique definition race");
  uniqueDefinitionError.code = "23505";
  uniqueDefinitionError.constraint =
    "inventory_item_stock_forms_unique_definition";
  const harness = createHarness({
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
    insertError: uniqueDefinitionError,
    onInsertError: (state) => state.stockForms.push(clone(concurrentForm)),
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
    }),
  );

  assert.equal(harness.state.stockForms.length, 2);
  assert.equal(harness.calls.insertStockForms.length, 1);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.equal(harness.state.stockForms[1].id, concurrentForm.id);
});

test("copy on write preserves the old barcode and assigns a unique new barcode", async () => {
  const formA = makeStockForm("form-a", { barcode: "11111111" });
  const harness = createHarness({
    item: makeInventoryItem({ barcode: "11111111" }),
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });

  await runUpdate(
    harness,
    buildUpdatePayload(harness.state.item, {
      packaging: "sack",
      quantity: 24,
      barcode: "22222222",
    }),
  );

  assert.equal(harness.state.stockForms[0].barcode, "11111111");
  assert.equal(harness.state.stockForms[1].barcode, "22222222");
  assert.equal(harness.calls.insertStockForms.length, 1);
});

test("copy on write rejects a requested barcode owned by the old historical form", async () => {
  const formA = makeStockForm("form-a", { barcode: "11111111" });
  const harness = createHarness({
    item: makeInventoryItem({ barcode: "11111111" }),
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
  });

  await assert.rejects(
    runUpdate(
      harness,
      buildUpdatePayload(harness.state.item, {
        packaging: "sack",
        quantity: 24,
        barcode: "11111111",
      }),
    ),
    (error) => {
      assert.equal(error.code, "DUPLICATE_INVENTORY_BARCODE");
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.equal(harness.state.stockForms.length, 1);
  assert.deepEqual(harness.events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("copy on write rejects a barcode owned by another form of the same item", async () => {
  const formA = makeStockForm("form-a", { barcode: "11111111" });
  const formB = makeStockForm("form-b", {
    barcode: "22222222",
    packaging: "sack",
    units_per_packaging: 24,
  });
  const harness = createHarness({
    item: makeInventoryItem({ barcode: "11111111" }),
    stockForms: [formA, formB],
    referencedStockFormIds: [formA.id],
  });

  await assert.rejects(
    runUpdate(
      harness,
      buildUpdatePayload(harness.state.item, {
        packaging: "case",
        quantity: 6,
        barcode: "22222222",
      }),
    ),
    (error) => {
      assert.equal(error.code, "DUPLICATE_INVENTORY_BARCODE");
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.equal(harness.state.stockForms.length, 2);
  assert.deepEqual(harness.events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("an inactive exact requested form fails safely without reactivation or duplication", async () => {
  const formA = makeStockForm("form-a");
  const inactiveFormB = makeStockForm("form-b", {
    packaging: "sack",
    units_per_packaging: 24,
    is_active: false,
  });
  const harness = createHarness({
    stockForms: [formA, inactiveFormB],
    referencedStockFormIds: [formA.id],
  });

  await assert.rejects(
    runUpdate(
      harness,
      buildUpdatePayload(harness.state.item, {
        packaging: "sack",
        quantity: 24,
      }),
    ),
    (error) => {
      assert.equal(error.code, "INACTIVE_STOCK_FORM_DEFINITION");
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.equal(harness.state.stockForms.length, 2);
  assert.equal(harness.state.stockForms[1].is_active, false);
  assert.equal(harness.calls.insertStockForms.length, 0);
  assert.equal(harness.calls.updateStockForms.length, 0);
  assert.deepEqual(harness.events, ["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("copy-on-write failure rolls back the item update transaction", async () => {
  const formA = makeStockForm("form-a");
  const harness = createHarness({
    stockForms: [formA],
    referencedStockFormIds: [formA.id],
    insertError: new Error("stock-form insert failed"),
  });

  await assert.rejects(
    runUpdate(
      harness,
      buildUpdatePayload(harness.state.item, {
        packaging: "sack",
        quantity: 24,
      }),
    ),
    /stock-form insert failed/,
  );

  assert.deepEqual(harness.events, ["BEGIN", "ROLLBACK", "RELEASE"]);
  assert.equal(harness.state.stockForms.length, 1);
  assert.equal(harness.calls.updateStockForms.length, 0);
});

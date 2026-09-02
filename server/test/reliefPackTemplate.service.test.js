const assert = require("node:assert/strict");
const test = require("node:test");

const pool = require("../src/config/db");
const reliefPackTemplateRepository = require("../src/repositories/reliefPackTemplate.repository");
const reliefPackTemplateService = require("../src/services/reliefPackTemplate.service");

const originalPoolConnect = pool.connect;
const originalPoolQuery = pool.query;
const originalRepositoryMethods = {
  getReliefPackTemplateByName:
    reliefPackTemplateRepository.getReliefPackTemplateByName,
  getInactiveReliefPackTemplateByName:
    reliefPackTemplateRepository.getInactiveReliefPackTemplateByName,
  getReliefPackTemplateById: reliefPackTemplateRepository.getReliefPackTemplateById,
  getReliefPackTemplateItemsByTemplateId:
    reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId,
  getReliefPackTemplateDisasterTypesByTemplateId:
    reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId,
  getReliefPackTemplateUsageByTemplateId:
    reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId,
  getReliefPackTemplateDeactivationBlockersByTemplateId:
    reliefPackTemplateRepository.getReliefPackTemplateDeactivationBlockersByTemplateId,
  getInventoryItemById: reliefPackTemplateRepository.getInventoryItemById,
  insertReliefPackTemplate: reliefPackTemplateRepository.insertReliefPackTemplate,
  insertReliefPackTemplateItem:
    reliefPackTemplateRepository.insertReliefPackTemplateItem,
  updateReliefPackTemplate: reliefPackTemplateRepository.updateReliefPackTemplate,
  deleteReliefPackTemplateItemsByTemplateId:
    reliefPackTemplateRepository.deleteReliefPackTemplateItemsByTemplateId,
  deleteReliefPackTemplateDisasterTypesByTemplateId:
    reliefPackTemplateRepository.deleteReliefPackTemplateDisasterTypesByTemplateId,
  insertReliefPackTemplateDisasterType:
    reliefPackTemplateRepository.insertReliefPackTemplateDisasterType,
  updateReliefPackTemplateStatus:
    reliefPackTemplateRepository.updateReliefPackTemplateStatus,
};

const duplicateNameMessage =
  "A relief pack template with this name already exists. Choose a different name.";

const buildTemplateData = (name = "Standard Food Pack") => ({
  name,
  description: "5",
  based_on_family_size: true,
  based_on_sector: false,
  is_additional_pack: false,
  sector_id: null,
  sector_ids: [],
  applies_to_all_disasters: true,
  created_by: null,
  is_active: true,
  items: [],
  disaster_types: [],
});

const restoreTestDoubles = () => {
  pool.connect = originalPoolConnect;
  pool.query = originalPoolQuery;
  Object.assign(reliefPackTemplateRepository, originalRepositoryMethods);
};

test.afterEach(() => {
  restoreTestDoubles();
});

test("createReliefPackTemplate rejects a duplicate name regardless of status or case", async () => {
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => ({
    id: "existing-template",
    name: "standard food pack",
    is_active: false,
  });

  await assert.rejects(
    () =>
      reliefPackTemplateService.createReliefPackTemplate(
        buildTemplateData("  Standard Food Pack  "),
      ),
    (error) => {
      assert.equal(error.message, duplicateNameMessage);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_NAME_DUPLICATE");
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("updateReliefPackTemplate rejects a duplicate name before changing the current template", async () => {
  const currentTemplate = {
    id: "current-template",
    name: "Current Food Pack",
    description: "5",
    based_on_family_size: true,
    based_on_sector: false,
    is_additional_pack: false,
    sector_id: null,
    applies_to_all_disasters: true,
    is_active: true,
  };
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => currentTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => ({
    id: "other-template",
    name: "Existing Food Pack",
    is_active: true,
  });

  await assert.rejects(
    () =>
      reliefPackTemplateService.updateReliefPackTemplate(
        "current-template",
        {
          ...buildTemplateData("existing food pack"),
          is_active: false,
        },
      ),
    (error) => {
      assert.equal(error.message, duplicateNameMessage);
      assert.equal(error.statusCode, 409);
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("setReliefPackTemplateStatus refuses to activate an empty template", async () => {
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => ({
    id: "inactive-template",
    name: "Draft Food Pack",
    is_active: false,
  });
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];

  await assert.rejects(
    () =>
      reliefPackTemplateService.setReliefPackTemplateStatus(
        "inactive-template",
        true,
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_EMPTY");
      assert.match(error.message, /at least one inventory item/i);
      return true;
    },
  );
});

test("setReliefPackTemplateStatus blocks deactivation during an active event", async () => {
  const queries = [];
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };

  pool.connect = async () => fakeClient;
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => ({
    id: "active-template",
    name: "Food Pack",
    is_active: true,
  });
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDeactivationBlockersByTemplateId =
    async () => ({
      active_event_distribution_count: 1,
      unsynced_distribution_count: 0,
    });

  await assert.rejects(
    () =>
      reliefPackTemplateService.setReliefPackTemplateStatus(
        "active-template",
        false,
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED");
      assert.match(error.message, /event is active/i);
      return true;
    },
  );

  assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
});

test("setReliefPackTemplateStatus blocks deactivation while a distribution is unsynced", async () => {
  const queries = [];
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };

  pool.connect = async () => fakeClient;
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => ({
    id: "active-template",
    name: "Food Pack",
    is_active: true,
  });
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDeactivationBlockersByTemplateId =
    async () => ({
      active_event_distribution_count: 0,
      unsynced_distribution_count: 1,
    });

  await assert.rejects(
    () =>
      reliefPackTemplateService.setReliefPackTemplateStatus(
        "active-template",
        false,
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED");
      assert.match(error.message, /distribution is ongoing/i);
      return true;
    },
  );

  assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
});

test("setReliefPackTemplateStatus allows deactivation after events end and distributions sync", async () => {
  const queries = [];
  const activeTemplate = {
    id: "active-template",
    name: "Food Pack",
    is_active: true,
  };
  const inactiveTemplate = {
    ...activeTemplate,
    is_active: false,
  };
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };
  let getTemplateCallCount = 0;

  pool.connect = async () => fakeClient;
  pool.query = async () => ({ rows: [] });
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => {
    getTemplateCallCount += 1;
    return getTemplateCallCount >= 3 ? inactiveTemplate : activeTemplate;
  };
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDeactivationBlockersByTemplateId =
    async () => ({
      active_event_distribution_count: 0,
      unsynced_distribution_count: 0,
    });
  reliefPackTemplateRepository.updateReliefPackTemplateStatus = async (
    id,
    isActive,
  ) => ({
    id,
    is_active: isActive,
  });

  const result =
    await reliefPackTemplateService.setReliefPackTemplateStatus(
      "active-template",
      false,
    );

  assert.equal(result.id, inactiveTemplate.id);
  assert.equal(result.is_active, false);
  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
});

test("createReliefPackTemplate maps a database name uniqueness race to a clear conflict", async () => {
  const queries = [];
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };
  const uniqueViolation = new Error("duplicate key value violates unique constraint");
  uniqueViolation.code = "23505";
  uniqueViolation.constraint = "relief_pack_templates_name_normalized_unique";

  pool.connect = async () => fakeClient;
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.insertReliefPackTemplate = async () => {
    throw uniqueViolation;
  };

  await assert.rejects(
    () =>
      reliefPackTemplateService.createReliefPackTemplate({
        ...buildTemplateData(),
        is_active: false,
      }),
    (error) => {
      assert.equal(error.message, duplicateNameMessage);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_NAME_DUPLICATE");
      return true;
    },
  );

  assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
});

test("createReliefPackTemplate allows legacy inventory items with zero stock", async () => {
  const queries = [];
  const insertedItems = [];
  const legacyInventoryItem = {
    id: "zero-stock-item",
    item_code: "WATER-001",
    item_name: "Water",
    category: "Non-Perishable",
    unit_of_measure: "pc",
    barcode: null,
    is_perishable: false,
    is_active: false,
    item_total_stock: 0,
  };
  const createdTemplate = {
    id: "zero-stock-template",
    name: "Zero Stock Pack",
    description: "5",
    based_on_family_size: true,
    based_on_sector: false,
    is_additional_pack: false,
    sector_id: null,
    applies_to_all_disasters: true,
    is_active: true,
  };
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };

  pool.connect = async () => fakeClient;
  pool.query = async () => ({ rows: [] });
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getInventoryItemById = async () => legacyInventoryItem;
  reliefPackTemplateRepository.insertReliefPackTemplate = async () => createdTemplate;
  reliefPackTemplateRepository.insertReliefPackTemplateItem = async (item) => {
    insertedItems.push(item);
    return item;
  };
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => createdTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [
    {
      id: "template-item-1",
      inventory_item_id: legacyInventoryItem.id,
      quantity_required: 2,
      item_code: legacyInventoryItem.item_code,
      item_name: legacyInventoryItem.item_name,
      category: legacyInventoryItem.category,
      unit_of_measure: legacyInventoryItem.unit_of_measure,
      barcode: legacyInventoryItem.barcode,
      is_perishable: legacyInventoryItem.is_perishable,
      is_active: legacyInventoryItem.is_active,
    },
  ];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];

  const result = await reliefPackTemplateService.createReliefPackTemplate({
    ...buildTemplateData("Zero Stock Pack"),
    items: [
      {
        inventory_item_id: legacyInventoryItem.id,
        quantity_required: 2,
      },
    ],
  });

  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
  assert.deepEqual(insertedItems, [
    {
      template_id: createdTemplate.id,
      inventory_item_id: legacyInventoryItem.id,
      quantity_required: 2,
    },
  ]);
  assert.equal(result.items_count, 1);
});

test("createReliefPackTemplate refuses an active template without items", async () => {
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;

  await assert.rejects(
    () =>
      reliefPackTemplateService.createReliefPackTemplate({
        ...buildTemplateData("Empty Active Pack"),
        is_active: true,
        items: [],
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_EMPTY");
      assert.match(error.message, /at least one inventory item/i);
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("updateReliefPackTemplate preserves an inactive status when is_active is omitted", async () => {
  const currentTemplate = {
    ...buildTemplateData("Original Inactive Pack"),
    id: "inactive-template",
    is_active: false,
  };
  const existingItems = [
    {
      inventory_item_id: "existing-item",
      quantity_required: 1,
      item_name: "Existing item",
      is_active: true,
    },
  ];
  const queries = [];
  let updatePayload = null;
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };

  pool.connect = async () => fakeClient;
  pool.query = async () => ({ rows: [] });
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => currentTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () =>
    existingItems;
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.updateReliefPackTemplate = async (id, payload) => {
    updatePayload = { id, payload };
    return { ...currentTemplate, ...payload };
  };
  reliefPackTemplateRepository.deleteReliefPackTemplateDisasterTypesByTemplateId =
    async () => {};

  const updateData = {
    ...buildTemplateData("Renamed Inactive Pack"),
    is_active: undefined,
  };
  delete updateData.items;

  const result = await reliefPackTemplateService.updateReliefPackTemplate(
    currentTemplate.id,
    updateData,
  );

  assert.equal(updatePayload.payload.is_active, false);
  assert.equal(result.is_active, false);
  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
});

test("updateReliefPackTemplate refuses to activate an empty template", async () => {
  const currentTemplate = {
    ...buildTemplateData("Empty Inactive Pack"),
    id: "empty-template",
    is_active: false,
  };
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => currentTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];

  const updateData = {
    ...buildTemplateData("Empty Inactive Pack"),
    is_active: true,
  };
  delete updateData.items;

  await assert.rejects(
    () =>
      reliefPackTemplateService.updateReliefPackTemplate(
        currentTemplate.id,
        updateData,
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_EMPTY");
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("createReliefPackTemplate applies usage edit locks when reusing an inactive template", async () => {
  const inactiveTemplate = {
    ...buildTemplateData("Reused Food Pack"),
    id: "inactive-template",
    is_active: false,
  };
  const existingItems = [
    {
      inventory_item_id: "old-item",
      quantity_required: 1,
    },
  ];
  const activeItem = {
    id: "new-item",
    item_code: "NEW-001",
    item_name: "New item",
    is_active: true,
  };
  const usageRows = [
    {
      disaster_type: "Flood",
      disaster_event_status: "ACTIVE",
      distributions_count: 1,
      active_event_distributions_count: 1,
      unsynced_distributions_count: 0,
      edit_blocking_distributions_count: 1,
    },
  ];
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () =>
    inactiveTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () =>
    inactiveTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () =>
    existingItems;
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () =>
    usageRows;
  reliefPackTemplateRepository.getInventoryItemById = async () => activeItem;

  await assert.rejects(
    () =>
      reliefPackTemplateService.createReliefPackTemplate({
        ...buildTemplateData("Reused Food Pack"),
        is_active: true,
        items: [
          {
            inventory_item_id: activeItem.id,
            quantity_required: 1,
          },
        ],
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /currently used by an active event/i);
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("updateReliefPackTemplate allows definition and item edits after closed synced usage", async () => {
  const currentTemplate = {
    ...buildTemplateData("Original Food Pack"),
    id: "template-1",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
  const existingItems = [
    {
      inventory_item_id: "old-item",
      quantity_required: 1,
      item_code: "OLD-001",
      item_name: "Old item",
      category: "Food",
      unit_of_measure: "pc",
      is_active: true,
    },
  ];
  const updatedItems = [
    {
      inventory_item_id: "new-item",
      quantity_required: 2,
    },
  ];
  const usageRows = [
    {
      disaster_type: "Flood",
      disaster_event_status: "CLOSED",
      distributions_count: 1,
      active_event_distributions_count: 0,
      unsynced_distributions_count: 0,
      edit_blocking_distributions_count: 0,
    },
  ];
  const queries = [];
  const insertedItems = [];
  let updatePayload = null;
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    },
    release() {},
  };

  pool.connect = async () => fakeClient;
  pool.query = async () => ({ rows: [] });
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => currentTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () =>
    existingItems;
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () =>
    usageRows;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getInventoryItemById = async (id) =>
    id === "new-item"
      ? {
          id,
          item_code: "NEW-001",
          item_name: "New item",
          category: "Food",
          unit_of_measure: "pc",
          is_active: true,
        }
      : null;
  reliefPackTemplateRepository.updateReliefPackTemplate = async (
    id,
    payload,
  ) => {
    updatePayload = { id, payload };
    return { ...currentTemplate, ...payload };
  };
  reliefPackTemplateRepository.deleteReliefPackTemplateItemsByTemplateId =
    async () => {};
  reliefPackTemplateRepository.insertReliefPackTemplateItem = async (item) => {
    insertedItems.push(item);
    return item;
  };
  reliefPackTemplateRepository.deleteReliefPackTemplateDisasterTypesByTemplateId =
    async () => {};

  const result = await reliefPackTemplateService.updateReliefPackTemplate(
    "template-1",
    {
      ...buildTemplateData("Renamed Food Pack"),
      items: updatedItems,
    },
  );

  assert.equal(result.id, "template-1");
  assert.equal(updatePayload.payload.name, "Renamed Food Pack");
  assert.deepEqual(insertedItems, [
    {
      template_id: "template-1",
      inventory_item_id: "new-item",
      quantity_required: 2,
    },
  ]);
  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
});

test("updateReliefPackTemplate still locks definition edits during active or unsynced usage", async () => {
  const currentTemplate = {
    ...buildTemplateData("Original Food Pack"),
    id: "template-1",
  };
  const usageRows = [
    {
      disaster_type: "Flood",
      disaster_event_status: "ACTIVE",
      distributions_count: 1,
      active_event_distributions_count: 1,
      unsynced_distributions_count: 0,
      edit_blocking_distributions_count: 1,
    },
  ];

  pool.connect = async () => {
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => currentTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () =>
    usageRows;

  await assert.rejects(
    () =>
      reliefPackTemplateService.updateReliefPackTemplate(
        "template-1",
        {
          ...buildTemplateData("Renamed Food Pack"),
          is_active: false,
        },
      ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /currently used by an active event/i);
      return true;
    },
  );
});

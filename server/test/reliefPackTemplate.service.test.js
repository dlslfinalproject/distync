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
        buildTemplateData("existing food pack"),
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

test("setReliefPackTemplateStatus refuses templates with disabled inventory items", async () => {
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => ({
    id: "inactive-template",
    name: "Draft Food Pack",
    is_active: false,
  });
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [
    {
      inventory_item_id: "disabled-item",
      quantity_required: 1,
    },
  ];
  reliefPackTemplateRepository.getInventoryItemById = async () => ({
    id: "disabled-item",
    is_active: false,
  });

  await assert.rejects(
    () =>
      reliefPackTemplateService.setReliefPackTemplateStatus(
        "inactive-template",
        true,
      ),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /disabled.*cannot be added/i);
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
    () => reliefPackTemplateService.createReliefPackTemplate(buildTemplateData()),
    (error) => {
      assert.equal(error.message, duplicateNameMessage);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "RELIEF_PACK_TEMPLATE_NAME_DUPLICATE");
      return true;
    },
  );

  assert.deepEqual(queries, ["BEGIN", "ROLLBACK"]);
});

test("createReliefPackTemplate rejects disabled inventory items", async () => {
  let connectCalled = false;

  pool.connect = async () => {
    connectCalled = true;
    throw new Error("The database connection should not be needed");
  };
  reliefPackTemplateRepository.getInactiveReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getReliefPackTemplateByName = async () => null;
  reliefPackTemplateRepository.getInventoryItemById = async () => ({
    id: "inactive-item",
    item_name: "Archived Water",
    item_total_stock: 25,
    is_active: false,
  });

  await assert.rejects(
    () =>
      reliefPackTemplateService.createReliefPackTemplate({
        ...buildTemplateData("Disabled Item Pack"),
        items: [
          {
            inventory_item_id: "inactive-item",
            quantity_required: 1,
          },
        ],
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /disabled.*cannot be added/i);
      assert.match(error.message, /inactive-item/);
      return true;
    },
  );

  assert.equal(connectCalled, false);
});

test("createReliefPackTemplate allows active inventory items with zero stock", async () => {
  const queries = [];
  const insertedItems = [];
  const activeItem = {
    id: "zero-stock-item",
    item_code: "WATER-001",
    item_name: "Water",
    category: "Non-Perishable",
    unit_of_measure: "pc",
    barcode: null,
    is_perishable: false,
    is_active: true,
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
  reliefPackTemplateRepository.getInventoryItemById = async () => activeItem;
  reliefPackTemplateRepository.insertReliefPackTemplate = async () => createdTemplate;
  reliefPackTemplateRepository.insertReliefPackTemplateItem = async (item) => {
    insertedItems.push(item);
    return item;
  };
  reliefPackTemplateRepository.getReliefPackTemplateById = async () => createdTemplate;
  reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId = async () => [
    {
      id: "template-item-1",
      inventory_item_id: activeItem.id,
      quantity_required: 2,
      item_code: activeItem.item_code,
      item_name: activeItem.item_name,
      category: activeItem.category,
      unit_of_measure: activeItem.unit_of_measure,
      barcode: activeItem.barcode,
      is_perishable: activeItem.is_perishable,
      is_active: activeItem.is_active,
    },
  ];
  reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId =
    async () => [];
  reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId = async () => [];

  const result = await reliefPackTemplateService.createReliefPackTemplate({
    ...buildTemplateData("Zero Stock Pack"),
    items: [
      {
        inventory_item_id: activeItem.id,
        quantity_required: 2,
      },
    ],
  });

  assert.deepEqual(queries, ["BEGIN", "COMMIT"]);
  assert.deepEqual(insertedItems, [
    {
      template_id: createdTemplate.id,
      inventory_item_id: activeItem.id,
      quantity_required: 2,
    },
  ]);
  assert.equal(result.items_count, 1);
});

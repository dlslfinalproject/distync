const pool = require("../config/db");
const donationRepository = require("../repositories/donation.repository");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const {
  logAuditSafely,
  pickDefined,
  normalizeActor,
} = require("../utils/systemLog");
const systemLogRepository = require("../repositories/systemLog.repository");

const buildFullName = (firstName, lastName) => {
  return [firstName, lastName].filter(Boolean).join(" ");
};

const priorityRank = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const mapDonationNeed = (row) => {
  return {
    id: row.id,
    disaster_event_id: row.disaster_event_id,
    inventory_item_id: row.inventory_item_id,
    quantity_needed: row.quantity_needed,
    priority_level: row.priority_level,
    notes: row.notes,
    is_active: row.is_active,
    published_by: row.published_by,
    published_at: row.published_at,
    updated_at: row.updated_at,
    disaster_event: {
      id: row.disaster_event_id,
      event_code: row.event_code,
      title: row.disaster_event_title,
    },
    inventory_item: {
      id: row.inventory_item_id,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
    },
    publisher: row.published_by
      ? {
          id: row.published_by,
          full_name: buildFullName(
            row.published_by_first_name,
            row.published_by_last_name,
          ),
        }
      : null,
  };
};

const mapDonationItem = (row) => {
  return {
    id: row.id,
    donation_id: row.donation_id,
    inventory_item_id: row.inventory_item_id,
    inventory_batch_id: row.inventory_batch_id,
    quantity_received: row.quantity_received,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    inventory_item: {
      id: row.inventory_item_id,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
    },
    inventory_batch: row.inventory_batch_id
      ? {
          id: row.inventory_batch_id,
          batch_no: row.batch_no,
          source_type: row.source_type,
          quantity_available: row.quantity_available,
          expiration_date: row.expiration_date,
          storage_location: row.storage_location,
        }
      : null,
  };
};

const mapDonation = (row, items = []) => {
  return {
    id: row.id,
    disaster_event_id: row.disaster_event_id,
    donor_name: row.donor_name,
    donor_type: row.donor_type,
    contact_information: row.contact_information,
    received_by: row.received_by,
    received_at: row.received_at,
    status: row.status,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    disaster_event: {
      id: row.disaster_event_id,
      event_code: row.event_code,
      title: row.disaster_event_title,
    },
    receiver: row.received_by
      ? {
          id: row.received_by,
          full_name: buildFullName(
            row.received_by_first_name,
            row.received_by_last_name,
          ),
        }
      : null,
    items,
    item_count: items.length,
    total_quantity_received: items.reduce(
      (total, item) => total + Number(item.quantity_received || 0),
      0,
    ),
  };
};

const summarizeDonation = (donation) =>
  pickDefined(donation, [
    "disaster_event_id",
    "donor_name",
    "donor_type",
    "contact_information",
    "received_by",
    "received_at",
    "status",
    "remarks",
    "item_count",
    "total_quantity_received",
  ]);

const mapAuditLogRow = (row) => ({
  id: row.id,
  action: row.action,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  role_code: row.role_code,
  created_at: row.created_at,
  actor_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || "Unknown User",
  old_values_json: row.old_values_json || {},
  new_values_json: row.new_values_json || {},
});

const getBatchStatus = (expirationDate, quantityAvailable) => {
  if (expirationDate) {
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const parsedExpiration = new Date(expirationDate);

    if (parsedExpiration < todayDateOnly) {
      return "EXPIRED";
    }
  }

  if (quantityAvailable === 0) {
    return "DEPLETED";
  }

  if (quantityAvailable > 0 && quantityAvailable <= 10) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const buildDonationBatchNumber = ({ donationId, inventoryItemId }) => {
  const donationSegment = String(donationId).replace(/-/g, "").slice(0, 8);
  const itemSegment = String(inventoryItemId).replace(/-/g, "").slice(0, 6);
  const uniqueSegment = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`.toUpperCase();

  return `DON-${donationSegment}-${itemSegment}-${uniqueSegment}`;
};

const ensureDisasterEvent = async (disasterEventId, dbClient) => {
  const disasterEvent = await donationRepository.getDisasterEventById(
    disasterEventId,
    dbClient,
  );

  if (!disasterEvent) {
    const error = new Error("disaster_event_id does not refer to an existing disaster event");
    error.statusCode = 400;
    throw error;
  }

  return disasterEvent;
};

const ensureInventoryItem = async (inventoryItemId, dbClient) => {
  const inventoryItem = await donationRepository.getInventoryItemById(
    inventoryItemId,
    dbClient,
  );

  if (!inventoryItem) {
    const error = new Error("inventory_item_id does not refer to an existing inventory item");
    error.statusCode = 400;
    throw error;
  }

  return inventoryItem;
};

const ensureUser = async (userId, fieldName, dbClient) => {
  const user = await donationRepository.getUserById(userId, dbClient);

  if (!user) {
    const error = new Error(`${fieldName} does not refer to an existing user`);
    error.statusCode = 400;
    throw error;
  }

  return user;
};

const attachDonationItems = async (donationId, dbClient = pool) => {
  const items = await donationRepository.getDonationItemsByDonationId(
    donationId,
    dbClient,
  );

  return items.map(mapDonationItem);
};

const buildInventoryTransactionRemarks = ({
  donationName,
  inventoryItemName,
  action,
  remarks,
}) => {
  const baseMessage = `${action} donation stock for ${inventoryItemName} from ${donationName}`;

  if (!remarks) {
    return baseMessage;
  }

  return `${baseMessage}. ${remarks}`;
};

const createOrAttachDonationBatch = async ({
  donation,
  inventoryItem,
  donationItemPayload,
  createdBy,
  dbClient,
}) => {
  if (donationItemPayload.inventory_batch_id) {
    const existingBatch = await donationRepository.getInventoryBatchByIdForUpdate(
      donationItemPayload.inventory_batch_id,
      dbClient,
    );

    if (!existingBatch) {
      const error = new Error("inventory_batch_id does not refer to an existing inventory batch");
      error.statusCode = 400;
      throw error;
    }

    if (existingBatch.inventory_item_id !== inventoryItem.id) {
      const error = new Error(
        "inventory_batch_id must belong to the selected inventory item",
      );
      error.statusCode = 400;
      throw error;
    }

    const nextQuantityReceived =
      Number(existingBatch.quantity_received) + donationItemPayload.quantity_received;
    const nextQuantityAvailable =
      Number(existingBatch.quantity_available) + donationItemPayload.quantity_received;

    const nextStatus = getBatchStatus(
      donationItemPayload.expiration_date || existingBatch.expiration_date,
      nextQuantityAvailable,
    );

    await donationRepository.updateInventoryBatchStock(
      existingBatch.id,
      {
        quantity_received: nextQuantityReceived,
        quantity_available: nextQuantityAvailable,
        expiration_date:
          donationItemPayload.expiration_date || existingBatch.expiration_date,
        storage_location:
          donationItemPayload.storage_location || existingBatch.storage_location,
        status: nextStatus,
      },
      dbClient,
    );

    return existingBatch.id;
  }

  const createdBatch = await donationRepository.insertInventoryBatch(
    {
      inventory_item_id: inventoryItem.id,
      batch_no: buildDonationBatchNumber({
        donationId: donation.id,
        inventoryItemId: inventoryItem.id,
      }),
      source_type: "DONATED",
      quantity_received: donationItemPayload.quantity_received,
      quantity_available: donationItemPayload.quantity_received,
      expiration_date: donationItemPayload.expiration_date,
      received_at: donation.received_at,
      storage_location: donationItemPayload.storage_location,
      status: getBatchStatus(
        donationItemPayload.expiration_date,
        donationItemPayload.quantity_received,
      ),
      created_by: createdBy,
    },
    dbClient,
  );

  return createdBatch.id;
};

const createDonationItemWithInventory = async ({
  donation,
  donationItemPayload,
  performedBy,
  dbClient,
}) => {
  const inventoryItem = await ensureInventoryItem(
    donationItemPayload.inventory_item_id,
    dbClient,
  );

  const inventoryBatchId = await createOrAttachDonationBatch({
    donation,
    inventoryItem,
    donationItemPayload,
    createdBy: performedBy,
    dbClient,
  });

  const createdDonationItem = await donationRepository.insertDonationItem(
    {
      donation_id: donation.id,
      inventory_item_id: inventoryItem.id,
      inventory_batch_id: inventoryBatchId,
      quantity_received: donationItemPayload.quantity_received,
      remarks: donationItemPayload.remarks,
    },
    dbClient,
  );

  await donationRepository.insertInventoryTransaction(
    {
      disaster_event_id: donation.disaster_event_id,
      inventory_batch_id: inventoryBatchId,
      transaction_type: "INFLOW",
      quantity: donationItemPayload.quantity_received,
      reference_type: "DONATION",
      reference_id: createdDonationItem.id,
      performed_by: performedBy,
      remarks: buildInventoryTransactionRemarks({
        donationName: donation.donor_name,
        inventoryItemName: inventoryItem.item_name,
        action: "Received",
        remarks: donationItemPayload.remarks,
      }),
    },
    dbClient,
  );

  return createdDonationItem.id;
};

const removeDonationItemWithinTransaction = async ({
  donationItem,
  donation,
  performedBy,
  dbClient,
}) => {
  const batch = await donationRepository.getInventoryBatchByIdForUpdate(
    donationItem.inventory_batch_id,
    dbClient,
  );

  if (!batch) {
    const error = new Error("Linked inventory batch not found");
    error.statusCode = 404;
    throw error;
  }

  const quantityReceived = Number(donationItem.quantity_received);
  const currentAvailable = Number(batch.quantity_available);

  if (currentAvailable < quantityReceived) {
    const error = new Error(
      "This donation item can no longer be deleted because part of the donated stock has already been distributed or used",
    );
    error.statusCode = 409;
    throw error;
  }

  const nextAvailable = currentAvailable - quantityReceived;
  const nextReceived = Number(batch.quantity_received) - quantityReceived;

  await donationRepository.updateInventoryBatchStock(
    batch.id,
    {
      quantity_received: nextReceived,
      quantity_available: nextAvailable,
      expiration_date: batch.expiration_date,
      storage_location: batch.storage_location,
      status: getBatchStatus(batch.expiration_date, nextAvailable),
    },
    dbClient,
  );

  const inventoryItem = await ensureInventoryItem(
    donationItem.inventory_item_id,
    dbClient,
  );

  await donationRepository.insertInventoryTransaction(
    {
      disaster_event_id: donation.disaster_event_id,
      inventory_batch_id: batch.id,
      transaction_type: "OUTFLOW",
      quantity: quantityReceived,
      reference_type: "DONATION",
      reference_id: donationItem.id,
      performed_by: performedBy,
      remarks: buildInventoryTransactionRemarks({
        donationName: donation.donor_name,
        inventoryItemName: inventoryItem.item_name,
        action: "Removed",
        remarks: donationItem.remarks,
      }),
    },
    dbClient,
  );

  await donationRepository.deleteDonationItem(donationItem.id, dbClient);

  return {
    batchId: batch.id,
    batchNo: batch.batch_no,
    previousQuantityAvailable: currentAvailable,
    previousStatus: batch.status,
    nextQuantityAvailable: nextAvailable,
    nextStatus: getBatchStatus(batch.expiration_date, nextAvailable),
    expirationDate: batch.expiration_date,
    itemName: inventoryItem.item_name,
    quantityRemoved: quantityReceived,
    disasterEventId: donation.disaster_event_id,
  };
};

const getDonationNeeds = async (filters = {}) => {
  const donationNeeds = await donationRepository.getDonationNeeds(filters);
  return donationNeeds.map(mapDonationNeed);
};

const createDonationNeed = async (payload, publishedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureDisasterEvent(payload.disaster_event_id, client);
    await ensureInventoryItem(payload.inventory_item_id, client);
    await ensureUser(publishedBy, "published_by", client);

    const createdNeed = await donationRepository.insertDonationNeed(
      {
        ...payload,
        published_by: publishedBy,
      },
      client,
    );

    await client.query("COMMIT");

    const donationNeed = await donationRepository.getDonationNeedById(
      createdNeed.id,
      pool,
    );

    return mapDonationNeed(donationNeed);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonationNeed = async (id, payload) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNeed = await donationRepository.getDonationNeedById(id, client);

    if (!existingNeed) {
      const error = new Error("Donation need not found");
      error.statusCode = 404;
      throw error;
    }

    await ensureDisasterEvent(payload.disaster_event_id, client);
    await ensureInventoryItem(payload.inventory_item_id, client);

    await donationRepository.updateDonationNeed(id, payload, client);
    await client.query("COMMIT");

    const donationNeed = await donationRepository.getDonationNeedById(id, pool);
    return mapDonationNeed(donationNeed);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationNeed = async (id) => {
  const deletedNeed = await donationRepository.deleteDonationNeed(id, pool);

  if (!deletedNeed) {
    const error = new Error("Donation need not found");
    error.statusCode = 404;
    throw error;
  }

  return deletedNeed;
};

const getDonations = async (filters = {}) => {
  const donations = await donationRepository.getDonations(filters);

  return Promise.all(
    donations.map(async (donation) => {
      const items = await attachDonationItems(donation.id);
      return mapDonation(donation, items);
    }),
  );
};

const getDonationById = async (id) => {
  const donation = await donationRepository.getDonationById(id);

  if (!donation) {
    return null;
  }

  const items = await attachDonationItems(id);
  return mapDonation(donation, items);
};

const getDonationDetail = async (id) => {
  const [donation, stockUpdateHistory, auditLogs] = await Promise.all([
    getDonationById(id),
    donationRepository.getDonationInventoryTransactions(id),
    systemLogRepository.getAuditLogsByEntity({
      entityType: "DONATION",
      entityId: id,
      limit: 20,
    }),
  ]);

  if (!donation) {
    return null;
  }

  return {
    donation,
    stock_update_history: stockUpdateHistory,
    audit_history: auditLogs.map(mapAuditLogRow),
  };
};

const createDonation = async (payload, actor) => {
  const normalizedActor = normalizeActor(actor);
  const receivedBy = normalizedActor.userId;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureDisasterEvent(payload.disaster_event_id, client);
    await ensureUser(receivedBy, "received_by", client);

    const createdDonation = await donationRepository.insertDonation(
      {
        ...payload,
        received_by: receivedBy,
      },
      client,
    );

    const donationRecord = await donationRepository.getDonationByIdForUpdate(
      createdDonation.id,
      client,
    );

    for (const item of payload.items || []) {
      await createDonationItemWithInventory({
        donation: donationRecord,
        donationItemPayload: item,
        performedBy: receivedBy,
        dbClient: client,
      });
    }

    await client.query("COMMIT");
    const createdDonationRecord = await getDonationById(createdDonation.id);

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationSummaryUpdate({
        donorName: createdDonationRecord.donor_name,
        itemCount: createdDonationRecord.items.length,
        disasterEventId: createdDonationRecord.disaster_event_id,
        referenceId: createdDonationRecord.id,
      });

      for (const item of createdDonationRecord.items) {
        await notificationService.emitBatchAlerts({
          batch: {
            id: item.inventory_batch?.id,
            batch_no: item.inventory_batch?.batch_no,
            quantity_available: item.inventory_batch?.quantity_available,
            status: item.inventory_batch?.source_type === "DONATED"
              ? getBatchStatus(
                  item.inventory_batch?.expiration_date,
                  item.inventory_batch?.quantity_available,
                )
              : null,
            expiration_date: item.inventory_batch?.expiration_date,
            item_name: item.inventory_item?.item_name,
          },
          disasterEventId: createdDonationRecord.disaster_event_id,
        });
      }
    });

    await logAuditSafely({
      actor: normalizedActor,
      action: "DONATION_CREATE",
      entityType: "DONATION",
      entityId: createdDonationRecord.id,
      oldValues: {},
      newValues: summarizeDonation(createdDonationRecord),
    });

    return createdDonationRecord;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonation = async (id, payload, actor = null) => {
  const normalizedActor = normalizeActor(actor);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonation = await donationRepository.getDonationByIdForUpdate(
      id,
      client,
    );

    if (!existingDonation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    const previousDonationSummary = summarizeDonation(existingDonation);

    await ensureDisasterEvent(payload.disaster_event_id, client);

    await donationRepository.updateDonation(id, payload, client);
    await client.query("COMMIT");

    const updatedDonation = await getDonationById(id);

    await logAuditSafely({
      actor: normalizedActor,
      action: "DONATION_UPDATE",
      entityType: "DONATION",
      entityId: id,
      oldValues: previousDonationSummary,
      newValues: summarizeDonation(updatedDonation),
    });

    return updatedDonation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createDonationItem = async (donationId, payload, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const donation = await donationRepository.getDonationByIdForUpdate(
      donationId,
      client,
    );

    if (!donation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    await ensureUser(performedBy, "performed_by", client);

    const createdDonationItemId = await createDonationItemWithInventory({
      donation,
      donationItemPayload: payload,
      performedBy,
      dbClient: client,
    });

    await client.query("COMMIT");

    const donationItem = await donationRepository.getDonationItemById(
      createdDonationItemId,
      pool,
    );
    const mappedDonationItem = mapDonationItem(donationItem);

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: mappedDonationItem.inventory_item?.item_name || "Donation item",
        quantity: mappedDonationItem.quantity_received,
        disasterEventId: donation.disaster_event_id,
        referenceId: mappedDonationItem.id,
        actionLabel: "received",
      });

      await notificationService.emitBatchAlerts({
        batch: {
          id: mappedDonationItem.inventory_batch?.id,
          batch_no: mappedDonationItem.inventory_batch?.batch_no,
          quantity_available: mappedDonationItem.inventory_batch?.quantity_available,
          status: getBatchStatus(
            mappedDonationItem.inventory_batch?.expiration_date,
            mappedDonationItem.inventory_batch?.quantity_available,
          ),
          expiration_date: mappedDonationItem.inventory_batch?.expiration_date,
          item_name: mappedDonationItem.inventory_item?.item_name,
        },
        disasterEventId: donation.disaster_event_id,
      });
    });

    return mappedDonationItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonationItem = async (id, payload, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonationItem =
      await donationRepository.getDonationItemByIdForUpdate(id, client);

    if (!existingDonationItem) {
      const error = new Error("Donation item not found");
      error.statusCode = 404;
      throw error;
    }

    const donation = await donationRepository.getDonationByIdForUpdate(
      existingDonationItem.donation_id,
      client,
    );

    if (!donation) {
      const error = new Error("Parent donation not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      payload.inventory_item_id &&
      payload.inventory_item_id !== existingDonationItem.inventory_item_id
    ) {
      const error = new Error(
        "inventory_item_id cannot be changed for an existing donation item",
      );
      error.statusCode = 400;
      throw error;
    }

    const batch = await donationRepository.getInventoryBatchByIdForUpdate(
      existingDonationItem.inventory_batch_id,
      client,
    );

    if (!batch) {
      const error = new Error("Linked inventory batch not found");
      error.statusCode = 404;
      throw error;
    }

    const nextQuantity = payload.quantity_received;
    const quantityDelta = nextQuantity - Number(existingDonationItem.quantity_received);
    const currentAvailable = Number(batch.quantity_available);
    const currentReceived = Number(batch.quantity_received);

    let nextAvailable = currentAvailable;
    let nextReceived = currentReceived;

    if (quantityDelta > 0) {
      nextAvailable += quantityDelta;
      nextReceived += quantityDelta;
    }

    if (quantityDelta < 0) {
      const quantityToRemove = Math.abs(quantityDelta);

      if (currentAvailable < quantityToRemove) {
        const error = new Error(
          "Unable to reduce the donated quantity because part of the donated stock has already been distributed or used",
        );
        error.statusCode = 409;
        throw error;
      }

      nextAvailable -= quantityToRemove;
      nextReceived -= quantityToRemove;
    }

    await donationRepository.updateInventoryBatchStock(
      batch.id,
      {
        quantity_received: nextReceived,
        quantity_available: nextAvailable,
        expiration_date: payload.expiration_date || batch.expiration_date,
        storage_location: payload.storage_location || batch.storage_location,
        status: getBatchStatus(
          payload.expiration_date || batch.expiration_date,
          nextAvailable,
        ),
      },
      client,
    );

    await donationRepository.updateDonationItem(
      id,
      {
        quantity_received: nextQuantity,
        remarks: payload.remarks,
      },
      client,
    );

    if (quantityDelta !== 0) {
      const inventoryItem = await ensureInventoryItem(
        existingDonationItem.inventory_item_id,
        client,
      );

      await donationRepository.insertInventoryTransaction(
        {
          disaster_event_id: donation.disaster_event_id,
          inventory_batch_id: batch.id,
          transaction_type: quantityDelta > 0 ? "INFLOW" : "OUTFLOW",
          quantity: Math.abs(quantityDelta),
          reference_type: "DONATION",
          reference_id: id,
          performed_by: performedBy,
          remarks: buildInventoryTransactionRemarks({
            donationName: donation.donor_name,
            inventoryItemName: inventoryItem.item_name,
            action: quantityDelta > 0 ? "Adjusted up" : "Adjusted down",
            remarks: payload.remarks,
          }),
        },
        client,
      );
    }

    await client.query("COMMIT");

    const donationItem = await donationRepository.getDonationItemById(id, pool);
    const mappedDonationItem = mapDonationItem(donationItem);

    if (quantityDelta !== 0) {
      await notificationService.emitSafely(async () => {
        await notificationService.emitDonationStockUpdate({
          donorName: donation.donor_name,
          itemName: mappedDonationItem.inventory_item?.item_name || "Donation item",
          quantity: Math.abs(quantityDelta),
          disasterEventId: donation.disaster_event_id,
          referenceId: mappedDonationItem.id,
          actionLabel: quantityDelta > 0 ? "adjusted upward" : "adjusted downward",
          severity: quantityDelta > 0 ? "INFO" : "WARNING",
          anomaly: quantityDelta < 0,
        });

        await notificationService.emitBatchAlerts({
          batch: {
            id: mappedDonationItem.inventory_batch?.id,
            batch_no: mappedDonationItem.inventory_batch?.batch_no,
            quantity_available: mappedDonationItem.inventory_batch?.quantity_available,
            status: getBatchStatus(
              mappedDonationItem.inventory_batch?.expiration_date,
              mappedDonationItem.inventory_batch?.quantity_available,
            ),
            expiration_date: mappedDonationItem.inventory_batch?.expiration_date,
            item_name: mappedDonationItem.inventory_item?.item_name,
          },
          previousQuantityAvailable: currentAvailable,
          previousStatus: batch.status,
          disasterEventId: donation.disaster_event_id,
        });
      });
    }

    return mappedDonationItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationItem = async (id, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonationItem =
      await donationRepository.getDonationItemByIdForUpdate(id, client);

    if (!existingDonationItem) {
      const error = new Error("Donation item not found");
      error.statusCode = 404;
      throw error;
    }

    const donation = await donationRepository.getDonationByIdForUpdate(
      existingDonationItem.donation_id,
      client,
    );

    if (!donation) {
      const error = new Error("Parent donation not found");
      error.statusCode = 404;
      throw error;
    }

    const removalSummary = await removeDonationItemWithinTransaction({
      donationItem: existingDonationItem,
      donation,
      performedBy,
      dbClient: client,
    });
    await client.query("COMMIT");

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: removalSummary.itemName,
        quantity: removalSummary.quantityRemoved,
        disasterEventId: donation.disaster_event_id,
        referenceId: id,
        actionLabel: "removed",
        severity: "WARNING",
        anomaly: true,
      });

      await notificationService.emitBatchAlerts({
        batch: {
          id: removalSummary.batchId,
          batch_no: removalSummary.batchNo,
          quantity_available: removalSummary.nextQuantityAvailable,
          status: removalSummary.nextStatus,
          expiration_date: removalSummary.expirationDate,
          item_name: removalSummary.itemName,
        },
        previousQuantityAvailable: removalSummary.previousQuantityAvailable,
        previousStatus: removalSummary.previousStatus,
        disasterEventId: removalSummary.disasterEventId,
      });
    });

    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationRecord = async (id, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const donation = await donationRepository.getDonationByIdForUpdate(id, client);

    if (!donation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    const donationItems = await donationRepository.getDonationItemsByDonationId(
      id,
      client,
    );

    for (const donationItem of donationItems) {
      await removeDonationItemWithinTransaction({
        donationItem,
        donation,
        performedBy,
        dbClient: client,
      });
    }

    await donationRepository.deleteDonation(id, client);
    await client.query("COMMIT");

    await notificationService.emitSafely(() =>
      notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: "donation record items",
        quantity: donationItems.length,
        disasterEventId: donation.disaster_event_id,
        referenceId: id,
        actionLabel: "removed",
        severity: "WARNING",
        anomaly: true,
      }),
    );

    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getPublicDonationPortal = async (disasterEventId = null) => {
  const [activeNeeds, summaryTotals, perItemSummary] = await Promise.all([
    donationRepository.getPublicDonationNeeds(disasterEventId),
    donationRepository.getDonationSummaryTotals(disasterEventId),
    donationRepository.getDonationItemTransparencySummary(disasterEventId),
  ]);

  const groupedEventMap = new Map();

  activeNeeds.forEach((need) => {
    if (!groupedEventMap.has(need.disaster_event_id)) {
      groupedEventMap.set(need.disaster_event_id, {
        id: need.disaster_event_id,
        event_code: need.event_code,
        title: need.disaster_event_title,
        need_count: 0,
      });
    }

    groupedEventMap.get(need.disaster_event_id).need_count += 1;
  });

  return {
    disaster_events: [...groupedEventMap.values()],
    selected_disaster_event_id: disasterEventId,
    donation_needs: activeNeeds
      .map(mapDonationNeed)
      .sort((left, right) => {
        const priorityDifference =
          (priorityRank[left.priority_level] || 999) -
          (priorityRank[right.priority_level] || 999);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return left.inventory_item.item_name.localeCompare(
          right.inventory_item.item_name,
        );
      }),
    transparency_summary: {
      ...summaryTotals,
      received_vs_distributed: perItemSummary.map((row) => ({
        inventory_item_id: row.inventory_item_id,
        item_code: row.item_code,
        item_name: row.item_name,
        unit_of_measure: row.unit_of_measure,
        quantity_received: row.quantity_received,
        quantity_distributed: row.quantity_distributed,
        quantity_remaining: row.quantity_remaining,
      })),
    },
  };
};

const exportDonationTransparencyReport = async (disasterEventId = null, format) => {
  const rows = await donationRepository.getDonationTransparencyExportRows(
    disasterEventId,
  );

  if (rows.length === 0) {
    const error = new Error("No donation transparency records are available to export.");
    error.statusCode = 404;
    throw error;
  }

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-donor-transparency-summary",
    worksheetName: "Donor Transparency",
    reportTitle: "Donor Transparency Summary",
    metadata: [
      { label: "Disaster Event Filter", value: disasterEventId || "All" },
    ],
    columns: [
      { key: "donor_name", label: "Donor Name", width: 28, pdfWidth: 150 },
      { key: "item_name", label: "Item Name", width: 28, pdfWidth: 150 },
      { key: "quantity_received", label: "Quantity Received", width: 18, pdfWidth: 72 },
      { key: "quantity_distributed", label: "Quantity Distributed", width: 18, pdfWidth: 72 },
      { key: "remaining_stock", label: "Remaining Stock", width: 18, pdfWidth: 72 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getDonationNeeds,
  createDonationNeed,
  updateDonationNeed,
  deleteDonationNeed,
  getDonations,
  getDonationById,
  getDonationDetail,
  createDonation,
  updateDonation,
  createDonationItem,
  updateDonationItem,
  deleteDonationItem,
  deleteDonationRecord,
  getPublicDonationPortal,
  exportDonationTransparencyReport,
};

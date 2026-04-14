const express = require("express");
const pool = require("../config/db");
const disasterEventRoutes = require("./disasterEvent.routes");
const inventoryBatchRoutes = require("./inventoryBatch.routes");
const inventoryTransactionRoutes = require("./inventoryTransaction.routes");
const distributionTransactionRoutes = require("./distributionTransaction.routes");
const evacuationCenterRoutes = require("./evacuationCenter.routes");
const householdRegistrationRoutes = require("./householdRegistration.routes");
const inventoryItemRoutes = require("./inventoryItem.routes");
const masterlistRoutes = require("./masterlist.routes");
const reliefPackTemplateRoutes = require("./reliefPackTemplate.routes");
const sectorRoutes = require("./sector.routes");
const stubRoutes = require("./stub.routes");
const supplierRoutes = require("./supplier.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "DISTYNC API is running",
  });
});

router.get("/roles", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, name, description FROM roles ORDER BY name ASC",
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch roles",
      error: error.message,
    });
  }
});

router.get("/barangays", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, code, name FROM barangays ORDER BY name ASC",
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch barangays",
      error: error.message,
    });
  }
});

router.use("/disaster-events", disasterEventRoutes);
router.use("/inventory-batches", inventoryBatchRoutes);
router.use("/inventory-transactions", inventoryTransactionRoutes);
router.use("/distribution-transactions", distributionTransactionRoutes);
router.use("/evacuation-centers", evacuationCenterRoutes);
router.use("/households", householdRegistrationRoutes);
router.use("/inventory-items", inventoryItemRoutes);
router.use("/masterlist", masterlistRoutes);
router.use("/relief-pack-templates", reliefPackTemplateRoutes);
router.use("/sectors", sectorRoutes);
router.use("/stubs", stubRoutes);
router.use("/suppliers", supplierRoutes);

module.exports = router;

const express = require("express");
const pool = require("../config/db");
const disasterEventRoutes = require("./disasterEvent.routes");
const householdRegistrationRoutes = require("./householdRegistration.routes");
const masterlistRoutes = require("./masterlist.routes");
const sectorRoutes = require("./sector.routes");

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
router.use("/households", householdRegistrationRoutes);
router.use("/masterlist", masterlistRoutes);
router.use("/sectors", sectorRoutes);

module.exports = router;

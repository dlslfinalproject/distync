const express = require("express");

const sectorService = require("../services/sector.service");

const router = express.Router();

const sendSectorResponse = (res, message, data) => {
  return res.status(200).json({
    message,
    data,
  });
};

router.get("/", async (req, res) => {
  try {
    const sectors = await sectorService.getAllSectors();

    return sendSectorResponse(res, "Sectors fetched successfully", sectors);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch sectors",
      error: error.message,
    });
  }
});

router.get("/person", async (req, res) => {
  try {
    const sectors = await sectorService.getPersonSectors();

    return sendSectorResponse(
      res,
      "Person-level sectors fetched successfully",
      sectors,
    );
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch person-level sectors",
      error: error.message,
    });
  }
});

router.get("/household", async (req, res) => {
  try {
    const sectors = await sectorService.getHouseholdSectors();

    return sendSectorResponse(
      res,
      "Household-level sectors fetched successfully",
      sectors,
    );
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch household-level sectors",
      error: error.message,
    });
  }
});

router.get("/barangay", async (req, res) => {
  try {
    const sectors = await sectorService.getBarangayVisibleSectors();

    return sendSectorResponse(
      res,
      "Barangay-visible sectors fetched successfully",
      sectors,
    );
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch barangay-visible sectors",
      error: error.message,
    });
  }
});

router.get("/mswdo", async (req, res) => {
  try {
    const sectors = await sectorService.getMswdoVisibleSectors();

    return sendSectorResponse(
      res,
      "MSWDO-visible sectors fetched successfully",
      sectors,
    );
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch MSWDO-visible sectors",
      error: error.message,
    });
  }
});

module.exports = router;

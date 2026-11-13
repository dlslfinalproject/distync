const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const evacuationCenterService = require("../services/evacuationCenter.service");
const {
  validateBarangayIdParam,
} = require("../validators/evacuationCenter.validator");

const router = express.Router();

router.get(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  async (req, res) => {
  try {
    const centers = await evacuationCenterService.getEvacuationCenters();

    return res.status(200).json(centers);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch evacuation centers",
      error: error.message,
    });
  }
  },
);

router.get(
  "/barangay/:barangayId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateBarangayIdParam,
  async (req, res) => {
  try {
    const centers = await evacuationCenterService.getEvacuationCentersByBarangayId(
      req.params.barangayId,
    );

    return res.status(200).json(centers);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch evacuation centers by barangay",
      error: error.message,
    });
  }
  },
);

module.exports = router;

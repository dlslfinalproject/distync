const express = require("express");

const masterlistService = require("../services/masterlist.service");
const { validateGetMasterlist } = require("../validators/masterlist.validator");

const router = express.Router();

router.get("/", validateGetMasterlist, async (req, res) => {
  try {
    const masterlist = await masterlistService.getMasterlist(req.validatedQuery);

    return res.status(200).json(masterlist);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch masterlist",
    });
  }
});

module.exports = router;

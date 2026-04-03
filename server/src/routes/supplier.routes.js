const express = require("express");

const supplierService = require("../services/supplier.service");
const {
  validateSupplierId,
  validateGetSuppliers,
  validateSupplierPayload,
} = require("../validators/supplier.validator");

const router = express.Router();

router.get("/", validateGetSuppliers, async (req, res) => {
  try {
    const suppliers = await supplierService.getSuppliers(req.validatedQuery);

    return res.status(200).json(suppliers);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch suppliers",
    });
  }
});

router.get("/:id", validateSupplierId, async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);

    if (!supplier) {
      return res.status(404).json({
        message: "Supplier not found",
      });
    }

    return res.status(200).json(supplier);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch supplier",
    });
  }
});

router.post("/", validateSupplierPayload, async (req, res) => {
  try {
    const supplier = await supplierService.createSupplier(req.validatedBody);

    return res.status(201).json({
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create supplier",
    });
  }
});

router.put(
  "/:id",
  validateSupplierId,
  validateSupplierPayload,
  async (req, res) => {
    try {
      const supplier = await supplierService.updateSupplier(
        req.params.id,
        req.validatedBody,
      );

      return res.status(200).json({
        message: "Supplier updated successfully",
        data: supplier,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update supplier",
      });
    }
  },
);

module.exports = router;

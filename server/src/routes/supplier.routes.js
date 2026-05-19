const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const supplierService = require("../services/supplier.service");
const {
  validateSupplierId,
  validateGetSuppliers,
  validateSupplierPayload,
} = require("../validators/supplier.validator");

const router = express.Router();

router.get(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateGetSuppliers,
  async (req, res) => {
  try {
    const suppliers = await supplierService.getSuppliers(req.validatedQuery);

    return res.status(200).json(suppliers);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch suppliers",
    });
  }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateSupplierId,
  async (req, res) => {
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
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateSupplierPayload,
  async (req, res) => {
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
  },
);

router.put(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
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

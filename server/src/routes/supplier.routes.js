const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const supplierService = require("../services/supplier.service");
const { ALLOWED_EXPORT_FORMATS } = require("../utils/mayorReportExport");
const {
  validateSupplierId,
  validateGetSuppliers,
  validateSupplierPayload,
} = require("../validators/supplier.validator");

const router = express.Router();

const resolveExportFormat = (format) => {
  const normalizedFormat = String(format || "csv").toLowerCase();
  return ALLOWED_EXPORT_FORMATS.includes(normalizedFormat)
    ? normalizedFormat
    : null;
};

router.get(
  "/export",
  requireRoles(ROLE_CODES.MAYOR),
  validateGetSuppliers,
  async (req, res) => {
    try {
      const exportFormat = resolveExportFormat(req.query.format);

      if (!exportFormat) {
        return res.status(400).json({
          message: "format must be one of: csv, excel, pdf",
        });
      }

      const file = await supplierService.exportSuppliers(
        req.validatedQuery,
        exportFormat,
      );

      res.setHeader("Content-Type", file.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`,
      );

      return res.status(200).send(file.buffer);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to export suppliers",
      });
    }
  },
);

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

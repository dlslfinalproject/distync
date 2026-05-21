const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const donationService = require("../services/donation.service");
const { ALLOWED_EXPORT_FORMATS } = require("../utils/mayorReportExport");
const {
  validateDonationNeedId,
  validateDonationNeedFilters,
  validateDonationNeedPayload,
  validateDonationId,
  validateDonationFilters,
  validateDonationPayload,
  validateDonationUpdatePayload,
  validateDonationItemId,
  validateDonationItemPayload,
  validatePublicDonationPortal,
} = require("../validators/donation.validator");

const router = express.Router();

const resolveExportFormat = (format) => {
  const normalizedFormat = String(format || "csv").toLowerCase();
  return ALLOWED_EXPORT_FORMATS.includes(normalizedFormat)
    ? normalizedFormat
    : null;
};

router.get(
  "/public-portal",
  validatePublicDonationPortal,
  async (req, res) => {
    try {
      const payload = await donationService.getPublicDonationPortal(
        req.validatedQuery.disaster_event_id,
      );

      return res.status(200).json(payload);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to load donor portal data",
      });
    }
  },
);

router.get(
  "/export/transparency",
  requireRoles(ROLE_CODES.MAYOR),
  validatePublicDonationPortal,
  async (req, res) => {
    try {
      const exportFormat = resolveExportFormat(req.query.format);

      if (!exportFormat) {
        return res.status(400).json({
          message: "format must be one of: csv, excel, pdf",
        });
      }

      const file = await donationService.exportDonationTransparencyReport(
        req.validatedQuery.disaster_event_id,
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
        message: error.message || "Failed to export donor transparency summary",
      });
    }
  },
);

router.get(
  "/needs",
  requireRoles(ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateDonationNeedFilters,
  async (req, res) => {
    try {
      const donationNeeds = await donationService.getDonationNeeds(req.validatedQuery);
      return res.status(200).json(donationNeeds);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch donation needs",
      });
    }
  },
);

router.post(
  "/needs",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationNeedPayload,
  async (req, res) => {
    try {
      const donationNeed = await donationService.createDonationNeed(
        req.validatedBody,
        req.auth.userId,
      );

      return res.status(201).json({
        message: "Donation need created successfully",
        data: donationNeed,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to create donation need",
      });
    }
  },
);

router.put(
  "/needs/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationNeedId,
  validateDonationNeedPayload,
  async (req, res) => {
    try {
      const donationNeed = await donationService.updateDonationNeed(
        req.params.id,
        req.validatedBody,
      );

      return res.status(200).json({
        message: "Donation need updated successfully",
        data: donationNeed,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update donation need",
      });
    }
  },
);

router.delete(
  "/needs/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationNeedId,
  async (req, res) => {
    try {
      await donationService.deleteDonationNeed(req.params.id);

      return res.status(200).json({
        message: "Donation need deleted successfully",
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to delete donation need",
      });
    }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationFilters,
  async (req, res) => {
    try {
      const donations = await donationService.getDonations(req.validatedQuery);
      return res.status(200).json(donations);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch donations",
      });
    }
  },
);

router.get(
  "/:id/detail",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationId,
  async (req, res) => {
    try {
      const payload = await donationService.getDonationDetail(req.params.id);

      if (!payload) {
        return res.status(404).json({
          message: "Donation not found",
        });
      }

      return res.status(200).json({
        data: payload,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch donation detail",
      });
    }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationId,
  async (req, res) => {
    try {
      const donation = await donationService.getDonationById(req.params.id);

      if (!donation) {
        return res.status(404).json({
          message: "Donation not found",
        });
      }

      return res.status(200).json(donation);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch donation",
      });
    }
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationPayload,
  async (req, res) => {
    try {
      const donation = await donationService.createDonation(
        req.validatedBody,
        req.auth,
      );

      return res.status(201).json({
        message: "Donation recorded successfully",
        data: donation,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to record donation",
      });
    }
  },
);

router.put(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationId,
  validateDonationUpdatePayload,
  async (req, res) => {
    try {
      const donation = await donationService.updateDonation(
        req.params.id,
        req.validatedBody,
        req.auth,
      );

      return res.status(200).json({
        message: "Donation updated successfully",
        data: donation,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update donation",
      });
    }
  },
);

router.delete(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationId,
  async (req, res) => {
    try {
      await donationService.deleteDonationRecord(req.params.id, req.auth.userId);

      return res.status(200).json({
        message: "Donation deleted successfully",
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to delete donation",
      });
    }
  },
);

router.post(
  "/:id/items",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationId,
  validateDonationItemPayload,
  async (req, res) => {
    try {
      const donationItem = await donationService.createDonationItem(
        req.params.id,
        req.validatedBody,
        req.auth.userId,
      );

      return res.status(201).json({
        message: "Donation item recorded successfully",
        data: donationItem,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to record donation item",
      });
    }
  },
);

router.put(
  "/items/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationItemId,
  validateDonationItemPayload,
  async (req, res) => {
    try {
      const donationItem = await donationService.updateDonationItem(
        req.params.id,
        req.validatedBody,
        req.auth.userId,
      );

      return res.status(200).json({
        message: "Donation item updated successfully",
        data: donationItem,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update donation item",
      });
    }
  },
);

router.delete(
  "/items/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateDonationItemId,
  async (req, res) => {
    try {
      await donationService.deleteDonationItem(req.params.id, req.auth.userId);

      return res.status(200).json({
        message: "Donation item deleted successfully",
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to delete donation item",
      });
    }
  },
);

module.exports = router;

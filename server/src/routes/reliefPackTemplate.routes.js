const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const reliefPackTemplateService = require("../services/reliefPackTemplate.service");
const {
  validateReliefPackTemplateId,
  validateReliefPackTemplateStatus,
  validateGetReliefPackTemplates,
  validateCreateReliefPackTemplate,
  validateUpdateReliefPackTemplate,
  validateReplaceReliefPackTemplateItems,
} = require("../validators/reliefPackTemplate.validator");

const router = express.Router();

router.get(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetReliefPackTemplates,
  async (req, res) => {
  try {
    const templates = await reliefPackTemplateService.getReliefPackTemplates(
      req.validatedQuery,
    );

    return res.status(200).json(templates);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch relief pack templates",
    });
  }
  },
);

router.patch(
  "/:id/status",
  requireRoles(ROLE_CODES.MAYOR),
  validateReliefPackTemplateId,
  validateReliefPackTemplateStatus,
  async (req, res) => {
    try {
      const template = await reliefPackTemplateService.setReliefPackTemplateStatus(
        req.params.id,
        req.validatedBody.is_active,
        {
          userId: req.auth.userId,
          roleCode: req.auth.roleCode,
          ipAddress: req.ip,
        },
      );

      return res.status(200).json({
        message: `Relief pack template ${template.is_active ? "activated" : "deactivated"} successfully`,
        data: template,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update relief pack template status",
        code: error.code || null,
      });
    }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateReliefPackTemplateId,
  async (req, res) => {
  try {
    const template = await reliefPackTemplateService.getReliefPackTemplateById(
      req.params.id,
    );

    if (!template) {
      return res.status(404).json({
        message: "Relief pack template not found",
      });
    }

    return res.status(200).json(template);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch relief pack template",
    });
  }
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateCreateReliefPackTemplate,
  async (req, res) => {
  try {
    const template =
      await reliefPackTemplateService.createReliefPackTemplate(
        {
          ...req.validatedBody,
          created_by: req.auth.userId,
        },
        {
          userId: req.auth.userId,
          roleCode: req.auth.roleCode,
          ipAddress: req.ip,
        },
      );

    return res.status(201).json({
      message: "Relief pack template created successfully",
      data: template,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create relief pack template",
    });
  }
  },
);

router.put(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateReliefPackTemplateId,
  validateUpdateReliefPackTemplate,
  async (req, res) => {
    try {
      const template =
        await reliefPackTemplateService.updateReliefPackTemplate(
          req.params.id,
          req.validatedBody,
          {
            userId: req.auth.userId,
            roleCode: req.auth.roleCode,
            ipAddress: req.ip,
          },
        );

      return res.status(200).json({
        message: "Relief pack template updated successfully",
        data: template,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update relief pack template",
      });
    }
  },
);

router.put(
  "/:id/items",
  requireRoles(ROLE_CODES.MAYOR),
  validateReliefPackTemplateId,
  validateReplaceReliefPackTemplateItems,
  async (req, res) => {
    try {
      const template =
        await reliefPackTemplateService.replaceReliefPackTemplateItems(
          req.params.id,
          req.validatedBody,
          {
            userId: req.auth.userId,
            roleCode: req.auth.roleCode,
            ipAddress: req.ip,
          },
        );

      return res.status(200).json({
        message: "Relief pack template items updated successfully",
        data: template,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update relief pack template items",
      });
    }
  },
);

module.exports = router;

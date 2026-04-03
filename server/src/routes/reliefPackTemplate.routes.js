const express = require("express");

const reliefPackTemplateService = require("../services/reliefPackTemplate.service");
const {
  validateReliefPackTemplateId,
  validateGetReliefPackTemplates,
  validateCreateReliefPackTemplate,
  validateUpdateReliefPackTemplate,
  validateReplaceReliefPackTemplateItems,
} = require("../validators/reliefPackTemplate.validator");

const router = express.Router();

router.get("/", validateGetReliefPackTemplates, async (req, res) => {
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
});

router.get("/:id", validateReliefPackTemplateId, async (req, res) => {
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
});

router.post("/", validateCreateReliefPackTemplate, async (req, res) => {
  try {
    const template =
      await reliefPackTemplateService.createReliefPackTemplate(
        req.validatedBody,
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
});

router.put(
  "/:id",
  validateReliefPackTemplateId,
  validateUpdateReliefPackTemplate,
  async (req, res) => {
    try {
      const template =
        await reliefPackTemplateService.updateReliefPackTemplate(
          req.params.id,
          req.validatedBody,
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
  validateReliefPackTemplateId,
  validateReplaceReliefPackTemplateItems,
  async (req, res) => {
    try {
      const template =
        await reliefPackTemplateService.replaceReliefPackTemplateItems(
          req.params.id,
          req.validatedBody,
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

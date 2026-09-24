const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const householdRegistrationService = require("../services/householdRegistration.service");
const syncService = require("../services/sync.service");
const { logErrorSafely } = require("../utils/systemLog");
const {
  validateCreateHouseholdRegistration,
  validateDuplicateRegistrationSuggestions,
  validateDepartHousehold,
  validateGetHouseholdDetails,
  validateUpdateHouseholdDetails,
  validateArchiveHousehold,
  validateRestoreHousehold,
  validateCorrectEvacuationLog,
} = require("../validators/householdRegistration.validator");

const router = express.Router();

const DUPLICATE_HOUSEHOLD_REGISTRATION_CODE =
  "DUPLICATE_HOUSEHOLD_REGISTRATION";

const logHouseholdRegistrationAnomalySource = async ({ req, error }) => {
  if (error?.code !== DUPLICATE_HOUSEHOLD_REGISTRATION_CODE) {
    return;
  }

  await logErrorSafely({
    actor: req.auth,
    moduleName: "household-registration",
    errorCode: error.code,
    errorMessage:
      error.message ||
      "Possible duplicate household registration detected.",
    severity: "WARNING",
    error: null,
    referenceType: error.entityServerId ? "HOUSEHOLD" : null,
    referenceId: error.entityServerId || null,
    context: {
      route: req.originalUrl,
      action: "DIRECT_DUPLICATE_HOUSEHOLD_REGISTRATION",
      disaster_event_id: req.validatedBody?.disaster_event_id || null,
      barangay_id: req.validatedBody?.barangay_id || null,
      matched_as: error.serverPayload?.matched_as || null,
      matched_relationship_to_head:
        error.serverPayload?.matched_relationship_to_head || null,
      match_confidence: error.serverPayload?.match_confidence || null,
    },
  });
};

router.post(
  "/duplicate-suggestions",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateDuplicateRegistrationSuggestions,
  async (req, res) => {
    try {
      const suggestions =
        await householdRegistrationService.getDuplicateRegistrationSuggestions({
          ...req.validatedBody,
          registered_by: req.auth.userId,
          requester: req.auth,
        });

      return res.status(200).json({
        message: "Duplicate registration suggestions retrieved successfully",
        data: suggestions,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch duplicate registration suggestions",
      });
    }
  },
);

router.post(
  "/register",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateCreateHouseholdRegistration,
  async (req, res) => {
    try {
      const clientSyncId = String(req.get("X-Client-Sync-ID") || "").trim();
      const entityLocalId = String(req.get("X-Entity-Local-ID") || "").trim();
      const clientTimestamp = String(req.get("X-Client-Timestamp") || "").trim();
      if (
        !clientSyncId ||
        clientSyncId.length > 80 ||
        !/^[A-Za-z0-9:_-]+$/.test(clientSyncId) ||
        !entityLocalId ||
        !clientTimestamp ||
        Number.isNaN(new Date(clientTimestamp).getTime())
      ) {
        return res.status(400).json({
          code: "REGISTRATION_IDEMPOTENCY_REQUIRED",
          message:
            "A stable registration operation ID and client timestamp are required.",
        });
      }

      const actionKey =
        req.validatedBody.registration_operation ===
        "CREATE_NEW_HOUSEHOLD_OCCURRENCE"
          ? "HOUSEHOLD_RE_ADMISSION"
          : "HOUSEHOLD_REGISTER";
      const [syncResult] = await syncService.processSyncEntries({
        auth: req.auth,
        entries: [
          {
            client_sync_id: clientSyncId,
            action_key: actionKey,
            entity_type: "HOUSEHOLD",
            entity_local_id: entityLocalId,
            entity_server_id: null,
            device_id: req.auth.deviceId || null,
            client_timestamp: clientTimestamp,
            client_updated_at: clientTimestamp,
            payload: req.validatedBody,
          },
        ],
      });

      if (syncResult?.sync_status !== "SYNCED") {
        const errorCode = syncResult?.error_code || null;
        const isPhotoStorageFailure =
          errorCode === "FAMILY_HEAD_PHOTO_STORAGE_UNAVAILABLE" ||
          errorCode === "FAMILY_HEAD_PHOTO_UPLOAD_FAILED" ||
          errorCode === "FAMILY_HEAD_PHOTO_RETRIEVAL_FAILED";
        const isValidationFailure = String(errorCode || "").includes(
          "VALIDATION",
        );
        const statusCode =
          Number(syncResult?.status_code) ||
          (syncResult?.sync_status === "CONFLICT"
            ? 409
            : isPhotoStorageFailure
              ? 503
              : isValidationFailure
                ? 400
                : syncResult?.sync_status === "PENDING"
                ? 503
                : 409);
        const error = new Error(
          syncResult?.message || "Household registration did not complete.",
        );
        error.code = errorCode || "HOUSEHOLD_REGISTRATION_NOT_SYNCED";
        error.statusCode = statusCode;
        error.entityServerId =
          syncResult?.conflict?.entity_server_id ||
          syncResult?.data?.entity_server_id ||
          syncResult?.data?.id ||
          null;
        error.serverPayload =
          syncResult?.conflict?.server_payload_json ||
          syncResult?.conflict?.server_payload ||
          null;
        throw error;
      }

      const acceptedResult = syncResult.data || {};
      const acceptedHouseholdId =
        acceptedResult.id || acceptedResult.household?.id || null;
      let registrationResult = acceptedResult;
      if (acceptedHouseholdId) {
        const refreshedDetails =
          await householdRegistrationService.getHouseholdDetails({
            householdId: acceptedHouseholdId,
            requester: req.auth,
          });
        registrationResult = {
          ...refreshedDetails,
          ...(acceptedResult.active_cross_event_information
            ? {
                active_cross_event_information:
                  acceptedResult.active_cross_event_information,
              }
            : {}),
          ...(acceptedResult.registration_operation
            ? { registration_operation: acceptedResult.registration_operation }
            : {}),
          ...(acceptedResult.source_household_id
            ? { source_household_id: acceptedResult.source_household_id }
            : {}),
        };
      }

      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.status(201).json({
        message: "Household registered successfully",
        data: registrationResult,
        client_sync_id: clientSyncId,
        sync_status: syncResult.sync_status,
      });
    } catch (error) {
      await logHouseholdRegistrationAnomalySource({ req, error });
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to register household",
      });
    }
  },
);

router.get(
  "/:householdId/family-head-photo",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetHouseholdDetails,
  async (req, res) => {
    try {
      const photo = await householdRegistrationService.getFamilyHeadPhotoForRequester({
        householdId: req.validatedParams.householdId,
        requester: req.auth,
      });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.status(200).json({
        data: {
          photo_url: photo.url,
          expires_at: photo.expiresAt,
          available: photo.available,
          error_code: photo.errorCode || null,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        code: error.code || null,
        message: error.message || "Failed to retrieve family-head photo",
      });
    }
  },
);

router.get(
  "/:householdId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateGetHouseholdDetails,
  async (req, res) => {
    try {
      const householdDetails =
        await householdRegistrationService.getHouseholdDetails({
          householdId: req.validatedParams.householdId,
          evacuationLogId: req.validatedQuery?.evacuationLogId || null,
          requester: req.auth,
        });

      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      return res.status(200).json({
        message: "Household details retrieved successfully",
        data: householdDetails,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to fetch household details",
      });
    }
  },
);

router.patch(
  "/:householdId",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateUpdateHouseholdDetails,
  async (req, res) => {
    try {
      const householdDetails =
        await householdRegistrationService.updateHouseholdDetails({
          householdId: req.validatedParams.householdId,
          requester: req.auth,
          requestData: {
            ...req.validatedBody,
            registered_by: req.auth.userId,
          },
        });

      return res.status(200).json({
        message: "Household updated successfully",
        data: householdDetails,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to update household",
      });
    }
  },
);

router.patch(
  "/:householdId/archive",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateArchiveHousehold,
  async (req, res) => {
    try {
      const archiveResult = await householdRegistrationService.archiveHousehold({
        householdId: req.validatedParams.householdId,
        requester: req.auth,
        archiveData: req.validatedBody,
      });

      return res.status(200).json({
        message: "Household archived successfully",
        data: archiveResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to archive household",
      });
    }
  },
);

router.patch(
  "/:householdId/restore",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateRestoreHousehold,
  async (req, res) => {
    try {
      const restoreResult = await householdRegistrationService.restoreHousehold({
        householdId: req.validatedParams.householdId,
        requester: req.auth,
        restoreData: req.validatedBody,
      });

      return res.status(200).json({
        message: "Household re-admitted successfully",
        data: restoreResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to re-admit household",
      });
    }
  },
);

router.patch(
  "/:householdId/evacuation-logs/:evacuationLogId/correct",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateCorrectEvacuationLog,
  async (req, res) => {
    try {
      const correctionResult =
        await householdRegistrationService.correctEvacuationLog({
          householdId: req.validatedParams.householdId,
          evacuationLogId: req.validatedParams.evacuationLogId,
          requester: req.auth,
          correctionData: req.validatedBody,
        });

      return res.status(200).json({
        message: "Evacuation log corrected successfully",
        data: correctionResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        code: error.code || null,
        message: error.message || "Failed to correct evacuation log",
      });
    }
  },
);

router.post(
  "/:householdId/depart",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO),
  validateDepartHousehold,
  async (req, res) => {
    try {
      const departureResult =
        await householdRegistrationService.departHousehold(
          req.validatedParams.householdId,
          req.validatedBody,
          req.auth,
        );

      return res.status(200).json({
        message: "Household departure recorded successfully and archived automatically",
        data: departureResult,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to record household departure",
      });
    }
  },
);

module.exports = router;

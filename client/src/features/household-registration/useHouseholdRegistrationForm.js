import { useEffect, useState } from "react";
import {
  cacheRegistrationBarangays,
  cacheRegistrationEvacuationCentersByBarangay,
  cacheRegistrationSectors,
  cacheSelectedDisasterEvent,
  cacheSelectedDisasterEventId,
  cacheRegistrationActiveDisasterEvents,
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchDuplicateRegistrationSuggestions,
  fetchEvacuationCenters,
  fetchEvacuationCentersByBarangay,
  fetchSectors,
  getCachedRegistrationReferenceData,
  registerHousehold,
  updateHousehold,
} from "./householdRegistrationService";
import {
  HOUSEHOLD_PRIVACY_CONFIRMATION_ERROR,
  HOUSEHOLD_PRIVACY_REGISTRATION_ERROR_MESSAGE,
  buildHouseholdPrivacyAcknowledgment,
  requiresHouseholdPrivacyPrompt,
} from "./privacyNotice.mjs";
import { deriveAgeGroup } from "../../utils/ageGroup";
import {
  DISPLAY_MEMBER_SECTOR_CODES,
  HOUSEHOLD_CONDITION_CODES,
  RELATIONSHIP_OPTIONS,
  getCanonicalMemberSectorCode,
  isAgeBasedMemberSectorCode,
} from "../../utils/registrationOptions";

const createMember = () => ({
  id: null,
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  sex: "MALE",
  age_value: "",
  age_unit: "YEARS",
  relationship_option: "",
  relationship_to_head: "",
  custom_relationship: "",
  sector_ids: [],
});

const initialFamilyHead = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  sex: "MALE",
  age_value: "",
  age_unit: "YEARS",
  sector_ids: [],
};

const initialHousehold = {
  current_stay_type: "EVAC_CENTER",
  evacuation_center_id: "",
  current_address_details: "",
  contact_number: "",
};

const createMemberValidationErrors = () => ({
  first_name: "",
  last_name: "",
  age_value: "",
  relationship_option: "",
  custom_relationship: "",
});

const createValidationErrors = () => ({
  selectedBarangayId: "",
  evacuation_center_id: "",
  contact_number: "",
  family_head_photo_url: "",
  familyHead: {
    first_name: "",
    last_name: "",
    age_value: "",
  },
  members: [],
});

const MAX_FAMILY_HEAD_PHOTO_FILE_SIZE = 3 * 1024 * 1024;

const trimValue = (value) => String(value ?? "").trim();

const isWholeNumberString = (value) => /^\d+$/.test(trimValue(value));
const isValidPhilippineContactNumber = (value) => /^\+639\d{9}$/.test(trimValue(value));
const normalizePhilippineContactNumberInput = (value) => {
  const digitsOnly = String(value || "").replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  let localDigits = digitsOnly;

  if (localDigits.startsWith("63")) {
    localDigits = localDigits.slice(2);
  }

  if (localDigits.startsWith("0")) {
    localDigits = localDigits.slice(1);
  }

  return localDigits.slice(0, 10);
};

const buildPhilippineContactNumber = (value) => {
  const localDigits = normalizePhilippineContactNumberInput(value);
  return localDigits ? `+63${localDigits}` : "";
};

const getPhilippineContactNumberLocalPart = (value) => {
  const normalizedValue = trimValue(value);

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.startsWith("+63")) {
    return normalizedValue.slice(3, 13);
  }

  return normalizePhilippineContactNumberInput(normalizedValue);
};

const formatPhilippineContactNumberLocalPart = (value) => {
  const localDigits = getPhilippineContactNumberLocalPart(value);
  const firstGroup = localDigits.slice(0, 3);
  const secondGroup = localDigits.slice(3, 6);
  const thirdGroup = localDigits.slice(6, 10);

  return [firstGroup, secondGroup, thirdGroup].filter(Boolean).join(" ");
};

const normalizeAgeValue = (value) => {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : "";
};

const buildAgeDetails = (ageValue, ageUnit) => {
  const normalizedAgeValue = normalizeAgeValue(ageValue);

  return {
    age_value: normalizedAgeValue,
    age_unit: ageUnit,
    derived_age_sector_code:
      normalizedAgeValue === ""
        ? null
        : deriveAgeGroup(normalizedAgeValue, ageUnit),
  };
};

const getFinalRelationship = (member) => {
  if (member.relationship_option === "OTHERS") {
    return trimValue(member.custom_relationship);
  }

  return trimValue(member.relationship_option);
};

const createEmptyDuplicateSuggestions = () => ({
  total_matches: 0,
  has_strong_matches: false,
  groups: [],
});

const RESIDENCY_STATUS = {
  resident: "RESIDENT",
  nonResident: "NON_RESIDENT",
};

export const useHouseholdRegistrationForm = ({
  isOpen,
  mode = "create",
  initialHouseholdDetails = null,
  defaultBarangayId,
  defaultBarangayName = "",
  defaultDisasterEventId,
  lockBarangaySelection = false,
  hideBarangaySelection = false,
  restrictNonResidentToEvacCenter = false,
  scopeNonResidentEvacuationCentersToBarangay = false,
  registeredBy = null,
  onSuccess,
}) => {
  const isEditMode = mode === "edit";
  const [household, setHousehold] = useState(initialHousehold);
  const [residencyStatus, setResidencyStatus] = useState(
    RESIDENCY_STATUS.resident,
  );
  const [familyHead, setFamilyHead] = useState(initialFamilyHead);
  const [members, setMembers] = useState([]);
  const [householdSectorIds, setHouseholdSectorIds] = useState([]);
  const [familyHeadPhotoUrl, setFamilyHeadPhotoUrl] = useState("");
  const [familyHeadPhotoFileName, setFamilyHeadPhotoFileName] = useState("");
  const [photoVerificationNotes, setPhotoVerificationNotes] = useState("");
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState(
    defaultDisasterEventId || "",
  );
  const [selectedBarangayId, setSelectedBarangayId] = useState(
    defaultBarangayId || "",
  );
  const [memberSectorOptions, setMemberSectorOptions] = useState([]);
  const [householdSectors, setHouseholdSectors] = useState([]);
  const [evacuationCenters, setEvacuationCenters] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [duplicateSuggestions, setDuplicateSuggestions] = useState(
    createEmptyDuplicateSuggestions(),
  );
  const [isLoadingDuplicateSuggestions, setIsLoadingDuplicateSuggestions] =
    useState(false);
  const [duplicateSuggestionsError, setDuplicateSuggestionsError] = useState("");
  const [validationErrors, setValidationErrors] = useState(createValidationErrors());
  const [isUsingCachedReferenceData, setIsUsingCachedReferenceData] =
    useState(false);

  const isOffline =
    typeof navigator !== "undefined" ? !navigator.onLine : false;
  const latestPrivacyConsent = initialHouseholdDetails?.privacy_consent || null;
  const requiresPrivacyAcknowledgment = requiresHouseholdPrivacyPrompt({
    isEditMode,
    privacyConsent: latestPrivacyConsent,
  });
  const selectedDisasterEvent = activeDisasterEvents.find(
    (eventItem) => eventItem.id === selectedDisasterEventId,
  );
  const linkedBarangayIds = Array.isArray(selectedDisasterEvent?.affected_barangays)
    ? selectedDisasterEvent.affected_barangays
        .map((barangay) => barangay?.id)
        .filter(Boolean)
    : [];
  const shouldRestrictBarangaysToSelectedEvent =
    !isEditMode &&
    !hideBarangaySelection &&
    linkedBarangayIds.length > 0;
  const selectableBarangays = shouldRestrictBarangaysToSelectedEvent
    ? barangays.filter((barangay) => linkedBarangayIds.includes(barangay.id))
    : barangays;

  useEffect(() => {
    setSelectedDisasterEventId(defaultDisasterEventId || "");
  }, [defaultDisasterEventId]);

  useEffect(() => {
    cacheSelectedDisasterEventId(selectedDisasterEventId);
  }, [selectedDisasterEventId]);

  useEffect(() => {
    if (selectedDisasterEvent) {
      cacheSelectedDisasterEvent(selectedDisasterEvent);
    }
  }, [selectedDisasterEvent]);

  useEffect(() => {
    if (isEditMode && initialHouseholdDetails) {
      return;
    }

    if (
      residencyStatus === RESIDENCY_STATUS.resident ||
      lockBarangaySelection
    ) {
      setSelectedBarangayId(defaultBarangayId || "");
    }
  }, [
    defaultBarangayId,
    initialHouseholdDetails,
    isEditMode,
    lockBarangaySelection,
    residencyStatus,
  ]);

  useEffect(() => {
    if (
      isEditMode ||
      !isOpen ||
      hideBarangaySelection ||
      lockBarangaySelection ||
      !shouldRestrictBarangaysToSelectedEvent
    ) {
      return;
    }

    const isSelectedBarangayLinked = selectableBarangays.some(
      (barangay) => barangay.id === selectedBarangayId,
    );

    if (!isSelectedBarangayLinked) {
      setSelectedBarangayId(selectableBarangays[0]?.id || "");
      setHousehold((currentValue) => ({
        ...currentValue,
        evacuation_center_id: "",
      }));
    }
  }, [
    hideBarangaySelection,
    isEditMode,
    isOpen,
    lockBarangaySelection,
    selectableBarangays,
    selectedBarangayId,
    shouldRestrictBarangaysToSelectedEvent,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      setErrorMessage("");
      setIsUsingCachedReferenceData(false);

      try {
        const [disasterEventsPayload, sectorsPayload, barangaysPayload] = await Promise.all([
          fetchActiveDisasterEvents(),
          fetchSectors(),
          fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        const disasterEvents = Array.isArray(disasterEventsPayload)
          ? disasterEventsPayload
          : [];
        const sectors = Array.isArray(sectorsPayload.data)
          ? sectorsPayload.data
          : [];
        const availableBarangays = Array.isArray(barangaysPayload)
          ? barangaysPayload.filter(
              (barangay) => barangay.code !== "NON_RESIDENT_OUTSIDE_MALVAR",
            )
          : [];

        setActiveDisasterEvents(disasterEvents);
        setBarangays(availableBarangays);
        cacheRegistrationActiveDisasterEvents(disasterEvents);
        cacheRegistrationBarangays(availableBarangays);

        if (!defaultDisasterEventId && disasterEvents.length > 0) {
          setSelectedDisasterEventId(disasterEvents[0].id);
        }

        if (
          !isEditMode &&
          residencyStatus === RESIDENCY_STATUS.resident &&
          !defaultBarangayId &&
          !lockBarangaySelection &&
          !hideBarangaySelection &&
          availableBarangays.length > 0
        ) {
          setSelectedBarangayId(availableBarangays[0].id);
        }

        const availableMemberSectorsByCanonicalCode = new Map(
          sectors.map((sector) => [
            getCanonicalMemberSectorCode(sector.code),
            sector,
          ]),
        );

        setMemberSectorOptions(
          DISPLAY_MEMBER_SECTOR_CODES.map((sectorCode) =>
            availableMemberSectorsByCanonicalCode.get(sectorCode),
          ).filter(Boolean),
        );
        setHouseholdSectors(
          sectors.filter((sector) =>
            HOUSEHOLD_CONDITION_CODES.includes(sector.code),
          ),
        );
        cacheRegistrationSectors(sectors);
        setIsUsingCachedReferenceData(false);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const cachedReferenceData = getCachedRegistrationReferenceData();
        const cachedDisasterEvents = Array.isArray(
          cachedReferenceData.activeDisasterEvents,
        )
          ? cachedReferenceData.activeDisasterEvents
          : [];
        const cachedSelectedDisasterEvent =
          cachedReferenceData.selectedDisasterEvent &&
          typeof cachedReferenceData.selectedDisasterEvent === "object"
            ? cachedReferenceData.selectedDisasterEvent
            : null;
        const offlineDisasterEvents =
          cachedSelectedDisasterEvent?.id &&
          !cachedDisasterEvents.some(
            (event) => event.id === cachedSelectedDisasterEvent.id,
          )
            ? [cachedSelectedDisasterEvent, ...cachedDisasterEvents]
            : cachedDisasterEvents;
        const cachedSectors = Array.isArray(cachedReferenceData.sectors?.data)
          ? cachedReferenceData.sectors.data
          : [];
        const cachedBarangays = Array.isArray(cachedReferenceData.barangays)
          ? cachedReferenceData.barangays.filter(
              (barangay) => barangay.code !== "NON_RESIDENT_OUTSIDE_MALVAR",
            )
          : [];

        const hasCachedBarangayReference =
          cachedBarangays.length > 0 ||
          Boolean(defaultBarangayId) ||
          hideBarangaySelection ||
          lockBarangaySelection;

        const hasCachedReferences =
          offlineDisasterEvents.length > 0 &&
          cachedSectors.length > 0 &&
          hasCachedBarangayReference;

        if (!hasCachedReferences) {
          setErrorMessage(
            isOffline
              ? "Offline mode: please select an active disaster event while online first."
              : error.message || "Failed to load form options",
          );
          return;
        }

        setActiveDisasterEvents(offlineDisasterEvents);
        setBarangays(cachedBarangays);

        if (!defaultDisasterEventId) {
          if (cachedSelectedDisasterEvent?.id) {
            console.info("Loaded cached disaster event for offline registration");
          }

          setSelectedDisasterEventId(
            cachedSelectedDisasterEvent?.id ||
              cachedReferenceData.selectedDisasterEventId ||
              offlineDisasterEvents[0]?.id ||
              "",
          );
        }

        if (
          !isEditMode &&
          residencyStatus === RESIDENCY_STATUS.resident &&
          !defaultBarangayId &&
          !lockBarangaySelection &&
          !hideBarangaySelection &&
          cachedBarangays.length > 0
        ) {
          setSelectedBarangayId(cachedBarangays[0].id);
        }

        const availableMemberSectorsByCanonicalCode = new Map(
          cachedSectors.map((sector) => [
            getCanonicalMemberSectorCode(sector.code),
            sector,
          ]),
        );

        setMemberSectorOptions(
          DISPLAY_MEMBER_SECTOR_CODES.map((sectorCode) =>
            availableMemberSectorsByCanonicalCode.get(sectorCode),
          ).filter(Boolean),
        );
        setHouseholdSectors(
          cachedSectors.filter((sector) =>
            HOUSEHOLD_CONDITION_CODES.includes(sector.code),
          ),
        );
        setIsUsingCachedReferenceData(true);
        setErrorMessage("");
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [
    defaultBarangayId,
    defaultDisasterEventId,
    hideBarangaySelection,
    initialHouseholdDetails,
    isEditMode,
    isOpen,
    lockBarangaySelection,
    residencyStatus,
  ]);

  useEffect(() => {
    if (!isOpen || !isEditMode || !initialHouseholdDetails) {
      return;
    }

    const detailHousehold = initialHouseholdDetails.household || null;
    const latestAttendance = initialHouseholdDetails.latest_attendance || null;
    const detailMembers = Array.isArray(initialHouseholdDetails.members)
      ? initialHouseholdDetails.members
      : [];
    const familyHeadMember = detailMembers.find((member) => member.is_family_head);
    const additionalMembers = detailMembers.filter((member) => !member.is_family_head);
    const savedEvacuationCenterId = String(
      detailHousehold?.evacuation_center_id ||
        latestAttendance?.evacuation_center_id ||
        "",
    );

    const deriveRelationshipOption = (relationshipToHead) => {
      const matchingOption = RELATIONSHIP_OPTIONS.find(
        (option) => option.value === relationshipToHead,
      );

      return matchingOption ? matchingOption.value : "OTHERS";
    };

    setResidencyStatus(detailHousehold?.residency_status || RESIDENCY_STATUS.resident);
    setSelectedDisasterEventId(detailHousehold?.disaster_event_id || defaultDisasterEventId || "");
    setSelectedBarangayId(detailHousehold?.barangay_id || defaultBarangayId || "");
    setHousehold({
      current_stay_type: detailHousehold?.current_stay_type || "EVAC_CENTER",
      evacuation_center_id: savedEvacuationCenterId,
      current_address_details: detailHousehold?.current_address_details || "",
      contact_number: detailHousehold?.contact_number || "",
    });
    setFamilyHead({
      first_name: detailHousehold?.family_head_first_name || "",
      middle_name: detailHousehold?.family_head_middle_name || "",
      last_name: detailHousehold?.family_head_last_name || "",
      suffix: detailHousehold?.family_head_suffix || "",
      sex: familyHeadMember?.sex || detailHousehold?.sex || "MALE",
      age_value:
        Number.isInteger(familyHeadMember?.age_value)
          ? familyHeadMember.age_value
          : "",
      age_unit: "YEARS",
      sector_ids: (familyHeadMember?.sectors || [])
        .filter((sector) => !isAgeBasedMemberSectorCode(sector.code))
        .map((sector) => sector.id),
    });
    setMembers(
      additionalMembers.map((member) => ({
        id: member.id,
        first_name: member.first_name || "",
        middle_name: member.middle_name || "",
        last_name: member.last_name || "",
        suffix: member.suffix || "",
        sex: member.sex || "MALE",
        age_value:
          Number.isInteger(member.age_value) ? member.age_value : "",
        age_unit: member.age_unit || "YEARS",
        relationship_option: deriveRelationshipOption(member.relationship_to_head),
        relationship_to_head: member.relationship_to_head || "",
        custom_relationship:
          deriveRelationshipOption(member.relationship_to_head) === "OTHERS"
            ? member.relationship_to_head || ""
            : "",
        sector_ids: (member.sectors || [])
          .filter((sector) => !isAgeBasedMemberSectorCode(sector.code))
          .map((sector) => sector.id),
        derived_age_sector_code: deriveAgeGroup(
          member.age_value,
          member.age_unit,
        ),
      })),
    );
    setHouseholdSectorIds(
      (initialHouseholdDetails.household_sectors || []).map((sector) => sector.id),
    );
    setFamilyHeadPhotoUrl(detailHousehold?.family_head_photo_url || "");
    setFamilyHeadPhotoFileName(
      detailHousehold?.family_head_photo_url ? "Registered photo" : "",
    );
    setPhotoVerificationNotes(detailHousehold?.photo_verification_notes || "");
    setErrorMessage("");
    setSuccessMessage("");
    setValidationErrors(createValidationErrors());
  }, [
    defaultBarangayId,
    defaultDisasterEventId,
    initialHouseholdDetails,
    isEditMode,
    isOpen,
  ]);

  useEffect(() => {
    if (!isOpen) {
      setDuplicateSuggestions(createEmptyDuplicateSuggestions());
      setIsLoadingDuplicateSuggestions(false);
      setDuplicateSuggestionsError("");
      return;
    }

    if (!selectedDisasterEventId || !selectedBarangayId) {
      setDuplicateSuggestions(createEmptyDuplicateSuggestions());
      setIsLoadingDuplicateSuggestions(false);
      setDuplicateSuggestionsError("");
      return;
    }

    const normalizedFamilyHead = {
      first_name: trimValue(familyHead.first_name),
      middle_name: trimValue(familyHead.middle_name) || null,
      last_name: trimValue(familyHead.last_name),
      suffix: trimValue(familyHead.suffix) || null,
      sex: familyHead.sex || null,
      age_value: normalizeAgeValue(familyHead.age_value),
      age_unit: "YEARS",
    };
    const normalizedMembers = members.map((member) => ({
      first_name: trimValue(member.first_name),
      middle_name: trimValue(member.middle_name) || null,
      last_name: trimValue(member.last_name),
      suffix: trimValue(member.suffix) || null,
      sex: member.sex || null,
      age_value: normalizeAgeValue(member.age_value),
      age_unit: member.age_unit || null,
      relationship_to_head: getFinalRelationship(member) || null,
    }));
    const hasFamilyHeadLookupCandidate =
      normalizedFamilyHead.first_name && normalizedFamilyHead.last_name;
    const hasMemberLookupCandidate = normalizedMembers.some(
      (member) => member.first_name && member.last_name,
    );
    const hasLookupCandidate =
      hasFamilyHeadLookupCandidate || hasMemberLookupCandidate;

    if (!hasLookupCandidate) {
      setDuplicateSuggestions(createEmptyDuplicateSuggestions());
      setIsLoadingDuplicateSuggestions(false);
      setDuplicateSuggestionsError("");
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingDuplicateSuggestions(true);
      setDuplicateSuggestionsError("");

      try {
        const suggestions = await fetchDuplicateRegistrationSuggestions({
          household_id: initialHouseholdDetails?.household?.id || null,
          disaster_event_id: selectedDisasterEventId,
          barangay_id: selectedBarangayId,
          registered_by: registeredBy,
          contact_number: trimValue(household.contact_number) || null,
          family_head: normalizedFamilyHead,
          members: normalizedMembers,
        });

        if (!isActive) {
          return;
        }

        setDuplicateSuggestions(suggestions || createEmptyDuplicateSuggestions());
      } catch (error) {
        if (!isActive) {
          return;
        }

        setDuplicateSuggestions(createEmptyDuplicateSuggestions());
        setDuplicateSuggestionsError(
          error.message || "Failed to check duplicate registration suggestions.",
        );
      } finally {
        if (isActive) {
          setIsLoadingDuplicateSuggestions(false);
        }
      }
    }, hasFamilyHeadLookupCandidate ? 180 : 320);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    familyHead.age_value,
    familyHead.first_name,
    familyHead.last_name,
    familyHead.middle_name,
    familyHead.sex,
    familyHead.suffix,
    household.contact_number,
    initialHouseholdDetails?.household?.id,
    isOpen,
    members,
    registeredBy,
    selectedBarangayId,
    selectedDisasterEventId,
  ]);

  const savedEditEvacuationCenterId = String(
    initialHouseholdDetails?.household?.evacuation_center_id ||
      initialHouseholdDetails?.latest_attendance?.evacuation_center_id ||
      "",
  );

  useEffect(() => {
    if (!isOpen) {
      setEvacuationCenters([]);
      setHousehold((currentValue) => ({
        ...currentValue,
        evacuation_center_id: "",
      }));
      return;
    }

    let isMounted = true;

    const loadEvacuationCenters = async () => {
      const needsBarangayScopedCenters =
        residencyStatus === RESIDENCY_STATUS.resident ||
        scopeNonResidentEvacuationCentersToBarangay;

      if (needsBarangayScopedCenters && !selectedBarangayId) {
        setEvacuationCenters([]);
        setHousehold((currentValue) => ({
          ...currentValue,
          evacuation_center_id: "",
        }));
        return;
      }

      let centers = needsBarangayScopedCenters
        ? await fetchEvacuationCentersByBarangay(selectedBarangayId)
        : await fetchEvacuationCenters();

      if ((!Array.isArray(centers) || centers.length === 0) && isOffline) {
        const cachedReferenceData = getCachedRegistrationReferenceData();
        centers = needsBarangayScopedCenters
          ? cachedReferenceData.evacuationCentersByBarangay?.[selectedBarangayId] || []
          : cachedReferenceData.evacuationCentersAll || [];
      }

      if (isMounted) {
        const normalizedCenters = Array.isArray(centers) ? centers : [];
        const preservedEvacuationCenterId =
          household.evacuation_center_id || savedEditEvacuationCenterId;

        if (normalizedCenters.length > 0 && selectedBarangayId) {
          cacheRegistrationEvacuationCentersByBarangay(selectedBarangayId, centers);
        }

        setHousehold((currentValue) => ({
          ...currentValue,
          evacuation_center_id:
            preservedEvacuationCenterId &&
            (normalizedCenters.some(
              (center) =>
                String(center.id ?? "") ===
                String(preservedEvacuationCenterId ?? ""),
            ) ||
              isEditMode)
              ? preservedEvacuationCenterId
              : "",
        }));

        setEvacuationCenters(() => {
          const existingSelectedCenter = normalizedCenters.find(
            (center) =>
              String(center.id ?? "") ===
              String(preservedEvacuationCenterId ?? ""),
          );

          if (
            !isEditMode ||
            !preservedEvacuationCenterId ||
            existingSelectedCenter
          ) {
            return normalizedCenters;
          }

          return [
            {
              id: preservedEvacuationCenterId,
              name: "Saved evacuation center",
              barangay_id: selectedBarangayId || null,
              is_active: false,
            },
            ...normalizedCenters,
          ];
        });
      }
    };

    loadEvacuationCenters();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    household.evacuation_center_id,
    initialHouseholdDetails,
    isEditMode,
    residencyStatus,
    savedEditEvacuationCenterId,
    scopeNonResidentEvacuationCentersToBarangay,
    selectedBarangayId,
  ]);

  const updateResidencyStatus = (nextResidencyStatus) => {
    setResidencyStatus(nextResidencyStatus);
    setHousehold((currentValue) => ({
      ...currentValue,
      current_stay_type:
        nextResidencyStatus === RESIDENCY_STATUS.nonResident &&
        restrictNonResidentToEvacCenter
          ? "EVAC_CENTER"
          : currentValue.current_stay_type,
      evacuation_center_id: "",
    }));

    if (
      !selectedBarangayId &&
      !lockBarangaySelection &&
      !hideBarangaySelection &&
      barangays.length > 0
    ) {
      setSelectedBarangayId(defaultBarangayId || barangays[0].id);
    }

    setValidationErrors((currentValue) => ({
      ...currentValue,
      selectedBarangayId: "",
      evacuation_center_id: "",
      contact_number: "",
    }));
  };

  const updateSelectedBarangayId = (value) => {
    setSelectedBarangayId(value);
    setValidationErrors((currentValue) => ({
      ...currentValue,
      selectedBarangayId: "",
      evacuation_center_id: "",
    }));
  };

  const memberCount = members.length + 1;

  const updateContactNumber = (value) => {
    setHousehold((currentValue) => ({
      ...currentValue,
      contact_number: buildPhilippineContactNumber(value),
    }));

    setValidationErrors((currentValue) => ({
      ...currentValue,
      contact_number: "",
    }));
  };

  const updateHouseholdField = (fieldName, value) => {
    if (
      fieldName === "current_stay_type" &&
      residencyStatus === RESIDENCY_STATUS.nonResident &&
      restrictNonResidentToEvacCenter &&
      value !== "EVAC_CENTER"
    ) {
      return;
    }

    setHousehold((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));

    if (fieldName === "evacuation_center_id") {
      setValidationErrors((currentValue) => ({
        ...currentValue,
        evacuation_center_id: "",
      }));
    }

    if (fieldName === "current_stay_type") {
      setValidationErrors((currentValue) => ({
        ...currentValue,
        evacuation_center_id: "",
      }));
    }
  };

  const updateFamilyHeadField = (fieldName, value) => {
    setFamilyHead((currentValue) => {
      if (fieldName === "age_value") {
        return {
          ...currentValue,
          age_value: value,
        };
      }

      if (fieldName === "age_unit") {
        return currentValue;
      }

      return {
        ...currentValue,
        [fieldName]: value,
      };
    });

    if (fieldName === "first_name" || fieldName === "last_name" || fieldName === "age_value") {
      setValidationErrors((currentValue) => ({
        ...currentValue,
        familyHead: {
          ...currentValue.familyHead,
          [fieldName]: "",
        },
      }));
    }
  };

  const toggleFamilyHeadSector = (sectorId) => {
    setFamilyHead((currentValue) => ({
      ...currentValue,
      sector_ids: currentValue.sector_ids.includes(sectorId)
        ? currentValue.sector_ids.filter((id) => id !== sectorId)
        : [...currentValue.sector_ids, sectorId],
    }));
  };

  const updateMemberField = (index, fieldName, value) => {
    setMembers((currentMembers) =>
      currentMembers.map((member, memberIndex) => {
        if (memberIndex !== index) {
          return member;
        }

        if (fieldName === "age_value") {
          return {
            ...member,
            ...buildAgeDetails(value, member.age_unit),
          };
        }

        if (fieldName === "age_unit") {
          return {
            ...member,
            ...buildAgeDetails(member.age_value, value),
          };
        }

        if (fieldName === "relationship_option") {
          return {
            ...member,
            relationship_option: value,
            relationship_to_head: value === "OTHERS" ? "" : value,
            custom_relationship:
              value === "OTHERS" ? member.custom_relationship : "",
          };
        }

        return {
          ...member,
          [fieldName]: value,
        };
      }),
    );

    if (
      fieldName === "first_name" ||
      fieldName === "last_name" ||
      fieldName === "age_value" ||
      fieldName === "relationship_option" ||
      fieldName === "custom_relationship"
    ) {
      setValidationErrors((currentValue) => ({
        ...currentValue,
        members: currentValue.members.map((memberErrors, memberIndex) =>
          memberIndex === index
            ? {
                ...memberErrors,
                [fieldName]: "",
                ...(fieldName === "relationship_option"
                  ? { custom_relationship: "" }
                  : {}),
              }
            : memberErrors,
        ),
      }));
    }
  };

  const toggleMemberSector = (index, sectorId) => {
    setMembers((currentMembers) =>
      currentMembers.map((member, memberIndex) => {
        if (memberIndex !== index) {
          return member;
        }

        const hasSector = member.sector_ids.includes(sectorId);

        return {
          ...member,
          sector_ids: hasSector
            ? member.sector_ids.filter((id) => id !== sectorId)
            : [...member.sector_ids, sectorId],
        };
      }),
    );
  };

  const toggleHouseholdSector = (sectorId) => {
    setHouseholdSectorIds((currentSectorIds) =>
      currentSectorIds.includes(sectorId)
        ? currentSectorIds.filter((id) => id !== sectorId)
        : [...currentSectorIds, sectorId],
    );
  };

  const addMember = () => {
    setMembers((currentMembers) => [...currentMembers, createMember()]);
    setValidationErrors((currentValue) => ({
      ...currentValue,
      members: [...currentValue.members, createMemberValidationErrors()],
    }));
  };

  const removeMember = (index) => {
    setMembers((currentMembers) =>
      currentMembers.filter((_, memberIndex) => memberIndex !== index),
    );
    setValidationErrors((currentValue) => ({
      ...currentValue,
      members: currentValue.members.filter((_, memberIndex) => memberIndex !== index),
    }));
  };

  const setFamilyHeadPhotoFromFile = async (file) => {
    if (!file) {
      setFamilyHeadPhotoUrl("");
      setFamilyHeadPhotoFileName("");
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      setErrorMessage("Please select a valid image file for the family head photo.");
      return;
    }

    if (file.size > MAX_FAMILY_HEAD_PHOTO_FILE_SIZE) {
      setErrorMessage("Family head photo must be 3 MB or smaller.");
      return;
    }

    setIsProcessingPhoto(true);
    setErrorMessage("");

    try {
      const encodedPhoto = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }

          reject(new Error("Failed to read selected photo."));
        };

        reader.onerror = () => {
          reject(new Error("Failed to read selected photo."));
        };

        reader.readAsDataURL(file);
      });

      setFamilyHeadPhotoUrl(encodedPhoto);
      setFamilyHeadPhotoFileName(file.name || "Captured photo");
      setSuccessMessage("");
      setValidationErrors((currentValue) => ({
        ...currentValue,
        family_head_photo_url: "",
      }));
    } catch (error) {
      setErrorMessage(error.message || "Failed to process family head photo.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const clearFamilyHeadPhoto = () => {
    setFamilyHeadPhotoUrl("");
    setFamilyHeadPhotoFileName("");
  };

  const normalizedSelectedEvacuationCenterId = String(
    household.evacuation_center_id ?? "",
  );
  const inferredSingleEvacuationCenterId =
    isEditMode &&
    household.current_stay_type === "EVAC_CENTER" &&
    !normalizedSelectedEvacuationCenterId &&
    evacuationCenters.length === 1
      ? String(evacuationCenters[0]?.id ?? "")
      : "";
  const effectiveEvacuationCenterId =
    normalizedSelectedEvacuationCenterId || inferredSingleEvacuationCenterId;
  const hasSelectedEvacuationCenterInOptions = evacuationCenters.some(
    (center) =>
      String(center.id ?? "") === effectiveEvacuationCenterId,
  );
  const displayedEvacuationCenters =
    isEditMode &&
    effectiveEvacuationCenterId &&
    !hasSelectedEvacuationCenterInOptions
      ? [
          {
            id: effectiveEvacuationCenterId,
            name: "Saved evacuation center",
            barangay_id: selectedBarangayId || null,
            is_active: false,
          },
          ...evacuationCenters,
        ]
      : evacuationCenters;

  const clearFormMessages = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const resetForm = () => {
    setHousehold(initialHousehold);
    setResidencyStatus(RESIDENCY_STATUS.resident);
    setFamilyHead(initialFamilyHead);
    setMembers([]);
    setHouseholdSectorIds([]);
    setFamilyHeadPhotoUrl("");
    setFamilyHeadPhotoFileName("");
    setPhotoVerificationNotes("");
    setEvacuationCenters([]);
    setSelectedDisasterEventId(defaultDisasterEventId || "");
    setSelectedBarangayId(defaultBarangayId || "");
    setErrorMessage("");
    setSuccessMessage("");
    setDuplicateSuggestions(createEmptyDuplicateSuggestions());
    setIsLoadingDuplicateSuggestions(false);
    setDuplicateSuggestionsError("");
    setValidationErrors(createValidationErrors());
  };

  const validateForm = () => {
    if (!selectedDisasterEventId) {
      return isOffline
        ? "Offline mode: please select an active disaster event while online first."
        : "Please select an active disaster event from the Barangay masterlist page";
    }

    const needsEvacuationCenterReference =
      household.current_stay_type === "EVAC_CENTER" ||
      (residencyStatus === RESIDENCY_STATUS.nonResident &&
        restrictNonResidentToEvacCenter);

    if (
      isOffline &&
      (activeDisasterEvents.length === 0 ||
        householdSectors.length === 0 ||
        barangays.length === 0 ||
        (needsEvacuationCenterReference && evacuationCenters.length === 0))
    ) {
      return "Offline mode: please load the registration reference data while online first.";
    }

    if (isProcessingPhoto) {
      return "Please wait for the family head photo to finish processing.";
    }

    const nextValidationErrors = createValidationErrors();
    nextValidationErrors.members = members.map(() => createMemberValidationErrors());

    if (!selectedBarangayId) {
      nextValidationErrors.selectedBarangayId =
        residencyStatus === RESIDENCY_STATUS.nonResident
          ? "Please select the handling barangay for this non-resident family."
          : "Please select a barangay.";
    }

    if (!trimValue(household.contact_number)) {
      nextValidationErrors.contact_number = "Contact number is required.";
    } else if (!isValidPhilippineContactNumber(household.contact_number)) {
      nextValidationErrors.contact_number =
        "Contact number must start with 9 and contain 10 digits.";
    }

    if (household.current_stay_type === "EVAC_CENTER") {
      if (!effectiveEvacuationCenterId) {
        nextValidationErrors.evacuation_center_id =
          "Please select an evacuation center.";
      }
    }

    if (
      residencyStatus === RESIDENCY_STATUS.nonResident &&
      restrictNonResidentToEvacCenter
    ) {
      if (household.current_stay_type !== "EVAC_CENTER") {
        return "Non-resident families must be registered under Evacuation Center stay.";
      }

      if (!effectiveEvacuationCenterId) {
        nextValidationErrors.evacuation_center_id =
          "Please select an evacuation center under the assigned barangay.";
      }

      const selectedCenter = evacuationCenters.find(
        (center) =>
          String(center.id ?? "") ===
          effectiveEvacuationCenterId,
      );

      if (
        !selectedCenter ||
        selectedCenter.barangay_id !== selectedBarangayId
      ) {
        nextValidationErrors.evacuation_center_id =
          "Please select a valid evacuation center under the assigned barangay.";
      }
    }

    if (!trimValue(familyHead.first_name)) {
      nextValidationErrors.familyHead.first_name =
        "Family head first name is required.";
    }

    if (!trimValue(familyHead.last_name)) {
      nextValidationErrors.familyHead.last_name =
        "Family head last name is required.";
    }

    const trimmedFamilyHeadAgeValue = trimValue(familyHead.age_value);
    const normalizedFamilyHeadAgeValue = normalizeAgeValue(familyHead.age_value);

    if (!trimmedFamilyHeadAgeValue) {
      nextValidationErrors.familyHead.age_value = "Family head age is required.";
    } else if (!isWholeNumberString(familyHead.age_value)) {
      nextValidationErrors.familyHead.age_value =
        "Family head age must be a whole number.";
    } else if (normalizedFamilyHeadAgeValue < 1) {
      nextValidationErrors.familyHead.age_value =
        "Family head age must be at least 1.";
    } else if (!deriveAgeGroup(normalizedFamilyHeadAgeValue, "YEARS")) {
      nextValidationErrors.familyHead.age_value =
        "Family head age must be a valid age.";
    }

    for (const [memberIndex, member] of members.entries()) {

      if (!trimValue(member.first_name)) {
        nextValidationErrors.members[memberIndex].first_name =
          "First name is required.";
      }

      if (!trimValue(member.last_name)) {
        nextValidationErrors.members[memberIndex].last_name =
          "Last name is required.";
      }

      const trimmedMemberAgeValue = trimValue(member.age_value);
      const normalizedAgeValue = normalizeAgeValue(member.age_value);

      if (!trimmedMemberAgeValue) {
        nextValidationErrors.members[memberIndex].age_value =
          "Age is required.";
      } else if (!isWholeNumberString(member.age_value)) {
        nextValidationErrors.members[memberIndex].age_value =
          "Age must be a whole number.";
      } else if (member.age_unit === "MONTHS") {
        if (normalizedAgeValue < 0 || normalizedAgeValue > 11) {
          nextValidationErrors.members[memberIndex].age_value =
            "Age in months must be from 0 to 11 only.";
        }
      } else if (member.age_unit === "YEARS") {
        if (normalizedAgeValue < 1) {
          nextValidationErrors.members[memberIndex].age_value =
            "Age in years must be at least 1.";
        } else if (!deriveAgeGroup(normalizedAgeValue, member.age_unit)) {
          nextValidationErrors.members[memberIndex].age_value =
            "A valid age is required.";
        }
      } else {
        nextValidationErrors.members[memberIndex].age_value =
          "A valid age is required.";
      }

      if (!trimValue(member.relationship_option)) {
        nextValidationErrors.members[memberIndex].relationship_option =
          "Please choose the relationship to head.";
      }

      if (
        member.relationship_option === "OTHERS" &&
        !trimValue(member.custom_relationship)
      ) {
        nextValidationErrors.members[memberIndex].custom_relationship =
          "Please enter the relationship.";
      }
    }

    if (!familyHeadPhotoUrl) {
      nextValidationErrors.family_head_photo_url =
        "Family head photo is required for verification.";
    }

    const hasFieldValidationErrors =
      Boolean(nextValidationErrors.selectedBarangayId) ||
      Boolean(nextValidationErrors.evacuation_center_id) ||
      Boolean(nextValidationErrors.contact_number) ||
      Boolean(nextValidationErrors.family_head_photo_url) ||
      Object.values(nextValidationErrors.familyHead).some(Boolean) ||
      nextValidationErrors.members.some((memberErrors) =>
        Object.values(memberErrors).some(Boolean),
      );

    return {
      generalMessage: "",
      fieldErrors: nextValidationErrors,
      hasFieldValidationErrors,
    };
  };

  const buildPayload = (privacyAcknowledgment = null) => {
    return {
      household_id: initialHouseholdDetails?.household?.id || null,
      disaster_event_id: selectedDisasterEventId,
      barangay_id: selectedBarangayId,
      residency_status: residencyStatus,
      evacuation_center_id:
        household.current_stay_type === "EVAC_CENTER"
          ? effectiveEvacuationCenterId || null
          : null,
      family_head: {
        first_name: trimValue(familyHead.first_name),
        middle_name: trimValue(familyHead.middle_name) || null,
        last_name: trimValue(familyHead.last_name),
        suffix: trimValue(familyHead.suffix) || null,
        sex: familyHead.sex,
        age_value: normalizeAgeValue(familyHead.age_value),
        age_unit: "YEARS",
        sector_ids: familyHead.sector_ids,
      },
      current_stay_type: household.current_stay_type,
      household_size: memberCount,
      registered_by: registeredBy,
      contact_number: trimValue(household.contact_number) || null,
      current_address_details: trimValue(household.current_address_details) || null,
      family_head_photo_url: familyHeadPhotoUrl || null,
      photo_verification_notes: trimValue(photoVerificationNotes) || null,
      members: members.map((member) => ({
        id: member.id || null,
        first_name: trimValue(member.first_name),
        middle_name: trimValue(member.middle_name) || null,
        last_name: trimValue(member.last_name),
        suffix: trimValue(member.suffix) || null,
        sex: member.sex,
        age_value: normalizeAgeValue(member.age_value),
        age_unit: member.age_unit,
        relationship_to_head: getFinalRelationship(member),
        sector_ids: member.sector_ids,
      })),
      household_sector_ids: householdSectorIds,
      privacy_acknowledgment: privacyAcknowledgment,
    };
  };

  const validateSubmissionReadiness = () => {
    const validationResult = validateForm();

    if (typeof validationResult === "string" && validationResult) {
      setSuccessMessage("");
      setValidationErrors(createValidationErrors());
      setErrorMessage(validationResult);
      return false;
    }

    if (validationResult?.hasFieldValidationErrors) {
      setSuccessMessage("");
      setValidationErrors(validationResult.fieldErrors);
      setErrorMessage("");
      return false;
    }

    setErrorMessage("");
    setSuccessMessage("");

    return true;
  };

  const createPrivacyAcknowledgment = ({
    acknowledgedByName = null,
    representativeRelationship = null,
  } = {}) => {
    return buildHouseholdPrivacyAcknowledgment({
      acknowledgedByName,
      representativeRelationship,
      familyHead,
      isOffline,
    });
  };

  const submitRegistration = async (privacyAcknowledgment = null) => {
    if (!validateSubmissionReadiness()) {
      return false;
    }

    if (requiresPrivacyAcknowledgment && !privacyAcknowledgment) {
      setSuccessMessage("");
      setErrorMessage(HOUSEHOLD_PRIVACY_CONFIRMATION_ERROR);
      return false;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setValidationErrors(createValidationErrors());

    try {
      const payload = buildPayload(
        requiresPrivacyAcknowledgment ? privacyAcknowledgment : null,
      );
      const response = isEditMode
        ? await updateHousehold(initialHouseholdDetails?.household?.id, payload)
        : await registerHousehold(payload);

      setSuccessMessage(
        response.message ||
          (isEditMode
            ? "Household updated successfully"
            : "Household registered successfully"),
      );

      if (onSuccess) {
        onSuccess(response);
      }

      return true;
    } catch (error) {
      setErrorMessage(
        error.message ||
          (requiresPrivacyAcknowledgment
            ? HOUSEHOLD_PRIVACY_REGISTRATION_ERROR_MESSAGE
            : "Failed to register household"),
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    household,
    residencyStatus,
    setResidencyStatus: updateResidencyStatus,
    familyHead,
    members,
    memberCount,
    householdSectorIds,
    activeDisasterEvents,
    barangays: selectableBarangays,
    assignedBarangayName: defaultBarangayName,
    isUsingCachedReferenceData,
    isOffline,
    isEditMode,
    latestPrivacyConsent,
    requiresPrivacyAcknowledgment,
    selectedDisasterEventId,
    setSelectedDisasterEventId,
    isDisasterEventLocked: Boolean(defaultDisasterEventId),
    selectedBarangayId,
    setSelectedBarangayId: updateSelectedBarangayId,
    isBarangayLocked: lockBarangaySelection,
    hideBarangaySelection,
    restrictNonResidentToEvacCenter,
    memberSectorOptions,
    householdSectors,
    evacuationCenters: displayedEvacuationCenters,
    effectiveEvacuationCenterId,
    isLoadingOptions,
    isSubmitting,
    duplicateSuggestions,
    isLoadingDuplicateSuggestions,
    duplicateSuggestionsError,
    errorMessage,
    successMessage,
    validationErrors,
    formattedContactNumber: formatPhilippineContactNumberLocalPart(
      household.contact_number,
    ),
    familyHeadPhotoUrl,
    familyHeadPhotoFileName,
    photoVerificationNotes,
    isProcessingPhoto,
    updateHouseholdField,
    updateContactNumber,
    updateFamilyHeadField,
    toggleFamilyHeadSector,
    updateMemberField,
    toggleMemberSector,
    toggleHouseholdSector,
    addMember,
    removeMember,
    setFamilyHeadPhotoFromFile,
    clearFamilyHeadPhoto,
    setPhotoVerificationNotes,
    clearFormMessages,
    resetForm,
    validateSubmissionReadiness,
    createPrivacyAcknowledgment,
    submitRegistration,
  };
};

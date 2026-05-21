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
  fetchEvacuationCenters,
  fetchEvacuationCentersByBarangay,
  fetchSectors,
  getCachedRegistrationReferenceData,
  registerHousehold,
  updateHousehold,
} from "./householdRegistrationService";
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

const MAX_FAMILY_HEAD_PHOTO_FILE_SIZE = 3 * 1024 * 1024;

const trimValue = (value) => String(value || "").trim();

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
  const [isUsingCachedReferenceData, setIsUsingCachedReferenceData] =
    useState(false);

  const isOffline =
    typeof navigator !== "undefined" ? !navigator.onLine : false;

  useEffect(() => {
    setSelectedDisasterEventId(defaultDisasterEventId || "");
  }, [defaultDisasterEventId]);

  useEffect(() => {
    cacheSelectedDisasterEventId(selectedDisasterEventId);
  }, [selectedDisasterEventId]);

  useEffect(() => {
    const selectedEvent = activeDisasterEvents.find(
      (eventItem) => eventItem.id === selectedDisasterEventId,
    );

    if (selectedEvent) {
      cacheSelectedDisasterEvent(selectedEvent);
    }
  }, [activeDisasterEvents, selectedDisasterEventId]);

  useEffect(() => {
    if (
      residencyStatus === RESIDENCY_STATUS.resident ||
      lockBarangaySelection
    ) {
      setSelectedBarangayId(defaultBarangayId || "");
    }
  }, [defaultBarangayId, lockBarangaySelection, residencyStatus]);

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
    isOpen,
    lockBarangaySelection,
    residencyStatus,
  ]);

  useEffect(() => {
    if (!isOpen || !isEditMode || !initialHouseholdDetails) {
      return;
    }

    const detailHousehold = initialHouseholdDetails.household || null;
    const detailMembers = Array.isArray(initialHouseholdDetails.members)
      ? initialHouseholdDetails.members
      : [];
    const familyHeadMember = detailMembers.find((member) => member.is_family_head);
    const additionalMembers = detailMembers.filter((member) => !member.is_family_head);

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
      evacuation_center_id: detailHousehold?.evacuation_center_id || "",
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
  }, [
    defaultBarangayId,
    defaultDisasterEventId,
    initialHouseholdDetails,
    isEditMode,
    isOpen,
  ]);

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
        setEvacuationCenters(Array.isArray(centers) ? centers : []);
        if (Array.isArray(centers) && centers.length > 0 && selectedBarangayId) {
          cacheRegistrationEvacuationCentersByBarangay(selectedBarangayId, centers);
        }
        setHousehold((currentValue) => ({
          ...currentValue,
          evacuation_center_id: Array.isArray(centers)
            ? centers.some((center) => center.id === currentValue.evacuation_center_id)
              ? currentValue.evacuation_center_id
              : ""
            : "",
        }));
      }
    };

    loadEvacuationCenters();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    residencyStatus,
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
  };

  const memberCount = members.length + 1;

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
  };

  const updateFamilyHeadField = (fieldName, value) => {
    setFamilyHead((currentValue) => {
      if (fieldName === "age_value") {
        return {
          ...currentValue,
          ...buildAgeDetails(value, "YEARS"),
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
  };

  const removeMember = (index) => {
    setMembers((currentMembers) =>
      currentMembers.filter((_, memberIndex) => memberIndex !== index),
    );
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

    if (!familyHeadPhotoUrl) {
      return "Family head photo is required for verification.";
    }

    if (!selectedBarangayId) {
      return residencyStatus === RESIDENCY_STATUS.nonResident
        ? "Please select the handling barangay for this non-resident family"
        : "Please select a barangay";
    }

    if (
      residencyStatus === RESIDENCY_STATUS.nonResident &&
      restrictNonResidentToEvacCenter
    ) {
      if (household.current_stay_type !== "EVAC_CENTER") {
        return "Non-resident families must be registered under Evacuation Center stay.";
      }

      if (!household.evacuation_center_id) {
        return "Please select an evacuation center under the assigned barangay.";
      }

      const selectedCenter = evacuationCenters.find(
        (center) => center.id === household.evacuation_center_id,
      );

      if (
        !selectedCenter ||
        selectedCenter.barangay_id !== selectedBarangayId
      ) {
        return "Please select a valid evacuation center under the assigned barangay.";
      }
    }

    if (!trimValue(familyHead.first_name) || !trimValue(familyHead.last_name)) {
      return "Family head first name and last name are required";
    }

    const normalizedFamilyHeadAgeValue = normalizeAgeValue(familyHead.age_value);

    if (normalizedFamilyHeadAgeValue === "") {
      return "Family head age is required";
    }

    if (familyHead.age_unit !== "YEARS") {
      return "Family head age must be encoded in years";
    }

    if (!deriveAgeGroup(normalizedFamilyHeadAgeValue, "YEARS")) {
      return "Family head age must map to a valid age-based sector";
    }

    for (const member of members) {
      if (!trimValue(member.first_name) || !trimValue(member.last_name)) {
        return "Each additional member needs a first name and last name";
      }

      const normalizedAgeValue = normalizeAgeValue(member.age_value);

      if (normalizedAgeValue === "" || !deriveAgeGroup(normalizedAgeValue, member.age_unit)) {
        return "Each additional member needs a valid age value and age unit";
      }

      if (!trimValue(member.relationship_option)) {
        return "Please choose the relationship to head for each additional member";
      }

      if (
        member.relationship_option === "OTHERS" &&
        !trimValue(member.custom_relationship)
      ) {
        return "Please enter the custom relationship when Others is selected";
      }
    }

    return "";
  };

  const buildPayload = () => {
    return {
      household_id: initialHouseholdDetails?.household?.id || null,
      disaster_event_id: selectedDisasterEventId,
      barangay_id: selectedBarangayId,
      residency_status: residencyStatus,
      evacuation_center_id:
        household.current_stay_type === "EVAC_CENTER"
          ? household.evacuation_center_id || null
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
    };
  };

  const submitRegistration = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setSuccessMessage("");
      setErrorMessage(validationMessage);
      return false;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = buildPayload();
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
      setErrorMessage(error.message || "Failed to register household");
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
    barangays,
    assignedBarangayName: defaultBarangayName,
    isUsingCachedReferenceData,
    isOffline,
    isEditMode,
    selectedDisasterEventId,
    setSelectedDisasterEventId,
    isDisasterEventLocked: Boolean(defaultDisasterEventId),
    selectedBarangayId,
    setSelectedBarangayId,
    isBarangayLocked: lockBarangaySelection,
    hideBarangaySelection,
    restrictNonResidentToEvacCenter,
    memberSectorOptions,
    householdSectors,
    evacuationCenters,
    isLoadingOptions,
    isSubmitting,
    errorMessage,
    successMessage,
    familyHeadPhotoUrl,
    familyHeadPhotoFileName,
    photoVerificationNotes,
    isProcessingPhoto,
    updateHouseholdField,
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
    submitRegistration,
  };
};

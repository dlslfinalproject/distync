import { useEffect, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchEvacuationCenters,
  fetchEvacuationCentersByBarangay,
  fetchSectors,
  registerHousehold,
} from "./householdRegistrationService";
import { deriveAgeGroup } from "../../utils/ageGroup";
import {
  DISPLAY_MEMBER_SECTOR_CODES,
  HOUSEHOLD_CONDITION_CODES,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";

const createMember = () => ({
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
};

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

const NON_RESIDENT_BARANGAY_CODE = "NON_RESIDENT_OUTSIDE_MALVAR";

export const useHouseholdRegistrationForm = ({
  isOpen,
  defaultBarangayId,
  defaultDisasterEventId,
  onSuccess,
}) => {
  const [household, setHousehold] = useState(initialHousehold);
  const [familyHead, setFamilyHead] = useState(initialFamilyHead);
  const [members, setMembers] = useState([]);
  const [householdSectorIds, setHouseholdSectorIds] = useState([]);
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
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setSelectedDisasterEventId(defaultDisasterEventId || "");
  }, [defaultDisasterEventId]);

  useEffect(() => {
    setSelectedBarangayId(defaultBarangayId || "");
  }, [defaultBarangayId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadOptions = async () => {
      setIsLoadingOptions(true);
      setErrorMessage("");

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
          ? barangaysPayload
          : [];

        setActiveDisasterEvents(disasterEvents);
        setBarangays(availableBarangays);

        if (!defaultDisasterEventId && disasterEvents.length > 0) {
          setSelectedDisasterEventId(disasterEvents[0].id);
        }

        if (!defaultBarangayId && availableBarangays.length > 0) {
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
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Failed to load form options");
        }
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
  }, [defaultBarangayId, defaultDisasterEventId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedBarangayId) {
      setEvacuationCenters([]);
      setHousehold((currentValue) => ({
        ...currentValue,
        evacuation_center_id: "",
      }));
      return;
    }

    let isMounted = true;

    const loadEvacuationCenters = async () => {
      const selectedBarangay = barangays.find(
        (barangay) => barangay.id === selectedBarangayId,
      );
      const isNonResidentBarangay =
        selectedBarangay?.code === NON_RESIDENT_BARANGAY_CODE;
      const centers = isNonResidentBarangay
        ? await fetchEvacuationCenters()
        : await fetchEvacuationCentersByBarangay(selectedBarangayId);

      if (isMounted) {
        setEvacuationCenters(Array.isArray(centers) ? centers : []);
        setHousehold((currentValue) => ({
          ...currentValue,
          evacuation_center_id: "",
        }));
      }
    };

    loadEvacuationCenters();

    return () => {
      isMounted = false;
    };
  }, [barangays, isOpen, selectedBarangayId]);

  const memberCount = members.length + 1;

  const updateHouseholdField = (fieldName, value) => {
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

  const resetForm = () => {
    setHousehold(initialHousehold);
    setFamilyHead(initialFamilyHead);
    setMembers([]);
    setHouseholdSectorIds([]);
    setEvacuationCenters([]);
    setSelectedDisasterEventId(defaultDisasterEventId || "");
    setSelectedBarangayId(defaultBarangayId || "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!selectedDisasterEventId) {
      return "Please select an active disaster event from the Barangay masterlist page";
    }

    if (!selectedBarangayId) {
      return "Please select a barangay";
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
      disaster_event_id: selectedDisasterEventId,
      barangay_id: selectedBarangayId,
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
      registered_by: null,
      members: members.map((member) => ({
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
      const response = await registerHousehold(payload);

      setSuccessMessage(
        response.message || "Household registered successfully",
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
    familyHead,
    members,
    memberCount,
    householdSectorIds,
    activeDisasterEvents,
    barangays,
    selectedDisasterEventId,
    setSelectedDisasterEventId,
    isDisasterEventLocked: Boolean(defaultDisasterEventId),
    selectedBarangayId,
    setSelectedBarangayId,
    isBarangayLocked: false,
    memberSectorOptions,
    householdSectors,
    evacuationCenters,
    isLoadingOptions,
    isSubmitting,
    errorMessage,
    successMessage,
    updateHouseholdField,
    updateFamilyHeadField,
    toggleFamilyHeadSector,
    updateMemberField,
    toggleMemberSector,
    toggleHouseholdSector,
    addMember,
    removeMember,
    resetForm,
    submitRegistration,
  };
};

import { useEffect, useMemo, useState } from "react";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchEvacuationCentersByBarangay,
  fetchSectors,
  registerHousehold,
} from "./householdRegistrationService";

const createMember = (isFamilyHead = false) => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  sex: "MALE",
  birth_date: "",
  age: "",
  civil_status: "",
  relationship_to_head: isFamilyHead ? "HEAD" : "",
  is_family_head: isFamilyHead,
  is_pregnant: false,
  is_lactating: false,
  has_disability: false,
  sector_ids: [],
});

const initialFamilyHead = {
  first_name: "",
  middle_name: "",
  last_name: "",
  suffix: "",
  sex: "MALE",
  birth_date: "",
  contact_number: "",
};

const initialHousehold = {
  current_stay_type: "EVAC_CENTER",
  current_address_details: "",
  evacuation_center_id: "",
};

const calculateAgeFromBirthDate = (birthDate) => {
  if (!birthDate) {
    return "";
  }

  const today = new Date();
  const birthDateValue = new Date(birthDate);

  if (Number.isNaN(birthDateValue.getTime())) {
    return "";
  }

  let age = today.getFullYear() - birthDateValue.getFullYear();
  const monthDifference = today.getMonth() - birthDateValue.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDateValue.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : "";
};

const trimValue = (value) => value.trim();

const getPrimaryMemberFromFamilyHead = (familyHead, currentMember) => {
  return {
    ...currentMember,
    first_name: familyHead.first_name,
    middle_name: familyHead.middle_name,
    last_name: familyHead.last_name,
    suffix: familyHead.suffix,
    sex: familyHead.sex,
    birth_date: familyHead.birth_date,
    age: calculateAgeFromBirthDate(familyHead.birth_date),
    relationship_to_head: "HEAD",
    is_family_head: true,
  };
};

export const useHouseholdRegistrationForm = ({
  isOpen,
  defaultBarangayId,
  defaultDisasterEventId,
  onSuccess,
}) => {
  const [household, setHousehold] = useState(initialHousehold);
  const [familyHead, setFamilyHead] = useState(initialFamilyHead);
  const [members, setMembers] = useState([createMember(true)]);
  const [householdSectorIds, setHouseholdSectorIds] = useState([]);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState(
    defaultDisasterEventId || "",
  );
  const [selectedBarangayId, setSelectedBarangayId] = useState(
    defaultBarangayId || "",
  );
  const [personSectors, setPersonSectors] = useState([]);
  const [householdSectors, setHouseholdSectors] = useState([]);
  const [evacuationCenters, setEvacuationCenters] = useState([]);
  const [isPrimaryMemberSynced, setIsPrimaryMemberSynced] = useState(true);
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

        setPersonSectors(
          sectors.filter((sector) => sector.sector_group !== "HOUSEHOLD"),
        );
        setHouseholdSectors(
          sectors.filter((sector) => sector.sector_group === "HOUSEHOLD"),
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
      const centers = await fetchEvacuationCentersByBarangay(selectedBarangayId);

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
  }, [isOpen, selectedBarangayId]);

  useEffect(() => {
    if (!isOpen || !isPrimaryMemberSynced) {
      return;
    }

    setMembers((currentMembers) => {
      if (currentMembers.length === 0) {
        return [getPrimaryMemberFromFamilyHead(familyHead, createMember(true))];
      }

      return currentMembers.map((member, memberIndex) => {
        if (memberIndex !== 0) {
          return member;
        }

        return getPrimaryMemberFromFamilyHead(familyHead, member);
      });
    });
  }, [familyHead, isOpen, isPrimaryMemberSynced]);

  const memberCount = members.length;

  const groupedPersonSectors = useMemo(() => {
    return personSectors.reduce((groups, sector) => {
      const groupName = sector.sector_group || "OTHER";

      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      groups[groupName].push(sector);
      return groups;
    }, {});
  }, [personSectors]);

  const updateHouseholdField = (fieldName, value) => {
    setHousehold((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));
  };

  const updateFamilyHeadField = (fieldName, value) => {
    setFamilyHead((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));
  };

  const updateMemberField = (index, fieldName, value) => {
    if (
      index === 0 &&
      [
        "first_name",
        "middle_name",
        "last_name",
        "suffix",
        "sex",
        "birth_date",
        "age",
        "relationship_to_head",
        "is_family_head",
      ].includes(fieldName)
    ) {
      const syncedMember = getPrimaryMemberFromFamilyHead(
        familyHead,
        members[0] || createMember(true),
      );

      if (syncedMember[fieldName] !== value) {
        setIsPrimaryMemberSynced(false);
      }
    }

    setMembers((currentMembers) =>
      currentMembers.map((member, memberIndex) => {
        if (memberIndex !== index) {
          return member;
        }

        if (fieldName === "birth_date") {
          return {
            ...member,
            birth_date: value,
            age: calculateAgeFromBirthDate(value),
          };
        }

        if (fieldName === "is_family_head") {
          return {
            ...member,
            is_family_head: value,
            relationship_to_head: value ? "HEAD" : member.relationship_to_head,
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
    setMembers((currentMembers) => [...currentMembers, createMember(false)]);
  };

  const removeMember = (index) => {
    setMembers((currentMembers) =>
      currentMembers.filter((_, memberIndex) => memberIndex !== index),
    );
  };

  const resetForm = () => {
    setHousehold(initialHousehold);
    setFamilyHead(initialFamilyHead);
    setMembers([createMember(true)]);
    setHouseholdSectorIds([]);
    setEvacuationCenters([]);
    setIsPrimaryMemberSynced(true);
    setSelectedDisasterEventId(defaultDisasterEventId || "");
    setSelectedBarangayId(defaultBarangayId || "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const resetPrimaryMemberFromFamilyHead = () => {
    setIsPrimaryMemberSynced(true);
    setMembers((currentMembers) => {
      if (currentMembers.length === 0) {
        return [getPrimaryMemberFromFamilyHead(familyHead, createMember(true))];
      }

      return currentMembers.map((member, memberIndex) => {
        if (memberIndex !== 0) {
          return member;
        }

        return getPrimaryMemberFromFamilyHead(familyHead, member);
      });
    });
  };

  const validateForm = () => {
    if (!selectedDisasterEventId) {
      return "Please select an active disaster event";
    }

    if (!selectedBarangayId) {
      return "Please select a barangay";
    }

    const familyHeadCount = members.filter(
      (member) => member.is_family_head,
    ).length;

    if (familyHeadCount !== 1) {
      return "Exactly one household member must be marked as family head";
    }

    if (memberCount <= 0) {
      return "At least one household member is required";
    }

    const selectedFamilyHeadMember = members.find((member) => member.is_family_head);

    if (!selectedFamilyHeadMember) {
      return "Please mark one member as the family head";
    }

    const familyHeadFieldsMatch =
      trimValue(familyHead.first_name) === trimValue(selectedFamilyHeadMember.first_name) &&
      trimValue(familyHead.middle_name) === trimValue(selectedFamilyHeadMember.middle_name) &&
      trimValue(familyHead.last_name) === trimValue(selectedFamilyHeadMember.last_name) &&
      trimValue(familyHead.suffix) === trimValue(selectedFamilyHeadMember.suffix) &&
      familyHead.sex === selectedFamilyHeadMember.sex &&
      familyHead.birth_date === selectedFamilyHeadMember.birth_date;

    if (!familyHeadFieldsMatch) {
      return "The selected family head member must match the family head info section";
    }

    return "";
  };

  const buildPayload = () => {
    return {
      disaster_event_id: selectedDisasterEventId,
      barangay_id: selectedBarangayId,
      evacuation_center_id: household.evacuation_center_id || null,
      family_head: {
        first_name: trimValue(familyHead.first_name),
        middle_name: trimValue(familyHead.middle_name) || null,
        last_name: trimValue(familyHead.last_name),
        suffix: trimValue(familyHead.suffix) || null,
        sex: familyHead.sex,
        birth_date: familyHead.birth_date,
        contact_number: trimValue(familyHead.contact_number),
      },
      current_stay_type: household.current_stay_type,
      current_address_details: trimValue(household.current_address_details) || null,
      household_size: memberCount,
      registered_by: null,
      members: members.map((member) => ({
        first_name: trimValue(member.first_name),
        middle_name: trimValue(member.middle_name) || null,
        last_name: trimValue(member.last_name),
        suffix: trimValue(member.suffix) || null,
        sex: member.sex,
        birth_date: member.birth_date,
        age: Number(member.age),
        civil_status: trimValue(member.civil_status) || null,
        relationship_to_head: trimValue(member.relationship_to_head),
        is_family_head: member.is_family_head,
        is_pregnant: member.is_pregnant,
        is_lactating: member.is_lactating,
        has_disability: member.has_disability,
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
    isBarangayLocked: Boolean(defaultBarangayId),
    isPrimaryMemberSynced,
    groupedPersonSectors,
    householdSectors,
    evacuationCenters,
    isLoadingOptions,
    isSubmitting,
    errorMessage,
    successMessage,
    updateHouseholdField,
    updateFamilyHeadField,
    updateMemberField,
    toggleMemberSector,
    toggleHouseholdSector,
    addMember,
    removeMember,
    resetPrimaryMemberFromFamilyHead,
    resetForm,
    submitRegistration,
  };
};

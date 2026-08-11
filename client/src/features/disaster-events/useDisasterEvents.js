import { useEffect, useState } from "react";
import {
  createDisasterEvent,
  fetchActiveDisasterEvents,
  fetchAllDisasterEvents,
  fetchBarangays,
  fetchDisasterEventById,
  fetchEndedDisasterEvents,
  updateDisasterEvent,
} from "./disasterEventService";

const NON_RESIDENT_BARANGAY_CODE = "NON_RESIDENT_OUTSIDE_MALVAR";

const filterOptions = {
  all: "all",
  active: "active",
  closed: "closed",
};

const DISASTER_EVENT_STATUSES = {
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
};

const loadEventListByFilter = async (selectedFilter) => {
  if (selectedFilter === "active") {
    return fetchActiveDisasterEvents();
  }

  if (selectedFilter === "closed") {
    return fetchEndedDisasterEvents();
  }

  const allEvents = await fetchAllDisasterEvents();

  return allEvents.filter(
    (event) =>
      event.status === DISASTER_EVENT_STATUSES.ACTIVE ||
      event.status === DISASTER_EVENT_STATUSES.CLOSED,
  );
};

export const useDisasterEvents = () => {
  const [selectedFilter, setSelectedFilter] = useState(filterOptions.all);
  const [events, setEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detailErrorMessage, setDetailErrorMessage] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadEvents = async (filterValue = selectedFilter) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const eventRows = await loadEventListByFilter(filterValue);

      const detailedEvents = await Promise.all(
        eventRows.map(async (event) => {
          try {
            const detail = await fetchDisasterEventById(event.id);

            return {
              ...event,
              affected_barangays: detail.affected_barangays || [],
            };
          } catch (error) {
            return {
              ...event,
              affected_barangays: [],
            };
          }
        }),
      );

      setEvents(detailedEvents);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBarangays = async () => {
    try {
      const barangayRows = await fetchBarangays();
      const validAffectedBarangays = (barangayRows || []).filter(
        (barangay) => barangay.code !== NON_RESIDENT_BARANGAY_CODE,
      );
      setBarangays(validAffectedBarangays);
    } catch (error) {
      setFormErrorMessage(error.message);
    }
  };

  useEffect(() => {
    loadEvents(selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    loadBarangays();
  }, []);

  const openCreateModal = () => {
    setFormErrorMessage("");
    setSuccessMessage("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsCreateModalOpen(false);
    setFormErrorMessage("");
    setEditingEvent(null);
  };

  const openEditModal = async (eventId) => {
    setFormErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const eventDetail = await fetchDisasterEventById(eventId);
      setEditingEvent(eventDetail);
      setIsCreateModalOpen(true);
    } catch (error) {
      setFormErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetailModal = async (eventId) => {
    setIsDetailLoading(true);
    setDetailErrorMessage("");
    setIsDetailModalOpen(true);

    try {
      const eventDetail = await fetchDisasterEventById(eventId);
      setSelectedEvent(eventDetail);
    } catch (error) {
      setSelectedEvent(null);
      setDetailErrorMessage(error.message);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
    setDetailErrorMessage("");
  };

  const submitCreateEvent = async (payload) => {
    setIsSubmitting(true);
    setFormErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await createDisasterEvent(payload);
      setSuccessMessage(response.message || "Disaster event created successfully");
      setIsCreateModalOpen(false);
      await loadEvents(selectedFilter);
    } catch (error) {
      setFormErrorMessage(error.message);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitEditEvent = async (payload) => {
    if (!editingEvent?.id) {
      throw new Error("Disaster event not found");
    }

    setIsSubmitting(true);
    setFormErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await updateDisasterEvent(editingEvent.id, payload);
      setSuccessMessage(response.message || "Disaster event updated successfully");
      setIsCreateModalOpen(false);
      setEditingEvent(null);
      await loadEvents(selectedFilter);

      if (selectedEvent?.id === editingEvent.id) {
        const updated = await fetchDisasterEventById(editingEvent.id);
        setSelectedEvent(updated);
      }
    } catch (error) {
      setFormErrorMessage(error.message);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedFilter,
    setSelectedFilter,
    events,
    barangays,
    selectedEvent,
    isLoading,
    isDetailLoading,
    isSubmitting,
    errorMessage,
    detailErrorMessage,
    formErrorMessage,
    successMessage,
    isCreateModalOpen,
    isDetailModalOpen,
    editingEvent,
    openCreateModal,
    openEditModal,
    closeCreateModal,
    openDetailModal,
    closeDetailModal,
    submitCreateEvent,
    submitEditEvent,
    filterOptions,
    refreshEvents: () => loadEvents(selectedFilter),
  };
};

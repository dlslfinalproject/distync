import { useState } from "react";
import {
  createDonation,
  createDonationItem,
  createDonationNeed,
  deleteDonation,
  deleteDonationItem,
  deleteDonationNeed,
  fetchDonationById,
  fetchDonationDetail,
  updateDonation,
  updateDonationItem,
  updateDonationNeed,
} from "./donationService";
import {
  createDonationForm,
  createDonationItemForm,
  createNeedForm,
} from "./donationUi";

export const useDonationManagementModals = ({
  selectedEventId,
  inventoryItems,
  loadPageData,
  setSuccessMessage,
  setPageErrorMessage,
  setExportFeedback,
}) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [needForm, setNeedForm] = useState(createNeedForm());
  const [needErrorMessage, setNeedErrorMessage] = useState("");
  const [isNeedSubmitting, setIsNeedSubmitting] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isDonationDetailModalOpen, setIsDonationDetailModalOpen] =
    useState(false);
  const [isDonationDetailLoading, setIsDonationDetailLoading] = useState(false);
  const [donationDetailErrorMessage, setDonationDetailErrorMessage] =
    useState("");
  const [selectedDonationDetail, setSelectedDonationDetail] = useState(null);
  const [donationForm, setDonationForm] = useState(createDonationForm());
  const [donationErrorMessage, setDonationErrorMessage] = useState("");
  const [donationItemErrorMessage, setDonationItemErrorMessage] = useState("");
  const [isDonationSubmitting, setIsDonationSubmitting] = useState(false);
  const [donationItemDraft, setDonationItemDraft] = useState(
    createDonationItemForm(),
  );
  const [editingDonationItemId, setEditingDonationItemId] = useState("");

  const openNeedModal = (donationNeed = null) => {
    setNeedErrorMessage("");
    setNeedForm(
      donationNeed
        ? {
            id: donationNeed.id,
            disaster_event_id: donationNeed.disaster_event_id,
            inventory_item_id: donationNeed.inventory_item_id,
            quantity_needed: donationNeed.quantity_needed,
            priority_level: donationNeed.priority_level,
            notes: donationNeed.notes || "",
            is_active: donationNeed.is_active,
          }
        : {
            ...createNeedForm(),
            disaster_event_id: selectedEventId || "",
          },
    );
    setIsNeedModalOpen(true);
  };

  const closeNeedModal = () => {
    setIsNeedModalOpen(false);
    setNeedForm(createNeedForm());
    setNeedErrorMessage("");
  };

  const openDonationModal = async (donationId = null) => {
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());

    if (!donationId) {
      setDonationForm({
        ...createDonationForm(),
        disaster_event_id: selectedEventId || "",
      });
      setIsDonationModalOpen(true);
      return;
    }

    try {
      const donation = await fetchDonationById(donationId);
      setDonationForm({
        id: donation.id,
        disaster_event_id: donation.disaster_event_id,
        donor_name: donation.donor_name,
        donor_type: donation.donor_type,
        contact_information: donation.contact_information || "",
        received_at: donation.received_at
          ? new Date(donation.received_at).toISOString().slice(0, 16)
          : "",
        status: donation.status,
        remarks: donation.remarks || "",
        items: donation.items || [],
      });
      setIsDonationModalOpen(true);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation details.");
    }
  };

  const closeDonationModal = () => {
    setIsDonationModalOpen(false);
    setDonationForm(createDonationForm());
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setDonationItemDraft(createDonationItemForm());
    setEditingDonationItemId("");
  };

  const openDonationDetailModal = async (donationId) => {
    setIsDonationDetailModalOpen(true);
    setIsDonationDetailLoading(true);
    setDonationDetailErrorMessage("");
    setSelectedDonationDetail(null);

    try {
      const response = await fetchDonationDetail(donationId);
      setSelectedDonationDetail(response?.data || null);
    } catch (error) {
      setDonationDetailErrorMessage(error.message || "Failed to load donation detail.");
    } finally {
      setIsDonationDetailLoading(false);
    }
  };

  const submitDonationNeed = async () => {
    setIsNeedSubmitting(true);
    setNeedErrorMessage("");

    try {
      const payload = {
        disaster_event_id: needForm.disaster_event_id,
        inventory_item_id: needForm.inventory_item_id,
        quantity_needed: Number(needForm.quantity_needed),
        priority_level: needForm.priority_level,
        notes: needForm.notes.trim() || null,
        is_active: needForm.is_active,
      };

      if (needForm.id) {
        const response = await updateDonationNeed(needForm.id, payload);
        setSuccessMessage("Donation need updated successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      } else {
        const response = await createDonationNeed(payload);
        setSuccessMessage("Donation need created successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      }

      closeNeedModal();
    } catch (error) {
      setNeedErrorMessage(error.message || "Failed to save donation need.");
    } finally {
      setIsNeedSubmitting(false);
    }
  };

  const submitDonation = async () => {
    setIsDonationSubmitting(true);
    setDonationErrorMessage("");

    try {
      const payload = {
        disaster_event_id: donationForm.disaster_event_id,
        donor_name: donationForm.donor_name.trim(),
        donor_type: donationForm.donor_type,
        contact_information: donationForm.contact_information.trim() || null,
        received_at: donationForm.received_at
          ? new Date(donationForm.received_at).toISOString()
          : null,
        status: donationForm.status,
        remarks: donationForm.remarks.trim() || null,
      };

      if (!donationForm.id) {
        if (donationForm.items.length === 0) {
          throw new Error("Add at least one donated item before saving the donation record.");
        }

        const response = await createDonation({
          ...payload,
          items: donationForm.items.map((item) => ({
            inventory_item_id: item.inventory_item_id,
            quantity_received: Number(item.quantity_received),
            remarks: item.remarks || null,
            expiration_date: item.expiration_date || null,
            storage_location: item.storage_location || null,
          })),
        });
        setSuccessMessage("Donation recorded successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      } else {
        const response = await updateDonation(donationForm.id, payload);
        setSuccessMessage("Donation updated successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      }

      closeDonationModal();
    } catch (error) {
      setDonationErrorMessage(error.message || "Failed to save donation.");
    } finally {
      setIsDonationSubmitting(false);
    }
  };

  const addDraftDonationItem = () => {
    setDonationItemErrorMessage("");

    if (!donationItemDraft.inventory_item_id) {
      setDonationItemErrorMessage("Select an inventory item before adding it.");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        {
          ...donationItemDraft,
          inventory_item_id: donationItemDraft.inventory_item_id,
          quantity_received: Number(donationItemDraft.quantity_received),
          inventory_item: inventoryItems.find(
            (item) => item.id === donationItemDraft.inventory_item_id,
          ),
        },
      ],
    }));
    setDonationItemDraft(createDonationItemForm());
  };

  const startEditDonationItem = (item) => {
    setEditingDonationItemId(item.id);
    setDonationItemDraft({
      inventory_item_id: item.inventory_item_id,
      quantity_received: item.quantity_received,
      remarks: item.remarks || "",
      expiration_date: item.inventory_batch?.expiration_date
        ? item.inventory_batch.expiration_date.slice(0, 10)
        : "",
      storage_location: item.inventory_batch?.storage_location || "",
    });
  };

  const cancelEditDonationItem = () => {
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());
    setDonationItemErrorMessage("");
  };

  const saveExistingDonationItem = async () => {
    if (!editingDonationItemId) {
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await updateDonationItem(editingDonationItemId, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });

      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setSuccessMessage("Donation item updated successfully.");
      cancelEditDonationItem();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to update donation item.");
    }
  };

  const removeDraftDonationItem = (itemToRemove) => {
    setDonationForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.filter((item) => item !== itemToRemove),
    }));
  };

  const removeExistingDonationItem = async (item) => {
    setDeleteConfirmation({
      type: "donation-item",
      payload: item,
      title: "Delete Donation Item",
      message: "Remove this donation item from the donation record?",
      confirmLabel: "Delete",
    });
  };

  const addExistingDonationItem = async () => {
    if (!donationForm.id) {
      addDraftDonationItem();
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await createDonationItem(donationForm.id, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });
      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setDonationItemDraft(createDonationItemForm());
      setSuccessMessage("Donation item added successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to add donation item.");
    }
  };

  const handleDeleteDonationNeed = async (donationNeed) => {
    setDeleteConfirmation({
      type: "donation-need",
      payload: donationNeed,
      title: "Delete Donation Need",
      message: `Delete the donation need for ${donationNeed.inventory_item?.item_name || "this item"}?`,
      confirmLabel: "Delete",
    });
  };

  const handleDeleteDonation = async (donation) => {
    setDeleteConfirmation({
      type: "donation",
      payload: donation,
      title: "Delete Donation Record",
      message: `Delete the donation record for ${donation.donor_name}?`,
      confirmLabel: "Delete",
    });
  };

  const handleCancelDeleteConfirmation = () => {
    if (isDeleteSubmitting) {
      return;
    }

    setDeleteConfirmation(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation || isDeleteSubmitting) {
      return;
    }

    setIsDeleteSubmitting(true);

    try {
      if (deleteConfirmation.type === "donation-item") {
        await deleteDonationItem(deleteConfirmation.payload.id);
        const refreshedDonation = await fetchDonationById(donationForm.id);
        setDonationForm((currentForm) => ({
          ...currentForm,
          items: refreshedDonation.items || [],
        }));
        cancelEditDonationItem();
        await loadPageData(selectedEventId);
        setExportFeedback({
          type: "success",
          message: "Donation item deleted successfully.",
        });
      } else if (deleteConfirmation.type === "donation-need") {
        await deleteDonationNeed(deleteConfirmation.payload.id);
        await loadPageData(selectedEventId);
        setExportFeedback({
          type: "success",
          message: "Donation need deleted successfully.",
        });
      } else if (deleteConfirmation.type === "donation") {
        await deleteDonation(deleteConfirmation.payload.id);
        await loadPageData(selectedEventId);
        setExportFeedback({
          type: "success",
          message: "Donation deleted successfully.",
        });
      }

      setDeleteConfirmation(null);
    } catch (error) {
      if (deleteConfirmation.type === "donation-item") {
        setExportFeedback({
          type: "error",
          message: error.message || "Failed to delete donation item.",
        });
      } else {
        setExportFeedback({
          type: "error",
          message:
            error.message ||
            (deleteConfirmation.type === "donation"
              ? "Failed to delete donation."
              : "Failed to delete donation need."),
        });
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  return {
    deleteConfirmation,
    isDeleteSubmitting,
    isNeedModalOpen,
    needForm,
    needErrorMessage,
    isNeedSubmitting,
    isDonationModalOpen,
    isDonationDetailModalOpen,
    isDonationDetailLoading,
    donationDetailErrorMessage,
    selectedDonationDetail,
    donationForm,
    donationErrorMessage,
    donationItemErrorMessage,
    isDonationSubmitting,
    donationItemDraft,
    editingDonationItemId,
    setNeedForm,
    setDonationForm,
    setDonationItemDraft,
    openNeedModal,
    closeNeedModal,
    openDonationModal,
    closeDonationModal,
    openDonationDetailModal,
    submitDonationNeed,
    submitDonation,
    addDraftDonationItem,
    startEditDonationItem,
    cancelEditDonationItem,
    saveExistingDonationItem,
    removeDraftDonationItem,
    removeExistingDonationItem,
    addExistingDonationItem,
    handleDeleteDonationNeed,
    handleDeleteDonation,
    handleCancelDeleteConfirmation,
    handleConfirmDelete,
  };
};

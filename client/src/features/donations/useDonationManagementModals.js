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
import { createInventoryItem } from "../inventory-items/inventoryItemService";
import { createReliefPackTemplate } from "../relief-pack-templates/reliefPackTemplateService";

const getMutationData = (response) => response?.data || response;

const buildDonationDefinedItemPayload = (draft) => ({
  item_name: draft.new_item_name.trim(),
  category: draft.new_item_category,
  unit_of_measure: draft.new_item_unit_of_measure,
  unit_of_measure_value: draft.new_item_unit_of_measure === "pc" ? 1 : 1,
  packaging: draft.new_item_packaging,
  packaging_count: 1,
  quantity: 1,
  reorder_level: 1,
  expiration_date: draft.expiration_date || null,
  barcode: null,
  is_active: true,
  skip_opening_stock: true,
});

const buildReliefPackRemark = (templateName, packQuantity) =>
  `Relief Pack: ${templateName} x ${packQuantity}`;

export const useDonationManagementModals = ({
  selectedEventId,
  inventoryItems,
  reliefPackTemplates = [],
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
        contact_information: null,
        received_at: donationForm.received_at
          ? new Date(donationForm.received_at).toISOString()
          : null,
        status: donationForm.status,
        remarks: null,
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
            storage_location: null,
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

  const addPackItemToDraft = () => {
    setDonationItemErrorMessage("");

    const inventoryItem = inventoryItems.find(
      (item) => item.id === donationItemDraft.pack_item_inventory_item_id,
    );
    const quantityRequired = Number(donationItemDraft.pack_item_quantity_required || 0);

    if (!inventoryItem) {
      setDonationItemErrorMessage("Select an inventory item for the relief pack.");
      return;
    }

    if (quantityRequired <= 0) {
      setDonationItemErrorMessage("Enter the item quantity per relief pack.");
      return;
    }

    setDonationItemDraft((currentDraft) => {
      const existingItem = currentDraft.relief_pack_items.find(
        (item) => item.inventory_item_id === inventoryItem.id,
      );

      const nextPackItems = existingItem
        ? currentDraft.relief_pack_items.map((item) =>
            item.inventory_item_id === inventoryItem.id
              ? {
                  ...item,
                  quantity_required: quantityRequired,
                  inventory_item: inventoryItem,
                }
              : item,
          )
        : [
            ...currentDraft.relief_pack_items,
            {
              inventory_item_id: inventoryItem.id,
              quantity_required: quantityRequired,
              inventory_item: inventoryItem,
            },
          ];

      return {
        ...currentDraft,
        relief_pack_items: nextPackItems,
        pack_item_inventory_item_id: "",
        pack_item_quantity_required: 1,
      };
    });
  };

  const removePackItemFromDraft = (inventoryItemId) => {
    setDonationItemDraft((currentDraft) => ({
      ...currentDraft,
      relief_pack_items: currentDraft.relief_pack_items.filter(
        (item) => item.inventory_item_id !== inventoryItemId,
      ),
    }));
  };

  const addDraftDonationItem = async () => {
    setDonationItemErrorMessage("");

    if (donationItemDraft.entry_type === "RELIEF_PACK") {
      const packQuantity = Number(donationItemDraft.relief_pack_quantity || 0);
      let selectedTemplate = reliefPackTemplates.find(
        (template) => template.id === donationItemDraft.relief_pack_template_id,
      );

      if (donationItemDraft.pack_definition_mode === "NEW") {
        if (!donationItemDraft.new_pack_name.trim()) {
          setDonationItemErrorMessage("Enter the relief pack name.");
          return;
        }

        if (donationItemDraft.relief_pack_items.length === 0) {
          setDonationItemErrorMessage("Add at least one item to the relief pack.");
          return;
        }

        try {
          const response = await createReliefPackTemplate({
            name: donationItemDraft.new_pack_name.trim(),
            description: null,
            based_on_family_size: true,
            based_on_sector: false,
            is_additional_pack: false,
            sector_id: null,
            is_active: true,
            items: donationItemDraft.relief_pack_items.map((item) => ({
              inventory_item_id: item.inventory_item_id,
              quantity_required: Number(item.quantity_required),
            })),
          });
          selectedTemplate = {
            ...getMutationData(response),
            items: donationItemDraft.relief_pack_items,
          };
        } catch (error) {
          setDonationItemErrorMessage(error.message || "Failed to create relief pack.");
          return;
        }
      }

      if (!selectedTemplate) {
        setDonationItemErrorMessage("Select a relief pack before adding it.");
        return;
      }

      if (packQuantity <= 0) {
        setDonationItemErrorMessage("Enter the number of relief packs received.");
        return;
      }

      if (!Array.isArray(selectedTemplate.items) || selectedTemplate.items.length === 0) {
        setDonationItemErrorMessage("The selected relief pack has no inventory items.");
        return;
      }

      const expandedItems = selectedTemplate.items.map((templateItem) => {
        const inventoryItemId = templateItem.inventory_item_id;
        const quantityReceived =
          Number(templateItem.quantity_required || 0) * packQuantity;
        const inventoryItem =
          templateItem.inventory_item ||
          inventoryItems.find((item) => item.id === inventoryItemId);
        const packRemark = buildReliefPackRemark(selectedTemplate.name, packQuantity);

        return {
          ...donationItemDraft,
          entry_type: "RELIEF_PACK",
          relief_pack_template_id: selectedTemplate.id,
          relief_pack_name: selectedTemplate.name,
          inventory_item_id: inventoryItemId,
          quantity_received: quantityReceived,
          inventory_item: inventoryItem,
          remarks: packRemark,
        };
      });

      setDonationForm((currentForm) => ({
        ...currentForm,
        items: [...currentForm.items, ...expandedItems],
      }));
      setDonationItemDraft(createDonationItemForm());
      return;
    }

    if (
      donationItemDraft.item_definition_mode === "EXISTING" &&
      !donationItemDraft.inventory_item_id
    ) {
      setDonationItemErrorMessage("Select an inventory item before adding it.");
      return;
    }

    if (Number(donationItemDraft.quantity_received || 0) <= 0) {
      setDonationItemErrorMessage("Enter the quantity received.");
      return;
    }

    let inventoryItemId = donationItemDraft.inventory_item_id;
    let inventoryItem = inventoryItems.find(
      (item) => item.id === donationItemDraft.inventory_item_id,
    );

    if (donationItemDraft.item_definition_mode === "NEW") {
      if (!donationItemDraft.new_item_name.trim()) {
        setDonationItemErrorMessage("Enter the item name.");
        return;
      }

      try {
        const response = await createInventoryItem(
          buildDonationDefinedItemPayload(donationItemDraft),
        );
        inventoryItem = getMutationData(response);
        inventoryItemId = inventoryItem?.id;
      } catch (error) {
        setDonationItemErrorMessage(error.message || "Failed to create inventory item.");
        return;
      }
    }

    if (!inventoryItemId) {
      setDonationItemErrorMessage("Select or define an inventory item before adding it.");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        {
          ...donationItemDraft,
          inventory_item_id: inventoryItemId,
          quantity_received: Number(donationItemDraft.quantity_received),
          inventory_item: inventoryItem,
        },
      ],
    }));
    setDonationItemDraft(createDonationItemForm());
  };

  const startEditDonationItem = (item) => {
    setEditingDonationItemId(item.id);
    setDonationItemDraft({
      entry_type: "ITEM",
      inventory_item_id: item.inventory_item_id,
      relief_pack_template_id: "",
      relief_pack_quantity: 1,
      quantity_received: item.quantity_received,
      remarks: "",
      expiration_date: item.inventory_batch?.expiration_date
        ? item.inventory_batch.expiration_date.slice(0, 10)
        : "",
      storage_location: "",
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
      if (Number(donationItemDraft.quantity_received || 0) <= 0) {
        throw new Error("Enter the quantity received.");
      }

      await updateDonationItem(editingDonationItemId, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: null,
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
      await addDraftDonationItem();
      return;
    }

    setDonationItemErrorMessage("");

    try {
      if (donationItemDraft.entry_type === "RELIEF_PACK") {
        let selectedTemplate = reliefPackTemplates.find(
          (template) => template.id === donationItemDraft.relief_pack_template_id,
        );
        const packQuantity = Number(donationItemDraft.relief_pack_quantity || 0);

        if (donationItemDraft.pack_definition_mode === "NEW") {
          if (!donationItemDraft.new_pack_name.trim()) {
            throw new Error("Enter the relief pack name.");
          }

          if (donationItemDraft.relief_pack_items.length === 0) {
            throw new Error("Add at least one item to the relief pack.");
          }

          const response = await createReliefPackTemplate({
            name: donationItemDraft.new_pack_name.trim(),
            description: null,
            based_on_family_size: true,
            based_on_sector: false,
            is_additional_pack: false,
            sector_id: null,
            is_active: true,
            items: donationItemDraft.relief_pack_items.map((item) => ({
              inventory_item_id: item.inventory_item_id,
              quantity_required: Number(item.quantity_required),
            })),
          });

          selectedTemplate = {
            ...getMutationData(response),
            items: donationItemDraft.relief_pack_items,
          };
        }

        if (!selectedTemplate) {
          throw new Error("Select a relief pack before adding it.");
        }

        if (packQuantity <= 0) {
          throw new Error("Enter the number of relief packs received.");
        }

        if (!Array.isArray(selectedTemplate.items) || selectedTemplate.items.length === 0) {
          throw new Error("The selected relief pack has no inventory items.");
        }

        for (const templateItem of selectedTemplate.items) {
          const packRemark = buildReliefPackRemark(selectedTemplate.name, packQuantity);

          await createDonationItem(donationForm.id, {
            inventory_item_id: templateItem.inventory_item_id,
            quantity_received:
              Number(templateItem.quantity_required || 0) * packQuantity,
            remarks: packRemark,
            expiration_date: donationItemDraft.expiration_date || null,
            storage_location: null,
          });
        }
      } else {
        let inventoryItemId = donationItemDraft.inventory_item_id;

        if (donationItemDraft.item_definition_mode === "NEW") {
          if (!donationItemDraft.new_item_name.trim()) {
            throw new Error("Enter the item name.");
          }

          const response = await createInventoryItem(
            buildDonationDefinedItemPayload(donationItemDraft),
          );
          inventoryItemId = getMutationData(response)?.id;
        }

        if (!inventoryItemId) {
          throw new Error("Select an inventory item before adding it.");
        }

        if (Number(donationItemDraft.quantity_received || 0) <= 0) {
          throw new Error("Enter the quantity received.");
        }

        await createDonationItem(donationForm.id, {
          inventory_item_id: inventoryItemId,
          quantity_received: Number(donationItemDraft.quantity_received),
          remarks: null,
          expiration_date: donationItemDraft.expiration_date || null,
          storage_location: null,
        });
      }

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
    addPackItemToDraft,
    removePackItemFromDraft,
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

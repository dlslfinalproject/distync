import { useState } from "react";
import {
  createDonation,
  createDonationItem,
  deleteDonation,
  deleteDonationItem,
  fetchDonationById,
  fetchDonationDetail,
  updateDonation,
  updateDonationItem,
} from "./donationService";
import {
  createDonationForm,
  createDonationItemForm,
} from "./donationUi";
import { normalizeDonorType } from "./donationFormatters";
import { createInventoryItem } from "../inventory-items/inventoryItemService";
import { createReliefPackTemplate } from "../relief-pack-templates/reliefPackTemplateService";

const getMutationData = (response) => response?.data || response;

const createDraftKey = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildDonationDefinedItemPayload = (draft) => ({
  item_name: (draft.item_name || draft.new_item_name || "").trim(),
  category: draft.category || draft.new_item_category,
  unit_of_measure: draft.unit_of_measure || draft.new_item_unit_of_measure,
  unit_of_measure_value:
    (draft.unit_of_measure || draft.new_item_unit_of_measure) === "pc" ? 1 : 1,
  packaging: draft.packaging || draft.new_item_packaging,
  packaging_count: 1,
  quantity: 1,
  reorder_level: null,
  expiration_date: draft.expiration_date || null,
  barcode: null,
  is_active: true,
  skip_opening_stock: true,
});

const normalizeInventoryItemName = (value) =>
  String(value || "").trim().toLowerCase();

const findInventoryItemByName = (inventoryItems, itemName) => {
  const normalizedItemName = normalizeInventoryItemName(itemName);

  if (!normalizedItemName) {
    return null;
  }

  return (
    inventoryItems.find(
      (item) => normalizeInventoryItemName(item.item_name) === normalizedItemName,
    ) || null
  );
};

const resolveDonationInventoryItem = async ({ draft, inventoryItems }) => {
  const itemName = draft.item_name || draft.new_item_name;
  const existingInventoryItem = findInventoryItemByName(inventoryItems, itemName);

  if (existingInventoryItem?.id) {
    return existingInventoryItem;
  }

  return getMutationData(await createInventoryItem(buildDonationDefinedItemPayload(draft)));
};

const buildReliefPackRemark = (templateName, packQuantity) =>
  `Relief Pack: ${templateName} x ${packQuantity}`;

const buildLooseDonationDraft = (draft) => ({
  draft_id: createDraftKey("donation-item"),
  entry_type: "ITEM",
  item_name: draft.new_item_name.trim(),
  category: draft.new_item_category,
  unit_of_measure: draft.new_item_unit_of_measure,
  packaging: draft.new_item_packaging,
  quantity_received: Number(draft.quantity_received),
  expiration_date: draft.expiration_date || null,
});

const buildReliefPackDraft = (draft) => ({
  draft_id: createDraftKey("donation-pack"),
  entry_type: "RELIEF_PACK",
  relief_pack_name: draft.new_pack_name.trim(),
  relief_pack_quantity: Number(draft.relief_pack_quantity),
  expiration_date: draft.expiration_date || null,
  relief_pack_items: draft.relief_pack_items.map((item) => ({
    ...item,
  })),
});

const buildCurrentDraftDonationEntry = (draft) => {
  if (draft.entry_type === "RELIEF_PACK") {
    if (
      draft.new_pack_name.trim() &&
      Number(draft.relief_pack_quantity || 0) > 0 &&
      Array.isArray(draft.relief_pack_items) &&
      draft.relief_pack_items.length > 0
    ) {
      return buildReliefPackDraft(draft);
    }

    return null;
  }

  if (draft.new_item_name.trim() && Number(draft.quantity_received || 0) > 0) {
    return buildLooseDonationDraft(draft);
  }

  return null;
};

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
        donor_type: normalizeDonorType(donation.donor_type),
        contact_information: donation.contact_information || "",
        received_at: donation.received_at
          ? new Date(donation.received_at).toISOString().slice(0, 10)
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

  const closeDonationDetailModal = () => {
    setIsDonationDetailModalOpen(false);
    setSelectedDonationDetail(null);
    setDonationDetailErrorMessage("");
  };

  const submitDonation = async () => {
    setIsDonationSubmitting(true);
    setDonationErrorMessage("");

    try {
      const itemsForSubmission =
        donationForm.items.length > 0
          ? donationForm.items
          : (() => {
              const currentDraftEntry = buildCurrentDraftDonationEntry(
                donationItemDraft,
              );
              return currentDraftEntry ? [currentDraftEntry] : [];
            })();

      const payload = {
        disaster_event_id: donationForm.disaster_event_id,
        donor_name: donationForm.donor_name.trim(),
        donor_type: normalizeDonorType(donationForm.donor_type),
        contact_information: null,
        received_at: donationForm.received_at || null,
        status: donationForm.status,
        remarks: null,
      };

      if (!donationForm.id) {
        if (itemsForSubmission.length === 0) {
          throw new Error("Add at least one donated item before saving the donation record.");
        }

        const resolvedDonationItems = [];

        for (const item of itemsForSubmission) {
          if (item.entry_type === "RELIEF_PACK") {
            const resolvedPackItems = [];

            for (const packItem of item.relief_pack_items || []) {
              const createdInventoryItem = await resolveDonationInventoryItem({
                draft: {
                  ...packItem,
                  expiration_date: item.expiration_date,
                },
                inventoryItems,
              });

              if (!createdInventoryItem?.id) {
                throw new Error(
                  `Failed to create inventory item for ${packItem.item_name}.`,
                );
              }

              resolvedPackItems.push({
                inventory_item_id: createdInventoryItem.id,
                quantity_required: Number(packItem.quantity_required || 0),
              });

              resolvedDonationItems.push({
                inventory_item_id: createdInventoryItem.id,
                quantity_received:
                  Number(packItem.quantity_required || 0) *
                  Number(item.relief_pack_quantity || 0),
                remarks: buildReliefPackRemark(
                  item.relief_pack_name,
                  Number(item.relief_pack_quantity || 0),
                ),
                expiration_date: item.expiration_date || null,
                storage_location: null,
              });
            }

            await createReliefPackTemplate({
              name: item.relief_pack_name,
              description: null,
              based_on_family_size: true,
              based_on_sector: false,
              is_additional_pack: false,
              sector_id: null,
              is_active: true,
              items: resolvedPackItems,
            });

            continue;
          }

          const createdInventoryItem = await resolveDonationInventoryItem({
            draft: {
              ...item,
              expiration_date: item.expiration_date,
            },
            inventoryItems,
          });

          if (!createdInventoryItem?.id) {
            throw new Error(`Failed to create inventory item for ${item.item_name}.`);
          }

          resolvedDonationItems.push({
            inventory_item_id: createdInventoryItem.id,
            quantity_received: Number(item.quantity_received),
            remarks: item.remarks || null,
            expiration_date: item.expiration_date || null,
            storage_location: null,
          });
        }

        const response = await createDonation({
          ...payload,
          items: resolvedDonationItems,
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

    const quantityRequired = Number(donationItemDraft.pack_item_quantity_required || 0);

    if (!donationItemDraft.new_item_name.trim()) {
      setDonationItemErrorMessage("Enter the item name for this relief pack.");
      return;
    }

    if (quantityRequired <= 0) {
      setDonationItemErrorMessage("Enter the item quantity per relief pack.");
      return;
    }

    setDonationItemDraft((currentDraft) => {
      const existingItem = currentDraft.relief_pack_items.find(
        (item) =>
          item.item_name.toLowerCase() ===
          currentDraft.new_item_name.trim().toLowerCase(),
      );

      const nextPackItems = existingItem
        ? currentDraft.relief_pack_items.map((item) =>
            item.item_name.toLowerCase() ===
            currentDraft.new_item_name.trim().toLowerCase()
              ? {
                  ...item,
                  item_name: currentDraft.new_item_name.trim(),
                  category: currentDraft.new_item_category,
                  unit_of_measure: currentDraft.new_item_unit_of_measure,
                  packaging: currentDraft.new_item_packaging,
                  quantity_required: quantityRequired,
                }
              : item,
          )
        : [
            ...currentDraft.relief_pack_items,
            {
              draft_id: createDraftKey("pack-item"),
              item_name: currentDraft.new_item_name.trim(),
              category: currentDraft.new_item_category,
              unit_of_measure: currentDraft.new_item_unit_of_measure,
              packaging: currentDraft.new_item_packaging,
              quantity_required: quantityRequired,
            },
          ];

      return {
        ...currentDraft,
        relief_pack_items: nextPackItems,
        new_item_name: "",
        pack_item_quantity_required: "1",
      };
    });
  };

  const removePackItemFromDraft = (draftId) => {
    setDonationItemDraft((currentDraft) => ({
      ...currentDraft,
      relief_pack_items: currentDraft.relief_pack_items.filter(
        (item) => (item.draft_id || item.item_name) !== draftId,
      ),
    }));
  };

  const addDraftDonationItem = async () => {
    setDonationItemErrorMessage("");

    if (donationItemDraft.entry_type === "RELIEF_PACK") {
      const packQuantity = Number(donationItemDraft.relief_pack_quantity || 0);
      if (!donationItemDraft.new_pack_name.trim()) {
        setDonationItemErrorMessage("Enter the relief pack name.");
        return;
      }

      if (donationItemDraft.relief_pack_items.length === 0) {
        setDonationItemErrorMessage("Add at least one item to the relief pack.");
        return;
      }

      if (packQuantity <= 0) {
        setDonationItemErrorMessage("Enter the number of relief packs received.");
        return;
      }

      setDonationForm((currentForm) => ({
        ...currentForm,
        items: [
          ...currentForm.items,
          buildReliefPackDraft(donationItemDraft),
        ],
      }));
      setDonationItemDraft(createDonationItemForm());
      return;
    }

    if (Number(donationItemDraft.quantity_received || 0) <= 0) {
      setDonationItemErrorMessage("Enter the quantity received.");
      return;
    }

    if (!donationItemDraft.new_item_name.trim()) {
      setDonationItemErrorMessage("Enter the item name.");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        buildLooseDonationDraft(donationItemDraft),
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
      relief_pack_quantity: "1",
      quantity_received: String(item.quantity_received || ""),
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
        const packQuantity = Number(donationItemDraft.relief_pack_quantity || 0);

        if (!donationItemDraft.new_pack_name.trim()) {
          throw new Error("Enter the relief pack name.");
        }

        if (donationItemDraft.relief_pack_items.length === 0) {
          throw new Error("Add at least one item to the relief pack.");
        }

        if (packQuantity <= 0) {
          throw new Error("Enter the number of relief packs received.");
        }

        const resolvedPackItems = [];

        for (const packItem of donationItemDraft.relief_pack_items) {
          const createdInventoryItem = await resolveDonationInventoryItem({
            draft: {
              ...packItem,
              expiration_date: donationItemDraft.expiration_date,
            },
            inventoryItems,
          });

          if (!createdInventoryItem?.id) {
            throw new Error(`Failed to create inventory item for ${packItem.item_name}.`);
          }

          resolvedPackItems.push({
            inventory_item_id: createdInventoryItem.id,
            quantity_required: Number(packItem.quantity_required || 0),
          });
        }

        await createReliefPackTemplate({
          name: donationItemDraft.new_pack_name.trim(),
          description: null,
          based_on_family_size: true,
          based_on_sector: false,
          is_additional_pack: false,
          sector_id: null,
          is_active: true,
          items: resolvedPackItems,
        });

        for (const templateItem of resolvedPackItems) {
          const packRemark = buildReliefPackRemark(
            donationItemDraft.new_pack_name.trim(),
            packQuantity,
          );

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
        if (!donationItemDraft.new_item_name.trim()) {
          throw new Error("Enter the item name.");
        }

        const createdInventoryItem = await resolveDonationInventoryItem({
          draft: donationItemDraft,
          inventoryItems,
        });
        const inventoryItemId = createdInventoryItem?.id;

        if (!inventoryItemId) {
          throw new Error("Define the inventory item before adding it.");
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
              : "Failed to delete donation item."),
        });
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  return {
    deleteConfirmation,
    isDeleteSubmitting,
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
    setDonationForm,
    setDonationItemDraft,
    openDonationModal,
    closeDonationModal,
    openDonationDetailModal,
    closeDonationDetailModal,
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
    handleDeleteDonation,
    handleCancelDeleteConfirmation,
    handleConfirmDelete,
  };
};

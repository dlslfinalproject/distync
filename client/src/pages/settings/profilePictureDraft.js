export const PROFILE_PICTURE_ACTIONS = Object.freeze({
  UNCHANGED: "UNCHANGED",
  REPLACE: "REPLACE",
  REMOVE: "REMOVE",
});
export const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export const isProfilePictureFileSizeAllowed = (file) =>
  isSelectedProfilePictureFile(file) &&
  file.size <= PROFILE_PICTURE_MAX_FILE_SIZE_BYTES;

export const isSelectedProfilePictureFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

export const createProfilePictureDraftState = () => ({
  selectedPictureFile: null,
  selectedPicturePreviewUrl: "",
  pictureAction: PROFILE_PICTURE_ACTIONS.UNCHANGED,
});

export const hasProfilePictureDraftChanges = (draft = {}) =>
  (draft.pictureAction || PROFILE_PICTURE_ACTIONS.UNCHANGED) !==
  PROFILE_PICTURE_ACTIONS.UNCHANGED;

export const buildPictureDraftForSelection = ({
  file,
  previewUrl,
} = {}) => {
  if (!isSelectedProfilePictureFile(file)) {
    return createProfilePictureDraftState();
  }

  return {
    selectedPictureFile: file,
    selectedPicturePreviewUrl: String(previewUrl || ""),
    pictureAction: PROFILE_PICTURE_ACTIONS.REPLACE,
  };
};

export const buildPictureDraftForRemoval = () => ({
  selectedPictureFile: null,
  selectedPicturePreviewUrl: "",
  pictureAction: PROFILE_PICTURE_ACTIONS.REMOVE,
});

export const getProfilePicturePresentation = ({
  draft,
  savedProfile,
} = {}) => {
  const currentDraft = draft || createProfilePictureDraftState();
  const profile = savedProfile || {};
  const pictureAction =
    currentDraft.pictureAction || PROFILE_PICTURE_ACTIONS.UNCHANGED;

  if (pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE) {
    return {
      profilePictureSource: "",
      hasProfilePicture: false,
      isPreview: false,
      pictureAction,
    };
  }

  if (
    pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE &&
    currentDraft.selectedPicturePreviewUrl
  ) {
    return {
      profilePictureSource: currentDraft.selectedPicturePreviewUrl,
      hasProfilePicture: true,
      isPreview: true,
      pictureAction,
    };
  }

  return {
    // Display-only source. Upload payloads must come from selectedPictureFile.
    profilePictureSource: String(profile.profilePictureUrl || ""),
    hasProfilePicture: Boolean(profile.profilePicturePath),
    isPreview: false,
    pictureAction,
  };
};

export const getProfilePictureUiState = ({
  draft,
  savedProfile,
} = {}) => {
  const presentation = getProfilePicturePresentation({
    draft,
    savedProfile,
  });
  const pictureAction =
    presentation.pictureAction || PROFILE_PICTURE_ACTIONS.UNCHANGED;

  return {
    ...presentation,
    hasSavedPicture: Boolean(savedProfile?.profilePicturePath),
    hasPendingPictureChange: pictureAction !== PROFILE_PICTURE_ACTIONS.UNCHANGED,
    statusLabel:
      pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE
        ? "Unsaved picture"
        : pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE
          ? "Removal pending"
          : "",
    cancelLabel:
      pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE
        ? "Cancel change"
        : pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE
          ? "Cancel removal"
          : "",
    showRemoveAction:
      Boolean(savedProfile?.profilePicturePath) &&
      pictureAction === PROFILE_PICTURE_ACTIONS.UNCHANGED,
  };
};

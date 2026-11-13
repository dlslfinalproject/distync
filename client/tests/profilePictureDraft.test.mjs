import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPictureDraftForRemoval,
  buildPictureDraftForSelection,
  createProfilePictureDraftState,
  getProfilePicturePresentation,
  getProfilePictureUiState,
  hasProfilePictureDraftChanges,
  isProfilePictureFileSizeAllowed,
  isSelectedProfilePictureFile,
  PROFILE_PICTURE_ACTIONS,
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
} from "../src/pages/settings/profilePictureDraft.js";

test("profile picture draft selection creates a local preview replacement state", () => {
  const selectedFile = new File(["avatar"], "avatar.webp", {
    type: "image/webp",
  });
  const draft = buildPictureDraftForSelection({
    file: selectedFile,
    previewUrl: "blob:preview-url",
  });

  assert.equal(draft.pictureAction, PROFILE_PICTURE_ACTIONS.REPLACE);
  assert.equal(draft.selectedPicturePreviewUrl, "blob:preview-url");
  assert.equal(draft.selectedPictureFile, selectedFile);
  assert.equal(hasProfilePictureDraftChanges(draft), true);

  const presentation = getProfilePicturePresentation({
    draft,
    savedProfile: {
      profilePicturePath: "user-1/saved-picture.jpg",
      profilePictureUrl: "https://example.com/saved-picture.jpg",
    },
  });

  assert.equal(presentation.profilePictureSource, "blob:preview-url");
  assert.equal(presentation.hasProfilePicture, true);
  assert.equal(presentation.isPreview, true);
});

test("profile picture draft removal hides the saved picture until changes are saved", () => {
  const presentation = getProfilePicturePresentation({
    draft: buildPictureDraftForRemoval(),
    savedProfile: {
      profilePicturePath: "user-2/saved-picture.png",
      profilePictureUrl: "https://example.com/saved-picture.png",
    },
  });

  assert.equal(presentation.profilePictureSource, "");
  assert.equal(presentation.hasProfilePicture, false);
  assert.equal(presentation.pictureAction, PROFILE_PICTURE_ACTIONS.REMOVE);
});

test("profile picture UI state exposes compact status labels and remove visibility", () => {
  const replacementState = getProfilePictureUiState({
    draft: buildPictureDraftForSelection({
      file: new File(["avatar"], "avatar.webp", {
        type: "image/webp",
      }),
      previewUrl: "blob:replacement-preview",
    }),
    savedProfile: {
      profilePicturePath: "user-4/saved-picture.jpg",
      profilePictureUrl: "https://example.com/saved-picture.jpg",
    },
  });

  assert.equal(replacementState.statusLabel, "Unsaved picture");
  assert.equal(replacementState.cancelLabel, "Cancel change");
  assert.equal(replacementState.showRemoveAction, false);

  const removalState = getProfilePictureUiState({
    draft: buildPictureDraftForRemoval(),
    savedProfile: {
      profilePicturePath: "user-4/saved-picture.jpg",
      profilePictureUrl: "https://example.com/saved-picture.jpg",
    },
  });

  assert.equal(removalState.statusLabel, "Removal pending");
  assert.equal(removalState.cancelLabel, "Cancel removal");
  assert.equal(removalState.showRemoveAction, false);

  const unchangedState = getProfilePictureUiState({
    draft: createProfilePictureDraftState(),
    savedProfile: {
      profilePicturePath: "user-4/saved-picture.jpg",
      profilePictureUrl: "https://example.com/saved-picture.jpg",
    },
  });

  assert.equal(unchangedState.statusLabel, "");
  assert.equal(unchangedState.showRemoveAction, true);
});

test("unchanged profile picture draft reuses the saved picture metadata", () => {
  const draft = createProfilePictureDraftState();
  const presentation = getProfilePicturePresentation({
    draft,
    savedProfile: {
      profilePicturePath: "user-3/saved-picture.jpg",
      profilePictureUrl: "https://example.com/saved-picture.jpg",
    },
  });

  assert.equal(hasProfilePictureDraftChanges(draft), false);
  assert.equal(presentation.profilePictureSource, "https://example.com/saved-picture.jpg");
  assert.equal(presentation.hasProfilePicture, true);
  assert.equal(presentation.isPreview, false);
});

test("invalid replacement state is collapsed to unchanged when the selected file is not a File", () => {
  const draft = buildPictureDraftForSelection({
    file: { name: "distync-logo.png", type: "image/png" },
    previewUrl: "blob:preview-url",
  });

  assert.deepEqual(draft, createProfilePictureDraftState());
  assert.equal(isSelectedProfilePictureFile(draft.selectedPictureFile), false);
  assert.equal(hasProfilePictureDraftChanges(draft), false);
});

test("profile picture file size validation accepts the 2 MB boundary", () => {
  const justUnderLimit = new File(
    [new Uint8Array(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES - 1)],
    "under-limit.png",
    { type: "image/png" },
  );
  const atLimit = new File(
    [new Uint8Array(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES)],
    "at-limit.png",
    { type: "image/png" },
  );

  assert.equal(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES, 2 * 1024 * 1024);
  assert.equal(isProfilePictureFileSizeAllowed(justUnderLimit), true);
  assert.equal(isProfilePictureFileSizeAllowed(atLimit), true);
});

test("profile picture file size validation rejects files above 2 MB", () => {
  const overLimit = new File(
    [new Uint8Array(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES + 1)],
    "over-limit.png",
    { type: "image/png" },
  );

  assert.equal(isProfilePictureFileSizeAllowed(overLimit), false);
});

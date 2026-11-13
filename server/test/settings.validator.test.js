const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
  PROFILE_PICTURE_MAX_BASE64_TRANSPORT_CHARS,
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  validateSaveCurrentSettings,
} = require("../src/validators/settings.validator");

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

test("validateSaveCurrentSettings accepts structured multi-word names", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane Allyson",
          middleName: "De Leon",
          lastName: "Dela Cruz",
          contactNumber: "09123456789",
        },
      },
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateSaveCurrentSettings(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("validateSaveCurrentSettings rejects protected profile fields", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Juan",
          lastName: "Reyes",
          contactNumber: "+639171234567",
          emailAddress: "override@example.com",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Email, role, and barangay assignment cannot be changed from Account Settings.",
  );
});

test("validateSaveCurrentSettings rejects legacy camelCase notification storage fields", () => {
  const req = {
    body: {
      settings: {
        enabledNotificationRuleCodes: ["SYNC_CONFLICT"],
        notificationChannels: {
          systemAnnouncements: {
            inApp: true,
          },
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Notification preferences must be submitted through the approved modern settings format.",
  );
});

test("validateSaveCurrentSettings rejects legacy snake_case notification storage fields", () => {
  const req = {
    body: {
      settings: {
        enabled_notification_rule_codes_json: ["SYNC_CONFLICT"],
        notification_channels_json: {
          systemAnnouncements: {
            inApp: true,
          },
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Notification preferences must be submitted through the approved modern settings format.",
  );
});

test("validateSaveCurrentSettings rejects legacy fullName updates", () => {
  const req = {
    body: {
      settings: {
        profile: {
          fullName: "Maria Angela Dela Cruz",
          contactNumber: "+639171234567",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Email, role, and barangay assignment cannot be changed from Account Settings.",
  );
});

test("validateSaveCurrentSettings rejects obsolete profile picture persistence fields", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Juan",
          lastName: "Reyes",
          contactNumber: "+639171234567",
          profilePictureDataUrl: "data:image/png;base64,ZmFrZQ==",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Profile picture data must be uploaded through the approved profile-picture workflow.",
  );
});

test("validateSaveCurrentSettings accepts pending profile picture replacement payloads", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane",
          middleName: "",
          lastName: "Reyes",
          contactNumber: "09123456789",
        },
        profilePicture: {
          action: "REPLACE",
          fileName: "avatar.webp",
          mimeType: "image/webp",
          fileDataBase64: "ZmFrZQ==",
        },
      },
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateSaveCurrentSettings(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.validatedBody.settings.profilePicture.action, "REPLACE");
  assert.equal(res.payload, null);
});

test("profile picture encoded transport limit covers the exact 2 MB Base64 length", () => {
  assert.equal(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES, 2 * 1024 * 1024);
  assert.equal(PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH, 2796204);
  assert.equal(PROFILE_PICTURE_MAX_BASE64_TRANSPORT_CHARS, 3 * 1024 * 1024);
  assert.ok(
    PROFILE_PICTURE_MAX_BASE64_TRANSPORT_CHARS >
      PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
  );
});

test("validateSaveCurrentSettings accepts maximum valid encoded profile picture payload", () => {
  const req = {
    body: {
      settings: {
        profilePicture: {
          action: "REPLACE",
          fileName: "avatar.png",
          mimeType: "image/png",
          fileDataBase64: "A".repeat(PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH),
        },
      },
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateSaveCurrentSettings(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("validateSaveCurrentSettings rejects excessive encoded profile picture payloads", () => {
  const req = {
    body: {
      settings: {
        profilePicture: {
          action: "REPLACE",
          fileName: "avatar.png",
          mimeType: "image/png",
          fileDataBase64: "A".repeat(PROFILE_PICTURE_MAX_BASE64_TRANSPORT_CHARS + 1),
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, "Profile picture must be 2 MB or smaller.");
});

test("validateSaveCurrentSettings rejects invalid pending profile picture actions", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane",
          middleName: "",
          lastName: "Reyes",
          contactNumber: "09123456789",
        },
        profilePicture: {
          action: "PURGE",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, "profilePicture.action is invalid");
});

test("validateSaveCurrentSettings rejects asset-like replacement content", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane",
          lastName: "Reyes",
          contactNumber: "09123456789",
        },
        profilePicture: {
          action: "REPLACE",
          fileName: "avatar.png",
          mimeType: "image/png",
          fileDataBase64: "data:image/png;base64,ZmFrZQ==",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "The selected profile picture could not be processed. Choose another image and try again.",
  );
});

test("validateSaveCurrentSettings rejects remove actions that include replacement content", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane",
          lastName: "Reyes",
          contactNumber: "09123456789",
        },
        profilePicture: {
          action: "REMOVE",
          fileName: "avatar.png",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Profile picture removal cannot include replacement content.",
  );
});

test("validateSaveCurrentSettings rejects unchanged actions that include upload content", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane",
          lastName: "Reyes",
          contactNumber: "09123456789",
        },
        profilePicture: {
          action: "UNCHANGED",
          fileDataBase64: "ZmFrZQ==",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Unchanged profile pictures cannot include upload content.",
  );
});

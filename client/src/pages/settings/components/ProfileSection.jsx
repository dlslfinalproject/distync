import React from "react";

const picturePreviewStyles = {
  width: "140px",
  height: "140px",
  borderRadius: "20px",
  border: "1px solid #dbe6f0",
  backgroundColor: "#eef5fc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const ProfileSection = ({
  shellStyles,
  gridStyles,
  cardStyles,
  inputStyles,
  helperTextStyles,
  errorTextStyles,
  pageHeaderStyles,
  labelStyles,
  mutedValueStyles,
  InfoRow,
  preferences,
  profileTouched,
  profileErrors,
  authenticatedUser,
  formatPhilippineContactNumberForDisplay,
  handleProfileFieldChange,
  handleProfileFieldBlur,
  profilePictureInputRef,
  handleProfilePictureChange,
  setPreferences,
  sectionTitle = "Profile",
  description,
  summaryRows,
  fullNameId,
  fullNameHelper,
  positionField,
  assignmentField,
  contactId,
  contactHelper,
  emailId,
  emailHelper,
  pictureTitle = "Profile Picture",
  pictureAlt,
  pictureFallbackText = "No profile picture selected",
  pictureDescriptionFallback,
}) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>{sectionTitle}</h3>
        <p style={mutedValueStyles}>{description}</p>
      </div>

      <div style={{ ...gridStyles, marginBottom: "18px" }}>
        {summaryRows.map((group) => (
          <article key={group.title} style={cardStyles}>
            <h4 style={{ margin: 0, color: "#17324d" }}>{group.title}</h4>
            {group.rows.map((row) => (
              <InfoRow
                key={row.label}
                label={row.label}
                value={row.value}
                muted={row.muted}
              />
            ))}
          </article>
        ))}
      </div>

      <div style={{ ...gridStyles, alignItems: "start" }}>
        <article style={cardStyles}>
          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor={fullNameId} style={labelStyles}>
              Full Name
            </label>
            <input
              id={fullNameId}
              value={preferences.profile.fullName}
              onChange={(event) =>
                handleProfileFieldChange("fullName", event.target.value)
              }
              onBlur={() => handleProfileFieldBlur("fullName")}
              style={{
                ...inputStyles.field,
                ...(profileTouched.fullName && profileErrors.fullName
                  ? inputStyles.errorField
                  : {}),
              }}
            />
            {profileTouched.fullName && profileErrors.fullName ? (
              <p style={errorTextStyles}>{profileErrors.fullName}</p>
            ) : (
              <p style={helperTextStyles}>{fullNameHelper}</p>
            )}
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor={positionField.id} style={labelStyles}>
              {positionField.label}
            </label>
            <input
              id={positionField.id}
              value={positionField.value}
              readOnly
              style={{
                ...inputStyles.field,
                ...inputStyles.lockedField,
              }}
            />
            <p style={helperTextStyles}>{positionField.helper}</p>
          </div>

          {assignmentField ? (
            <div style={{ display: "grid", gap: "8px" }}>
              <label htmlFor={assignmentField.id} style={labelStyles}>
                {assignmentField.label}
              </label>
              <input
                id={assignmentField.id}
                value={assignmentField.value}
                readOnly
                style={{
                  ...inputStyles.field,
                  ...inputStyles.lockedField,
                }}
              />
              {assignmentField.helper ? (
                <p style={helperTextStyles}>{assignmentField.helper}</p>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor={contactId} style={labelStyles}>
              Contact Number
            </label>
            <div style={inputStyles.phoneInputGroup}>
              <div style={inputStyles.phonePrefix}>PH +63</div>
              <input
                id={contactId}
                type="text"
                inputMode="numeric"
                value={formatPhilippineContactNumberForDisplay(
                  preferences.profile.contactNumber,
                )}
                onChange={(event) =>
                  handleProfileFieldChange("contactNumber", event.target.value)
                }
                onBlur={() => handleProfileFieldBlur("contactNumber")}
                placeholder="912 345 6789"
                maxLength={12}
                style={{
                  ...inputStyles.field,
                  ...inputStyles.phoneField,
                  ...(profileTouched.contactNumber && profileErrors.contactNumber
                    ? inputStyles.errorField
                    : {}),
                }}
              />
            </div>
            {profileTouched.contactNumber && profileErrors.contactNumber ? (
              <p style={errorTextStyles}>{profileErrors.contactNumber}</p>
            ) : (
              <p style={helperTextStyles}>{contactHelper}</p>
            )}
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor={emailId} style={labelStyles}>
              Email Address
            </label>
            <input
              id={emailId}
              type="email"
              value={authenticatedUser?.email || preferences.profile.emailAddress}
              readOnly
              style={{
                ...inputStyles.field,
                ...inputStyles.lockedField,
              }}
            />
            {profileTouched.emailAddress && profileErrors.emailAddress ? (
              <p style={errorTextStyles}>{profileErrors.emailAddress}</p>
            ) : (
              <p style={helperTextStyles}>{emailHelper}</p>
            )}
          </div>
        </article>

        <article style={cardStyles}>
          <h4 style={{ margin: 0, color: "#17324d" }}>{pictureTitle}</h4>
          <div style={picturePreviewStyles}>
            {preferences.profile.profilePictureDataUrl ? (
              <img
                src={preferences.profile.profilePictureDataUrl}
                alt={pictureAlt}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{ ...mutedValueStyles, textAlign: "center" }}>
                {pictureFallbackText}
              </span>
            )}
          </div>
          <p style={mutedValueStyles}>
            {preferences.profile.profilePictureFileName || pictureDescriptionFallback}
          </p>
          <input
            ref={profilePictureInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleProfilePictureChange}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => profilePictureInputRef.current?.click()}
              style={pageHeaderStyles.secondaryButton}
            >
              Upload / Change
            </button>
            <button
              type="button"
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    profilePictureDataUrl: "",
                    profilePictureFileName: "",
                  },
                  metadata: {
                    ...current.metadata,
                    lastProfileUpdateAt: new Date().toISOString(),
                  },
                }))
              }
              style={pageHeaderStyles.secondaryButton}
            >
              Remove
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

export default ProfileSection;

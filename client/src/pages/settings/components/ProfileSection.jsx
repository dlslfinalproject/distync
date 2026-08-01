import React from "react";
import ProfileAvatar from "../../../components/shared/ProfileAvatar";
import { buildDisplayName } from "../settingsHelpers";

const ProfileSection = ({
  shellStyles,
  inputStyles,
  errorTextStyles,
  pageHeaderStyles,
  labelStyles,
  mutedValueStyles,
  preferences,
  profileTouched,
  profileErrors,
  authenticatedUser,
  formatPhilippineContactNumberForDisplay,
  handleProfileFieldChange,
  handleProfileFieldBlur,
  profilePictureInputRef,
  handleProfilePictureChange,
  handleRemoveProfilePicture,
  handleProfilePictureLoadError,
  profilePicturePreviewUrl = "",
  isUploadingProfilePicture = false,
  isRemovingProfilePicture = false,
  sectionTitle = "Profile",
  description,
  firstNameId,
  middleNameId,
  lastNameId,
  positionField,
  contactId,
  pictureTitle = "Profile Picture",
  pictureAlt,
  pictureFallbackText = "No profile picture selected",
}) => {
  const sectionDividerStyles = {
    borderTop: "1px solid #e3ecf5",
    margin: "24px 0",
  };

  const sectionHeadingStyles = {
    display: "grid",
    gap: "4px",
  };

  const sectionLabelStyles = {
    ...labelStyles,
    marginBottom: "4px",
  };

  const sectionValueStyles = {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.5,
  };

  const readOnlyFieldStyles = {
    border: "1px solid #d9e5f2",
    borderRadius: "14px",
    backgroundColor: "#f7fbff",
    padding: "14px 16px",
    display: "grid",
    gap: "6px",
    minHeight: "76px",
    boxSizing: "border-box",
  };

  const systemTagStyles = {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "5px 10px",
    borderRadius: "999px",
    backgroundColor: "#edf4fb",
    color: "#476784",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  const getProfileInitials = () => {
    const fullName = buildDisplayName(preferences.profile);
    const sourceName =
      fullName ||
      buildDisplayName({
        firstName: authenticatedUser?.first_name,
        middleName: authenticatedUser?.middle_name,
        lastName: authenticatedUser?.last_name,
      }) ||
      "DISTYNC User";

    const initials = sourceName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    return initials || "DU";
  };

  const displayName =
    buildDisplayName(preferences.profile) ||
    buildDisplayName({
      firstName: authenticatedUser?.first_name,
      middleName: authenticatedUser?.middle_name,
      lastName: authenticatedUser?.last_name,
    }) ||
    getProfileInitials();
  const profilePictureSource =
    profilePicturePreviewUrl || preferences.profile.profilePictureUrl || "";
  const hasProfilePicture =
    Boolean(profilePicturePreviewUrl) ||
    Boolean(preferences.profile.profilePicturePath);

  return (
    <section
      style={{
        ...shellStyles.card,
        padding: "32px",
      }}
    >
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>{sectionTitle}</h3>
      </div>

      <article style={{ display: "grid", gap: "24px" }}>
        <div style={{ display: "grid", gap: "16px" }}>
          <div style={sectionHeadingStyles}>
            <h4 style={{ margin: 0, color: "#17324d" }}>Profile Information</h4>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)",
              gap: "24px",
              alignItems: "start",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "14px",
                justifyItems: "start",
              }}
            >
              <p style={sectionLabelStyles}>Profile Picture</p>
              <ProfileAvatar
                src={profilePictureSource}
                alt={pictureAlt}
                displayName={displayName}
                onError={handleProfilePictureLoadError}
              />
              <input
                ref={profilePictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfilePictureChange}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => profilePictureInputRef.current?.click()}
                  style={pageHeaderStyles.secondaryButton}
                  disabled={isUploadingProfilePicture || isRemovingProfilePicture}
                >
                  {isUploadingProfilePicture ? "Uploading..." : "Change Picture"}
                </button>
                {hasProfilePicture ? (
                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    style={pageHeaderStyles.secondaryButton}
                    disabled={isUploadingProfilePicture || isRemovingProfilePicture}
                  >
                    {isRemovingProfilePicture ? "Removing..." : "Remove Picture"}
                  </button>
                ) : null}
              </div>
              <p style={{ ...mutedValueStyles, fontSize: "12px", margin: 0 }}>
                JPG, PNG, or WEBP up to 2 MB.
              </p>
            </div>

            <div style={{ display: "grid", gap: "20px" }}>
              <div style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                    alignItems: "start",
                  }}
                >
                  <div style={{ display: "grid", gap: "8px" }}>
                    <label htmlFor={firstNameId} style={labelStyles}>
                      First Name *
                    </label>
                    <input
                      id={firstNameId}
                      value={preferences.profile.firstName || ""}
                      onChange={(event) =>
                        handleProfileFieldChange("firstName", event.target.value)
                      }
                      onBlur={() => handleProfileFieldBlur("firstName")}
                      placeholder="Enter first name"
                      style={{
                        ...inputStyles.field,
                        ...(profileTouched.firstName && profileErrors.firstName
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    {profileTouched.firstName && profileErrors.firstName ? (
                      <p style={errorTextStyles}>{profileErrors.firstName}</p>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: "8px" }}>
                    <label htmlFor={middleNameId} style={labelStyles}>
                      Middle Name
                    </label>
                    <input
                      id={middleNameId}
                      value={preferences.profile.middleName || ""}
                      onChange={(event) =>
                        handleProfileFieldChange("middleName", event.target.value)
                      }
                      onBlur={() => handleProfileFieldBlur("middleName")}
                      placeholder="Enter middle name"
                      style={{
                        ...inputStyles.field,
                        ...(profileTouched.middleName && profileErrors.middleName
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    {profileTouched.middleName && profileErrors.middleName ? (
                      <p style={errorTextStyles}>{profileErrors.middleName}</p>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: "8px" }}>
                    <label htmlFor={lastNameId} style={labelStyles}>
                      Last Name *
                    </label>
                    <input
                      id={lastNameId}
                      value={preferences.profile.lastName || ""}
                      onChange={(event) =>
                        handleProfileFieldChange("lastName", event.target.value)
                      }
                      onBlur={() => handleProfileFieldBlur("lastName")}
                      placeholder="Enter last name"
                      style={{
                        ...inputStyles.field,
                        ...(profileTouched.lastName && profileErrors.lastName
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    {profileTouched.lastName && profileErrors.lastName ? (
                      <p style={errorTextStyles}>{profileErrors.lastName}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "16px", maxWidth: "420px" }}>
                <p style={sectionLabelStyles}>Contact Information</p>
                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor={contactId} style={labelStyles}>
                    Mobile Number
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
                        ...(profileTouched.contactNumber &&
                        profileErrors.contactNumber
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                  </div>
                  {profileTouched.contactNumber && profileErrors.contactNumber ? (
                    <p style={errorTextStyles}>{profileErrors.contactNumber}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={sectionDividerStyles} />

        <div style={{ display: "grid", gap: "16px" }}>
          <div style={sectionHeadingStyles}>
            <h4 style={{ margin: 0, color: "#17324d" }}>Account Information</h4>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div style={readOnlyFieldStyles}>
              <p style={sectionLabelStyles}>Email Address</p>
              <p style={sectionValueStyles}>
                {authenticatedUser?.email || preferences.profile.emailAddress || "--"}
              </p>
              <p style={{ ...mutedValueStyles, fontSize: "12px", margin: 0 }}>
                Linked to your authenticated Google account.
              </p>
            </div>

            <div style={readOnlyFieldStyles}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <p style={sectionLabelStyles}>Role</p>
                <span style={systemTagStyles}>Read Only</span>
              </div>
              <p style={sectionValueStyles}>{positionField.value || "--"}</p>
              <p style={{ ...mutedValueStyles, fontSize: "12px", margin: 0 }}>
                Managed by an authorized system administrator.
              </p>
            </div>

            {preferences.profile.assignedBarangay ? (
              <div style={readOnlyFieldStyles}>
                <p style={sectionLabelStyles}>Assigned Barangay</p>
                <p style={sectionValueStyles}>
                  {preferences.profile.assignedBarangay.name || "--"}
                </p>
                <p style={{ ...mutedValueStyles, fontSize: "12px", margin: 0 }}>
                  Managed through user administration.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
};

export default ProfileSection;

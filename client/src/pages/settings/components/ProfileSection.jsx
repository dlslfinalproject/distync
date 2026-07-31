import React from "react";

const picturePreviewStyles = {
  width: "132px",
  height: "132px",
  borderRadius: "999px",
  border: "4px solid #e7f0fa",
  background:
    "linear-gradient(180deg, rgba(239, 246, 253, 1) 0%, rgba(227, 238, 249, 1) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

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
  sectionTitle = "Profile",
  description,
  firstNameId,
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

  const splitFullName = (value = "") => {
    const trimmedValue = String(value || "").trim();

    if (!trimmedValue) {
      return { firstName: "", lastName: "" };
    }

    const segments = trimmedValue.split(/\s+/).filter(Boolean);

    if (segments.length === 1) {
      return {
        firstName: segments[0],
        lastName: "",
      };
    }

    return {
      firstName: segments.slice(0, -1).join(" "),
      lastName: segments[segments.length - 1],
    };
  };

  const joinNameParts = (firstName = "", lastName = "") =>
    [String(firstName || "").trim(), String(lastName || "").trim()]
      .filter(Boolean)
      .join(" ");

  const getProfileInitials = () => {
    const fullName = String(preferences.profile.fullName || "").trim();
    const sourceName =
      fullName ||
      [authenticatedUser?.first_name, authenticatedUser?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "DISTYNC User";

    const initials = sourceName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    return initials || "DU";
  };

  const { firstName, lastName } = splitFullName(preferences.profile.fullName);

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
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        "linear-gradient(180deg, rgba(234, 242, 251, 1) 0%, rgba(220, 233, 247, 1) 100%)",
                      color: "#2f6499",
                      fontSize: "30px",
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  >
                    {getProfileInitials()}
                  </div>
                )}
              </div>
              <input
                ref={profilePictureInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfilePictureChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => profilePictureInputRef.current?.click()}
                style={pageHeaderStyles.secondaryButton}
              >
                Change Picture
              </button>
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
                      First Name
                    </label>
                    <input
                      id={firstNameId}
                      value={firstName}
                      onChange={(event) =>
                        handleProfileFieldChange(
                          "fullName",
                          joinNameParts(event.target.value, lastName),
                        )
                      }
                      onBlur={() => handleProfileFieldBlur("fullName")}
                      placeholder="Enter first name"
                      style={{
                        ...inputStyles.field,
                        ...(profileTouched.fullName && profileErrors.fullName
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    {profileTouched.fullName && profileErrors.fullName ? (
                      <p style={errorTextStyles}>{profileErrors.fullName}</p>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: "8px" }}>
                    <label htmlFor={lastNameId} style={labelStyles}>
                      Last Name
                    </label>
                    <input
                      id={lastNameId}
                      value={lastName}
                      onChange={(event) =>
                        handleProfileFieldChange(
                          "fullName",
                          joinNameParts(firstName, event.target.value),
                        )
                      }
                      onBlur={() => handleProfileFieldBlur("fullName")}
                      placeholder="Enter last name"
                      style={{
                        ...inputStyles.field,
                        ...(profileTouched.fullName && profileErrors.fullName
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
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
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};

export default ProfileSection;

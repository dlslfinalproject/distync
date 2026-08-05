import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const sectionStyles = {
  wrapper: {
    display: "grid",
    gap: "12px",
  },
  helperText: {
    margin: "4px 0 0",
    color: "#607a93",
    fontSize: "12px",
    lineHeight: 1.45,
  },
  loadingText: {
    margin: 0,
    color: "#46627f",
    fontSize: "12px",
    fontWeight: 600,
  },
  errorText: {
    margin: 0,
    color: "#a14d58",
    fontSize: "12px",
    fontWeight: 600,
  },
  groupCard: {
    border: "1px solid #d8e3ee",
    borderRadius: "18px",
    backgroundColor: "#f9fbfe",
    padding: "14px 16px",
    display: "grid",
    gap: "8px",
  },
  suggestionList: {
    display: "grid",
    gap: "8px",
  },
  suggestionCard: {
    border: "1px solid #d3dfeb",
    borderRadius: "16px",
    backgroundColor: "#ffffff",
    padding: "12px 14px",
    display: "grid",
    gap: "8px",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "center",
  },
  suggestionTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  suggestionMeta: {
    margin: "2px 0 0",
    color: "#57738e",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  compactMeta: {
    margin: 0,
    color: "#46627f",
    fontSize: "12px",
    lineHeight: 1.45,
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  badge: {
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  button: {
    border: "1px solid #c8d7e7",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#24496e",
    padding: "9px 14px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    justifySelf: "end",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedValue);
};

const formatMatchedRole = (matchedAs, relationshipToHead) => {
  if (matchedAs === "FAMILY_HEAD") {
    return "Family head match";
  }

  if (relationshipToHead) {
    return `${relationshipToHead} match`;
  }

  return "Family member match";
};

const buildConfidenceStyles = (confidence) => {
  if (confidence === "HIGH") {
    return {
      backgroundColor: "#fdecef",
      color: "#9c4151",
      border: "1px solid #f0c8d0",
    };
  }

  return {
    backgroundColor: "#edf6ff",
    color: "#2f5f8e",
    border: "1px solid #cfe0f1",
  };
};

const normalizeGroupMatches = (matches) => {
  const safeMatches = Array.isArray(matches) ? matches : [];
  const householdIdsWithFamilyHeadMatch = new Set(
    safeMatches
      .filter((match) => match.matched_as === "FAMILY_HEAD")
      .map((match) => match.household_id),
  );

  return safeMatches.filter((match) => {
    if (match.matched_as === "FAMILY_HEAD") {
      return true;
    }

    if (
      householdIdsWithFamilyHeadMatch.has(match.household_id) &&
      String(match.matched_relationship_to_head || "").toUpperCase() === "HEAD"
    ) {
      return false;
    }

    return true;
  });
};

const DuplicateRegistrationSuggestionsSection = ({
  groups,
  isLoading,
  errorMessage,
  onViewHousehold,
}) => {
  const suggestionGroups = Array.isArray(groups) ? groups : [];

  if (!isLoading && !errorMessage && suggestionGroups.length === 0) {
    return null;
  }

  return (
    <section style={shellStyles.card}>
      <div style={sectionStyles.wrapper}>
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Possible Same Name Records
          </h3>
          <p style={sectionStyles.helperText}>
            Review these suggestions before saving to reduce duplicate
            registrations across households.
          </p>
        </div>

        {isLoading ? (
          <p style={sectionStyles.loadingText}>
            Checking possible duplicate household records...
          </p>
        ) : null}

        {!isLoading && errorMessage ? (
          <p style={sectionStyles.errorText}>{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage && suggestionGroups.length > 0
          ? suggestionGroups.map((group) => {
              const visibleMatches = normalizeGroupMatches(group.matches);

              if (visibleMatches.length === 0) {
                return null;
              }

              return (
                <div key={group.person_key} style={sectionStyles.groupCard}>
                  <div style={sectionStyles.suggestionList}>
                    {visibleMatches.map((match) => (
                      <div
                        key={`${group.person_key}-${match.household_id}-${match.matched_as}`}
                        style={sectionStyles.suggestionCard}
                      >
                        <div style={sectionStyles.topRow}>
                          <div>
                            <p style={sectionStyles.suggestionTitle}>
                              {match.family_head_name || "Unnamed household"}
                            </p>
                            <p style={sectionStyles.suggestionMeta}>
                              {match.barangay_name || "Unknown barangay"} | Registered{" "}
                              {formatDateTime(match.registered_at)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onViewHousehold?.(match.household_id)}
                            style={sectionStyles.button}
                          >
                            View Household Details
                          </button>
                        </div>

                        <div style={sectionStyles.badgeRow}>
                          <span
                            style={{
                              ...sectionStyles.badge,
                              ...buildConfidenceStyles(match.match_confidence),
                            }}
                          >
                            {match.match_confidence === "HIGH"
                              ? "Strong duplicate match"
                              : "Possible same name match"}
                          </span>
                          <span
                            style={{
                              ...sectionStyles.badge,
                              backgroundColor: match.is_active
                                ? "#ecf9f1"
                                : "#eef2f6",
                              color: match.is_active ? "#2d7a51" : "#5f7386",
                              border: match.is_active
                                ? "1px solid #cde8d8"
                                : "1px solid #d7dfe7",
                            }}
                          >
                            {match.is_active ? "Active record" : "Archived record"}
                          </span>
                        </div>

                        <p style={sectionStyles.compactMeta}>
                          {formatMatchedRole(
                            match.matched_as,
                            match.matched_relationship_to_head,
                          )}
                          {match.match_reasons?.length
                            ? ` | ${match.match_reasons.join(", ")}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </section>
  );
};

export default DuplicateRegistrationSuggestionsSection;

import React from "react";
import { useNavigate } from "react-router-dom";
import { shellStyles } from "../components/layout/BarangayLayout";
import { useAuth } from "../context/AuthContext";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";

const roles = [
  {
    code: ROLE_CODES.BARANGAY,
    title: "Barangay",
    description: "Masterlist encoding, stub verification, and distribution flow.",
  },
  {
    code: ROLE_CODES.MSWDO,
    title: "MSWDO",
    description: "Disaster events, monitoring pages, and analytics dashboards.",
  },
  {
    code: ROLE_CODES.MAYOR,
    title: "Office of the Mayor",
    description: "Simple inventory items, stock tracking, and relief pack template management.",
  },
  {
    code: ROLE_CODES.DONOR,
    title: "Donor / NGO",
    description: "Temporary donor-facing navigation for development and demos.",
  },
];

const RoleSwitcherPage = () => {
  const navigate = useNavigate();
  const { authError, clearAuthError, isAuthLoading, selectDevelopmentRole } =
    useAuth();

  const handleSelectRole = async (role) => {
    clearAuthError();

    try {
      await selectDevelopmentRole(role);
      navigate(getDefaultRouteForRole(role), { replace: true });
    } catch (error) {
      // AuthContext already stores the readable error for the page.
    }
  };

  return (
    <div
      style={{
        ...shellStyles.page,
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(1080px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <section style={shellStyles.card}>
          <p
            style={{
              margin: 0,
              color: "#60738a",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Development Role Switcher
          </p>
          <h1 style={{ margin: "12px 0 0", color: "#17324d", fontSize: "36px" }}>
            Choose a DISTYNC role
          </h1>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            This temporary selector is only for development, testing, and demo
            navigation. Pick one role to load its default pages, sidebar, and
            backend access token.
          </p>
        </section>

        {authError ? (
          <section
            style={{
              ...shellStyles.card,
              border: "1px solid #efc7ca",
              backgroundColor: "#fff6f7",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#9f4652",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Development Access Error
            </p>
            <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#8f4c55" }}>
              {authError}
            </p>
          </section>
        ) : null}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          {roles.map((role) => (
            <button
              key={role.code}
              type="button"
              onClick={() => handleSelectRole(role.code)}
              disabled={isAuthLoading}
              style={{
                ...shellStyles.card,
                textAlign: "left",
                cursor: "pointer",
                background:
                  "linear-gradient(180deg, #ffffff 0%, #f6faff 100%)",
                opacity: isAuthLoading ? 0.72 : 1,
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#6a8097",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {role.code}
              </p>
              <h2
                style={{
                  margin: "12px 0 0",
                  color: "#17324d",
                  fontSize: "24px",
                }}
              >
                {role.title}
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                {role.description}
              </p>
              {isAuthLoading ? (
                <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                  Preparing role access...
                </p>
              ) : null}
            </button>
          ))}
        </section>
      </div>
    </div>
  );
};

export default RoleSwitcherPage;

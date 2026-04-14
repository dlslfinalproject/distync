import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shellStyles } from "../components/layout/BarangayLayout";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
  setCurrentRole,
} from "../utils/roleSession";

const authorizedRoles = [
  {
    code: ROLE_CODES.BARANGAY,
    title: "Barangay",
    description: "Open the frontline registration, verification, and distribution workflow.",
  },
  {
    code: ROLE_CODES.MSWDO,
    title: "MSWDO",
    description: "Open disaster event management, monitoring, and analytics pages.",
  },
  {
    code: ROLE_CODES.MAYOR,
    title: "Office of the Mayor",
    description: "Open inventory, supplier, and relief pack management pages.",
  },
];

const AccessPage = () => {
  const navigate = useNavigate();
  const [showAuthorizedRoles, setShowAuthorizedRoles] = useState(false);
  const accessMode = getAccessMode();

  const isDemoMode = useMemo(() => {
    return accessMode === ACCESS_MODES.DEMO;
  }, [accessMode]);

  const handleAuthorizedRoleSelect = (role) => {
    setCurrentRole(role);
    navigate(getDefaultRouteForRole(role), { replace: true });
  };

  const handleDonorAccess = () => {
    setCurrentRole(ROLE_CODES.DONOR);
    navigate(getDefaultRouteForRole(ROLE_CODES.DONOR), { replace: true });
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
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          gap: "20px",
        }}
      >
        <section
          style={{
            ...shellStyles.card,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "linear-gradient(180deg, #ffffff 0%, #f5faff 100%)",
          }}
        >
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
            {isDemoMode ? "Demo Access Mode" : "Access Entry"}
          </p>
          <h1 style={{ margin: 0, color: "#17324d", fontSize: "36px" }}>
            Welcome to DISTYNC
          </h1>
          <p style={shellStyles.mutedText}>
            This entry flow is ready for demos now and structured so we can plug
            real authentication into the same redirect logic later.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "6px",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAuthorizedRoles((current) => !current)}
              style={{
                ...shellStyles.card,
                padding: "18px",
                textAlign: "left",
                cursor: "pointer",
                backgroundColor: "#ffffff",
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
                Authorized User Access
              </p>
              <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "22px" }}>
                Staff Login Path
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                Use this to simulate the staff login flow for Barangay, MSWDO,
                and Mayor pages until Google sign-in is connected.
              </p>
            </button>

            <button
              type="button"
              onClick={handleDonorAccess}
              style={{
                ...shellStyles.card,
                padding: "18px",
                textAlign: "left",
                cursor: "pointer",
                backgroundColor: "#ffffff",
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
                Donor / NGO Public Access
              </p>
              <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "22px" }}>
                Public Donation View
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                Continue directly into the donor-facing route without the staff
                access step.
              </p>
            </button>
          </div>

          {showAuthorizedRoles ? (
            <section
              style={{
                border: "1px solid #d7e2ef",
                borderRadius: "18px",
                padding: "18px",
                backgroundColor: "#ffffff",
              }}
            >
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
                Temporary Role Selection
              </p>
              <h3 style={{ margin: "10px 0 0", color: "#17324d" }}>
                Choose an authorized role
              </h3>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                This section is the temporary handoff point where future Google
                login can pass the authenticated user role into the same redirect flow.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "14px",
                  marginTop: "16px",
                }}
              >
                {authorizedRoles.map((role) => (
                  <button
                    key={role.code}
                    type="button"
                    onClick={() => handleAuthorizedRoleSelect(role.code)}
                    style={{
                      border: "1px solid #d7e2ef",
                      borderRadius: "16px",
                      padding: "16px",
                      backgroundColor: "#f8fbff",
                      textAlign: "left",
                      cursor: "pointer",
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
                    <h4 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "20px" }}>
                      {role.title}
                    </h4>
                    <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                      {role.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside
          style={{
            ...shellStyles.card,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
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
              Current App Mode
            </p>
            <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "28px" }}>
              {accessMode}
            </h2>
          </div>

          <div
            style={{
              borderRadius: "16px",
              backgroundColor: "#f6faff",
              border: "1px solid #d7e2ef",
              padding: "18px",
            }}
          >
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
              Future auth hook point
            </h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
              The authorized-user branch is intentionally separated from the role
              session and redirect utilities, so we can replace the temporary role
              selector with real Google sign-in later.
            </p>
          </div>

          <div
            style={{
              borderRadius: "16px",
              backgroundColor: "#fdfefe",
              border: "1px solid #d7e2ef",
              padding: "18px",
            }}
          >
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
              What this mode gives us now
            </h3>
            <ul
              style={{
                margin: "12px 0 0",
                paddingLeft: "18px",
                color: "#60738a",
                lineHeight: 1.7,
              }}
            >
              <li>Role-based redirects</li>
              <li>Role-based sidebar navigation</li>
              <li>Fast demo entry without backend auth changes</li>
              <li>One route guard pattern we can reuse later</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AccessPage;

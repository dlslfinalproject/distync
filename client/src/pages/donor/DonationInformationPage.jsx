import React from "react";
import { useNavigate } from "react-router-dom";

/* ================= ICONS ================= */

const LogoIcon = () => (
  <div
    style={{
      backgroundColor: "#f4c542",
      padding: "10px",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(23, 50, 77, 0.12)",
    }}
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  </div>
);

const HomeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#17324d">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const GroupIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#17324d">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const BoxIconFlat = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#17324d">
    <path d="M20 4.58L13.5 2.33c-.96-.33-2.04-.33-3 0L4 4.58c-.6.21-1 .78-1 1.42V18c0 .64.4 1.21 1 1.42l6.5 2.25c.96.33 2.04.33 3 0l6.5-2.25c.6-.21 1-.78 1-1.42V6c0-.64-.4-1.21-1-1.42zM12 4.07l5.42 1.87L12 7.82 6.58 5.94 12 4.07z" />
  </svg>
);

const PinIcon = () => (
  <svg width="50" height="50" viewBox="0 0 24 24" fill="#17324d">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

/* ================= MAIN COMPONENT ================= */

const DonationInformationPage = () => {
  const navigate = useNavigate();

  const items = [
    {
      name: "Canned Goods",
      count: 245,
      level: "CRITICAL",
      bg: "#f9dada",
      badge: "#c73c3c",
    },
    {
      name: "Rice",
      count: 180,
      level: "HIGH",
      bg: "#fde7d2",
      badge: "#e18b2f",
    },
    {
      name: "Bottled Water",
      count: 120,
      level: "MEDIUM",
      bg: "#f6edc8",
      badge: "#b89a21",
    },
    {
      name: "Instant Noodles",
      count: 200,
      level: "CRITICAL",
      bg: "#f9dada",
      badge: "#c73c3c",
    },
    {
      name: "Blankets",
      count: 95,
      level: "HIGH",
      bg: "#fde7d2",
      badge: "#e18b2f",
    },
    {
      name: "Hygiene Kits",
      count: 70,
      level: "MEDIUM",
      bg: "#f6edc8",
      badge: "#b89a21",
    },
  ];

  return (
    <div style={styles.pageContainer}>

      {/* BACK BUTTON */}
      <div style={styles.backWrapper}>
        <button onClick={() => navigate("/access")} style={styles.backButton}>
          ← Back to Role Selection
        </button>
      </div>

      {/* HERO SECTION */}
      <section style={styles.section}>
        <div style={styles.heroCard}>
          <h1 style={styles.heroTitle}>YOUR DONATION CAN SAVE LIVES!</h1>
          <p style={styles.heroText}>
            We are facing a disaster crisis and urgently need community support
            to help displaced families get through this challenging time.
          </p>

          <div style={styles.donateCta}>DONATE NOW!</div>

          <div style={styles.heroGrid}>
            <button
              style={styles.heroBtn}
              onClick={() => alert("Navigate Home")}
            >
              <HomeIcon />
            </button>
            <button
              style={styles.heroBtn}
              onClick={() => alert("Navigate Groups")}
            >
              <GroupIcon />
            </button>
            <button
              style={styles.heroBtn}
              onClick={() => alert("Navigate Items")}
            >
              <BoxIconFlat />
            </button>
          </div>
        </div>
      </section>

      {/* INVENTORY SECTION */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>CRITICALLY NEEDED ITEMS</h2>
        <div style={styles.inventoryGrid}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{ ...styles.itemCard, backgroundColor: item.bg }}
            >
              <span
                style={{ ...styles.badge, backgroundColor: item.badge }}
              >
                {item.level}
              </span>
              <p style={styles.itemLabel}>{item.name}</p>
              <h3 style={styles.itemCount}>{item.count}</h3>
              <p style={styles.itemSubtext}>units needed</p>
            </div>
          ))}
        </div>
      </section>

      {/* DROP-OFF SECTION */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>DROP-OFF LOCATION</h2>
        <div style={styles.locationContainer}>
          <div style={styles.locationCard}>
            <PinIcon />
            <div style={{ textAlign: "left" }}>
              <h3 style={styles.locationTitle}>Malvar Municipal Hall</h3>
              <p style={styles.locationSub}>
                Brgy. San Pioquinto, Malvar, Batangas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER BAR */}
      <footer style={styles.footerBar}>
        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>📞</span>
          <div>
            <strong>Telephone No:</strong> +63 43 778 5101 <br />
            <strong>Mobile No:</strong> +63 917 825 0356 / +63 917 805 7711
          </div>
        </div>
        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>📧</span>
          <div>
            <strong>Emails:</strong> lgumalvarbatangas@gmail.com <br />
            info@malvarbatangas.gov.ph
          </div>
        </div>
        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>🌐</span>
          <div>
            <strong>Website:</strong> www.malvarbatangas.gov.ph
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ================= STYLES ================= */

const styles = {
  pageContainer: {
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#f7fafe",
    minHeight: "100vh",
    color: "#334155",
  },

  navBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 40px",
    backgroundColor: "#dfe8f2",
    borderBottom: "1px solid #cfdbea",
  },

  navLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  brandName: {
    fontWeight: 800,
    fontSize: "22px",
    color: "#17324d",
    lineHeight: 1,
    letterSpacing: "0.01em",
  },

  brandSub: {
    fontSize: "12px",
    color: "#6b8298",
    marginTop: "4px",
    fontWeight: 500,
  },

  navRight: {
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 700,
  },

  backWrapper: {
    padding: "20px 40px 0",
  },

  backButton: {
    background: "none",
    border: "none",
    color: "#17324d",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "14px",
    padding: 0,
  },

  section: {
    padding: "36px 8%",
    textAlign: "center",
  },

  heroCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #dce7f3",
    borderRadius: "22px",
    padding: "40px 32px",
    boxShadow: "0 10px 30px rgba(23, 50, 77, 0.05)",
  },

  heroTitle: {
    fontSize: "34px",
    fontWeight: 800,
    color: "#17324d",
    margin: "0 0 14px 0",
    letterSpacing: "0.01em",
  },

  heroText: {
    color: "#6b8298",
    fontSize: "16px",
    lineHeight: 1.6,
    maxWidth: "760px",
    margin: "0 auto",
    fontWeight: 500,
  },

  donateCta: {
    margin: "22px 0 0",
    color: "#17324d",
    fontSize: "24px",
    fontWeight: 800,
    letterSpacing: "0.03em",
  },

  heroGrid: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginTop: "30px",
    flexWrap: "wrap",
  },

  heroBtn: {
    width: "170px",
    height: "120px",
    backgroundColor: "#ffffff",
    border: "1px solid #dce7f3",
    borderRadius: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    boxShadow: "0 6px 16px rgba(23, 50, 77, 0.06)",
  },

  sectionHeading: {
    fontSize: "26px",
    color: "#17324d",
    fontWeight: 800,
    marginBottom: "28px",
    letterSpacing: "0.01em",
  },

  inventoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "20px",
  },

  itemCard: {
    padding: "22px 20px",
    borderRadius: "18px",
    position: "relative",
    textAlign: "left",
    border: "1px solid rgba(23, 50, 77, 0.06)",
    boxShadow: "0 6px 18px rgba(23, 50, 77, 0.04)",
  },

  badge: {
    position: "absolute",
    top: "14px",
    right: "14px",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 800,
    padding: "4px 10px",
    borderRadius: "999px",
    letterSpacing: "0.03em",
  },

  itemLabel: {
    margin: 0,
    fontSize: "14px",
    color: "#334155",
    fontWeight: 600,
  },

  itemCount: {
    margin: "10px 0 6px",
    fontSize: "38px",
    color: "#17324d",
    fontWeight: 800,
    lineHeight: 1,
  },

  itemSubtext: {
    margin: 0,
    fontSize: "13px",
    color: "#6b8298",
    fontWeight: 500,
  },

  locationContainer: {
    display: "flex",
    justifyContent: "center",
  },

  locationCard: {
    backgroundColor: "#ffffff",
    padding: "24px 36px",
    borderRadius: "18px",
    border: "1px solid #dce7f3",
    display: "flex",
    alignItems: "center",
    gap: "20px",
    minWidth: "420px",
    boxShadow: "0 8px 20px rgba(23, 50, 77, 0.05)",
  },

  locationTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "24px",
    fontWeight: 800,
  },

  locationSub: {
    margin: "6px 0 0",
    color: "#6b8298",
    fontSize: "14px",
    fontWeight: 500,
  },

  footerBar: {
    backgroundColor: "#dfe8f2",
    padding: "24px 40px",
    display: "flex",
    justifyContent: "space-between",
    gap: "24px",
    fontSize: "13px",
    color: "#17324d",
    marginTop: "40px",
    flexWrap: "wrap",
    borderTop: "1px solid #cfdbea",
  },

  footerItem: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    flex: 1,
    minWidth: "260px",
    lineHeight: 1.6,
    fontWeight: 500,
  },

  footerIcon: {
    fontSize: "18px",
    lineHeight: 1,
  },
};

export default DonationInformationPage;
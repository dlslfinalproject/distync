import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";

/* ================= SVG ICONS ================= */

const HeartIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21s-6-4.35-9-7.5C-1 9 2 3 7 5c2 1 3 3 5 5 2-2 3-4 5-5 5-2 8 4 4 8.5C18 16.65 12 21 12 21z"
      stroke="#0f2a44"
      strokeWidth="1.5"
    />
  </svg>
);

const BoxIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#0f2a44" strokeWidth="1.5" />
  </svg>
);

const LocationIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21s-6-5.5-6-10a6 6 0 1112 0c0 4.5-6 10-6 10z"
      stroke="#0f2a44"
      strokeWidth="1.5"
    />
  </svg>
);

/* ================= MAIN ================= */

const DonationInformationPage = () => {
  const [filter, setFilter] = useState("CRITICAL");

  const items = [
    { name: "Canned Goods", count: 245, level: "CRITICAL" },
    { name: "Water", count: 180, level: "HIGH" },
    { name: "Noodles", count: 150, level: "MEDIUM" },
    { name: "Rice", count: 200, level: "CRITICAL" },
    { name: "Blankets", count: 80, level: "HIGH" },
    { name: "Hygiene Kits", count: 95, level: "MEDIUM" },
  ];

  const filteredItems = items.filter((item) => item.level === filter);

  return (
    <>
      <PageHeader
        eyebrow="Donor Workspace"
        title="Donation Portal"
        description=""
      />

      {/* ================= PART 1: HERO ================= */}
      <section style={styles.section}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>YOUR DONATION CAN SAVE LIVES!</h1>

          <p style={styles.heroText}>
            We are facing a disaster crisis and urgently need community support
            to help displaced families get through this challenging time.
          </p>

          <div style={styles.donateText}>DONATE NOW!</div>
        </div>

        {/* ICONS BELOW HERO */}
        <div style={styles.quickActions}>
          <div style={styles.actionCard} onClick={() => alert("Donate")}>
            <HeartIcon />
            <p>Donate</p>
          </div>

          <div style={styles.actionCard} onClick={() => alert("Items")}>
            <BoxIcon />
            <p>Needed Items</p>
          </div>

          <div style={styles.actionCard} onClick={() => alert("Location")}>
            <LocationIcon />
            <p>Drop-off</p>
          </div>
        </div>
      </section>

      {/* ================= PART 2: ITEMS ================= */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>CRITICALLY NEEDED ITEMS</h2>

        {/* FILTER TABS */}
        <div style={styles.tabs}>
          {["CRITICAL", "HIGH", "MEDIUM"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              style={{
                ...styles.tab,
                backgroundColor: filter === lvl ? "#0f2a44" : "#e5e7eb",
                color: filter === lvl ? "#fff" : "#000",
              }}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div style={styles.grid}>
          {filteredItems.map((item, i) => (
            <div key={i} style={styles.card}>
              <div style={styles.level}>{item.level}</div>
              <h3>{item.name}</h3>
              <p>{item.count} items needed</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PART 3: DROP-OFF ================= */}
      <footer style={styles.footerBar}>
        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>📞</span>
          <div>
            <p style={styles.footerLabel}>Telephone No:</p>
            <p>+63 43 778 5101</p>
            <p>+63 917 825 0356</p>
          </div>
        </div>

        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>📧</span>
          <div>
            <p style={styles.footerLabel}>Emails:</p>
            <p>lgumalvarbatangas@gmail.com</p>
            <p>info@malvarbatangas.gov.ph</p>
          </div>
        </div>

        <div style={styles.footerItem}>
          <span style={styles.footerIcon}>🌐</span>
          <div>
            <p style={styles.footerLabel}>Website:</p>
            <p>www.malvarbatangas.gov.ph</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default DonationInformationPage;

/* ================= STYLES ================= */

const styles = {
  section: {
    marginBottom: "25px",
    textAlign: "center",
  },

  hero: {
    background: "linear-gradient(180deg, #0f2a44, #1b4f72)",
    color: "#fff",
    padding: "50px 20px",
    borderRadius: "10px",
    textAlign: "center",
  },

  heroTitle: {
    fontSize: "26px",
    fontWeight: "700",
  },

  heroText: {
    marginTop: "10px",
    fontSize: "14px",
  },

  donateText: {
    marginTop: "20px",
    fontWeight: "700",
  },

  quickActions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    marginTop: "20px",
  },

  actionCard: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    textAlign: "center",
    cursor: "pointer",
    border: "1px solid #e5e7eb",
  },

  sectionTitle: {
    marginBottom: "15px",
    color: "#0f2a44",
  },

  tabs: {
    display: "flex",
    gap: "10px",
    marginBottom: "15px",
  },

  tab: {
    padding: "8px 15px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
  },

  card: {
    background: "#f7f9fb",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "center",
  },

  level: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#d32f2f",
  },

  locationCard: {
    background: "#f7f9fb",
    padding: "20px",
    borderRadius: "10px",
  },

  footerBar: {
    marginTop: "40px",
    background: "#d9e1ec", 
    padding: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderRadius: "8px",
    flexWrap: "wrap",
  },

  footerItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    minWidth: "220px",
  },

  footerIcon: {
    fontSize: "20px",
  },

  footerLabel: {
    fontWeight: "600",
    marginBottom: "3px",
  },
};
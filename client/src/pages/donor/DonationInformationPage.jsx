import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/* ================= ICONS (Refined to match image) ================= */

const LogoIcon = () => (
  <div style={{ backgroundColor: '#f1c40f', padding: '10px', borderRadius: '50%', display: 'flex' }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  </div>
);

const HomeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
);

const GroupIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
);

const BoxIconFlat = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f"><path d="M20 4.58L13.5 2.33c-.96-.33-2.04-.33-3 0L4 4.58c-.6.21-1 .78-1 1.42V18c0 .64.4 1.21 1 1.42l6.5 2.25c.96.33 2.04.33 3 0l6.5-2.25c.6-.21 1-.78 1-1.42V6c0-.64-.4-1.21-1-1.42zM12 4.07l5.42 1.87L12 7.82 6.58 5.94 12 4.07z" /></svg>
);

const PinIcon = () => (
  <svg width="50" height="50" viewBox="0 0 24 24" fill="#1e3a5f"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
);

/* ================= MAIN COMPONENT ================= */

const DonationInformationPage = () => {
  const navigate = useNavigate();

  // Mock data representing the visual states in the images
  const items = [
    { name: "Canned Goods", count: 245, level: "CRITICAL", bg: "#f3d1d1", badge: "#c0392b" },
    { name: "Canned Goods", count: 245, level: "HIGH", bg: "#fce3cf", badge: "#e67e22" },
    { name: "Canned Goods", count: 245, level: "MEDIUM", bg: "#f0e4bc", badge: "#b7950b" },
    { name: "Canned Goods", count: 245, level: "CRITICAL", bg: "#f3d1d1", badge: "#c0392b" },
    { name: "Canned Goods", count: 245, level: "HIGH", bg: "#fce3cf", badge: "#e67e22" },
    { name: "Canned Goods", count: 245, level: "MEDIUM", bg: "#f0e4bc", badge: "#b7950b" },
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
        <h1 style={styles.heroTitle}>YOUR DONATION CAN SAVE LIVES!</h1>
        <p style={styles.heroText}>
          We are facing a disaster crisis and urgently need community support to <br />
          help displaced families get through this challenging time.
        </p>
        <div style={styles.donateCta}>
          <strong>DONATE NOW!</strong>
          <div style={{ fontSize: '20px', marginTop: '5px' }}></div>
        </div>

        <div style={styles.heroGrid}>
          <button style={styles.heroBtn} onClick={() => alert("Navigate Home")}><HomeIcon /></button>
          <button style={styles.heroBtn} onClick={() => alert("Navigate Groups")}><GroupIcon /></button>
          <button style={styles.heroBtn} onClick={() => alert("Navigate Items")}><BoxIconFlat /></button>
        </div>
      </section>

      {/* INVENTORY SECTION */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>CRITICALLY NEEDED ITEMS</h2>
        <div style={styles.inventoryGrid}>
          {items.map((item, i) => (
            <div key={i} style={{ ...styles.itemCard, backgroundColor: item.bg }}>
              <span style={{ ...styles.badge, backgroundColor: item.badge }}>{item.level}</span>
              <p style={styles.itemLabel}>{item.name}</p>
              <h3 style={styles.itemCount}>{item.count}</h3>
              <p style={styles.itemSubtext}>cans needed</p>
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
            <div style={{ textAlign: 'left' }}>
              <h3 style={styles.locationTitle}>Malvar Municipal Hall</h3>
              <p style={styles.locationSub}>Brgy. San Pioquinto, Malvar, Batangas</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER BAR */}
      <footer style={styles.footerBar}>
        <div style={styles.footerItem}>
          <span>📞</span>
          <div>
            <strong>Telephone No:</strong> +63 43 778 5101 <br />
            <strong>Mobile No:</strong> +63 917 825 0356 / +63 917 805 7711
          </div>
        </div>
        <div style={styles.footerItem}>
          <span>📧</span>
          <div>
            <strong>Emails:</strong> lgumalvarbatangas@gmail.com <br />
            info@malvarbatangas.gov.ph
          </div>
        </div>
        <div style={styles.footerItem}>
          <span>🌐</span>
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
    backgroundColor: "#f8fafd",
    minHeight: "100vh",
  },
  navBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 40px",
    backgroundColor: "#d9e1ec",
    borderBottom: "1px solid #c8d1db",
  },
  navLeft: { display: "flex", alignItems: "center", gap: "12px" },
  brandName: { fontWeight: "bold", fontSize: "18px", color: "#1e3a5f", lineHeight: "1" },
  brandSub: { fontSize: "11px", color: "#555" },
  navRight: { color: "#1e3a5f", fontSize: "14px", fontWeight: "500" },
  
  backWrapper: { padding: "20px 40px 0" },
  backButton: {
    background: "none",
    border: "none",
    color: "#1e3a5f",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "14px",
  },

  section: { padding: "40px 10%", textAlign: "center" },
  heroTitle: { fontSize: "32px", fontWeight: "900", color: "#1e3a5f", margin: "0 0 10px 0" },
  heroText: { color: "#555", fontSize: "16px", lineHeight: "1.4" },
  donateCta: { margin: "20px 0", color: "#1e3a5f" },
  
  heroGrid: { display: "flex", justifyContent: "center", gap: "25px", marginTop: "30px" },
  heroBtn: {
    width: "180px",
    height: "130px",
    backgroundColor: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.1s",
    boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
  },

  sectionHeading: { fontSize: "24px", color: "#1e3a5f", fontWeight: "bold", marginBottom: "30px" },
  
  inventoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "20px",
  },
  itemCard: {
    padding: "20px",
    borderRadius: "8px",
    position: "relative",
    textAlign: "left",
    border: "1px solid rgba(0,0,0,0.05)",
  },
  badge: {
    position: "absolute",
    top: "12px",
    right: "12px",
    color: "#fff",
    fontSize: "9px",
    fontWeight: "bold",
    padding: "2px 8px",
    borderRadius: "10px",
  },
  itemLabel: { margin: 0, fontSize: "13px", color: "#444" },
  itemCount: { margin: "8px 0", fontSize: "36px", color: "#333", fontWeight: "600" },
  itemSubtext: { margin: 0, fontSize: "12px", color: "#666" },

  locationContainer: { display: "flex", justifyContent: "center" },
  locationCard: {
    backgroundColor: "#fff",
    padding: "25px 50px",
    borderRadius: "10px",
    border: "1px solid #ccc",
    display: "flex",
    alignItems: "center",
    gap: "20px",
    minWidth: "400px"
  },
  locationTitle: { margin: 0, color: "#1e3a5f", fontSize: "22px" },
  locationSub: { margin: 0, color: "#777", fontSize: "13px" },

  footerBar: {
    backgroundColor: "#d9e1ec",
    padding: "20px 40px",
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#1e3a5f",
    marginTop: "40px"
  },
  footerItem: { display: "flex", gap: "10px", alignItems: "flex-start", flex: 1 }
};

export default DonationInformationPage;
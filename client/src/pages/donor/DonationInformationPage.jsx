import React from "react";
import { useNavigate } from "react-router-dom";

/* ================= ICONS (Simplified as per image) ================= */
const HomeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

const GroupIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const BoxIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f">
    <path d="M20 4.58L13.5 2.33c-.96-.33-2.04-.33-3 0L4 4.58c-.6.21-1 .78-1 1.42V18c0 .64.4 1.21 1 1.42l6.5 2.25c.96.33 2.04.33 3 0l6.5-2.25c.6-.21 1-.78 1-1.42V6c0-.64-.4-1.21-1-1.42zM12 4.07l5.42 1.87L12 7.82 6.58 5.94 12 4.07zM5 17.39V7.95l6 2.07v9.44l-6-2.07zm14 0l-6 2.07V10.02l6-2.07v9.44z" />
  </svg>
);

const PinIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="#1e3a5f">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

/* ================= MAIN PAGE ================= */

const DonationInformationPage = () => {
  const navigate = useNavigate();

  const items = [
    { name: "Canned Goods", count: 245, level: "CRITICAL", color: "#f8d7da", badge: "#dc3545" },
    { name: "Canned Goods", count: 245, level: "HIGH", color: "#ffe5d0", badge: "#fd7e14" },
    { name: "Canned Goods", count: 245, level: "MEDIUM", color: "#f3e5ab", badge: "#d4a017" },
    { name: "Canned Goods", count: 245, level: "CRITICAL", color: "#f8d7da", badge: "#dc3545" },
    { name: "Canned Goods", count: 245, level: "HIGH", color: "#ffe5d0", badge: "#fd7e14" },
    { name: "Canned Goods", count: 245, level: "MEDIUM", color: "#f3e5ab", badge: "#d4a017" },
  ];

  return (
    <div style={styles.container}>
      {/* SECTION 1: HERO */}
      <section style={styles.section}>
        <div style={styles.headerArea}>
           <h1 style={styles.mainTitle}>YOUR DONATION CAN SAVE LIVES!</h1>
           <p style={styles.subTitle}>
             We are facing a disaster crisis and urgently need community support to <br />
             help displaced families get through this challenging time.
           </p>
           <div style={styles.donateNow}>
             <strong>DONATE NOW!</strong>
             <div style={{ marginTop: '5px' }}></div>
           </div>
        </div>

        <div style={styles.heroGrid}>
          <div style={styles.heroCard}><HomeIcon /></div>
          <div style={styles.heroCard}><GroupIcon /></div>
          <div style={styles.heroCard}><BoxIcon /></div>
        </div>
      </section>

      {/* SECTION 2: ITEMS */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>CRITICALLY NEEDED ITEMS</h2>
        <div style={styles.inventoryGrid}>
          {items.map((item, idx) => (
            <div key={idx} style={{ ...styles.itemCard, backgroundColor: item.color }}>
              <span style={{ ...styles.badge, backgroundColor: item.badge }}>{item.level}</span>
              <p style={styles.itemName}>{item.name}</p>
              <h3 style={styles.itemCount}>{item.count}</h3>
              <p style={styles.itemSubtext}>cans needed</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: LOCATION */}
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>DROP-OFF LOCATION</h2>
        <div style={styles.locationWrapper}>
           <div style={styles.locationCard}>
              <PinIcon />
              <div style={{ textAlign: 'left' }}>
                <h3 style={styles.locTitle}>Malvar Municipal Hall</h3>
                <p style={styles.locSub}>Brgy. San Pioquinto, Malvar, Batangas</p>
              </div>
           </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div style={styles.footerCol}>
          <p>📞 <strong>Telephone No:</strong> +63 43 778 5101</p>
          <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Mobile No:</strong> +63 917 825 0356</p>
        </div>
        <div style={styles.footerCol}>
          <p>📧 <strong>Emails:</strong> lgumalvarbatangas@gmail.com</p>
          <p>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;info@malvarbatangas.gov.ph</p>
        </div>
        <div style={styles.footerCol}>
          <p>🌐 <strong>Website:</strong> www.malvarbatangas.gov.ph</p>
        </div>
      </footer>
    </div>
  );
};

export default DonationInformationPage;

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f4f7f9',
    minHeight: '100vh',
    paddingBottom: '0',
  },
  section: {
    padding: '40px 10% 20px',
    textAlign: 'center',
  },
  headerArea: {
    marginBottom: '30px',
  },
  mainTitle: {
    fontSize: '32px',
    color: '#1e3a5f',
    letterSpacing: '1px',
    fontWeight: '900',
    marginBottom: '10px',
  },
  subTitle: {
    color: '#555',
    lineHeight: '1.5',
    fontSize: '16px',
  },
  donateNow: {
    marginTop: '20px',
    fontSize: '18px',
    color: '#1e3a5f',
  },
  heroGrid: {
    display: 'flex',
    justifyContent: 'center',
    gap: '30px',
    marginTop: '30px',
  },
  heroCard: {
    backgroundColor: '#fff',
    width: '180px',
    height: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #ddd',
  },
  sectionHeading: {
    color: '#1e3a5f',
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '25px',
  },
  inventoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  itemCard: {
    padding: '20px',
    borderRadius: '8px',
    position: 'relative',
    textAlign: 'left',
    minHeight: '150px',
    border: '1px solid rgba(0,0,0,0.05)',
  },
  badge: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    color: '#fff',
    fontSize: '10px',
    padding: '2px 10px',
    borderRadius: '10px',
    fontWeight: 'bold',
  },
  itemName: { margin: 0, fontSize: '14px', color: '#333' },
  itemCount: { margin: '10px 0 0', fontSize: '32px', color: '#333' },
  itemSubtext: { margin: 0, fontSize: '12px', color: '#666' },
  locationWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '10px',
  },
  locationCard: {
    backgroundColor: '#fff',
    padding: '20px 40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    border: '1px solid #ccc',
  },
  locTitle: { margin: 0, color: '#1e3a5f', fontSize: '20px' },
  locSub: { margin: 0, color: '#777', fontSize: '14px' },
  footer: {
    backgroundColor: '#d9e1ec',
    padding: '20px 5%',
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '50px',
    fontSize: '12px',
    color: '#1e3a5f',
    textAlign: 'left',
  },
  footerCol: {
    flex: 1,
  }
};
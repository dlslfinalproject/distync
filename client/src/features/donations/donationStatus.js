export const donationBadgePalette = {
  URGENT: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  HIGH: { backgroundColor: "#ffedd5", color: "#c2410c" },
  MEDIUM: { backgroundColor: "#fef3c7", color: "#b45309" },
  LOW: { backgroundColor: "#dcfce7", color: "#15803d" },
  RECEIVED: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  PARTIALLY_DISTRIBUTED: { backgroundColor: "#fef3c7", color: "#b45309" },
  DISTRIBUTED: { backgroundColor: "#dcfce7", color: "#15803d" },
  CANCELLED: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  ACTIVE: { backgroundColor: "#dcfce7", color: "#15803d" },
  INACTIVE: { backgroundColor: "#e2e8f0", color: "#475569" },
};

export const getDonationBadgeStyle = (label) =>
  donationBadgePalette[label] || {
    backgroundColor: "#e2e8f0",
    color: "#334155",
  };

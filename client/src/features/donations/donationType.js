export const DONATION_TYPE_KEYS = Object.freeze({
  LOOSE_ITEM: "LOOSE_ITEM",
  RELIEF_PACK: "RELIEF_PACK",
});

export const RELIEF_PACK_DONATION_REMARK_PREFIX = "relief pack:";

export const isReliefPackDonationItemRemark = (remarks) =>
  String(remarks || "")
    .trim()
    .toLowerCase()
    .startsWith(RELIEF_PACK_DONATION_REMARK_PREFIX);

export const isDonatedReliefPackBatch = (batch) => {
  const sourceType = String(batch?.source_type || "")
    .trim()
    .toUpperCase();
  const donationType = String(
    batch?.source_donation_type || batch?.donation?.donation_type || "",
  )
    .trim()
    .toUpperCase();

  return (
    sourceType === "DONATED" &&
    donationType === DONATION_TYPE_KEYS.RELIEF_PACK
  );
};

export const getDonationTypeKey = (items) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  return normalizedItems.length > 0 &&
    normalizedItems.every((item) =>
      isReliefPackDonationItemRemark(item?.remarks),
    )
    ? DONATION_TYPE_KEYS.RELIEF_PACK
    : DONATION_TYPE_KEYS.LOOSE_ITEM;
};

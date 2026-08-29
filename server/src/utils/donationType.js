const DONATION_TYPE_KEYS = Object.freeze({
  LOOSE_ITEM: "LOOSE_ITEM",
  RELIEF_PACK: "RELIEF_PACK",
});

const RELIEF_PACK_DONATION_REMARK_PREFIX = "relief pack:";

const isReliefPackDonationItemRemark = (remarks) =>
  String(remarks || "")
    .trim()
    .toLowerCase()
    .startsWith(RELIEF_PACK_DONATION_REMARK_PREFIX);

const getDonationTypeKey = (items) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  return normalizedItems.length > 0 &&
    normalizedItems.every((item) =>
      isReliefPackDonationItemRemark(item?.remarks),
    )
    ? DONATION_TYPE_KEYS.RELIEF_PACK
    : DONATION_TYPE_KEYS.LOOSE_ITEM;
};

module.exports = {
  DONATION_TYPE_KEYS,
  RELIEF_PACK_DONATION_REMARK_PREFIX,
  isReliefPackDonationItemRemark,
  getDonationTypeKey,
};

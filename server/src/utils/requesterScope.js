const settingsRepository = require("../repositories/settings.repository");

const resolveRequesterBarangayId = async (requester) => {
  if (requester?.defaultBarangayId) {
    return requester.defaultBarangayId;
  }

  if (!requester?.userId) {
    return null;
  }

  const user = await settingsRepository.getUserById(requester.userId);
  return user?.default_barangay_id || null;
};

module.exports = {
  resolveRequesterBarangayId,
};

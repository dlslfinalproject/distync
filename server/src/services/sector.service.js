const sectorRepository = require("../repositories/sector.repository");

const getAllSectors = async () => {
  return sectorRepository.getAllSectors();
};

const getPersonSectors = async () => {
  return sectorRepository.getPersonSectors();
};

const getHouseholdSectors = async () => {
  return sectorRepository.getHouseholdSectors();
};

const getBarangayVisibleSectors = async () => {
  return sectorRepository.getBarangayVisibleSectors();
};

const getMswdoVisibleSectors = async () => {
  return sectorRepository.getMswdoVisibleSectors();
};

module.exports = {
  getAllSectors,
  getPersonSectors,
  getHouseholdSectors,
  getBarangayVisibleSectors,
  getMswdoVisibleSectors,
};

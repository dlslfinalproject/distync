const supplierRepository = require("../repositories/supplier.repository");

const ensureUniqueSupplierName = async (name, currentSupplierId = null) => {
  const existingSupplier = await supplierRepository.getSupplierByName(name);

  if (existingSupplier && existingSupplier.id !== currentSupplierId) {
    const error = new Error("Supplier name already exists");
    error.statusCode = 409;
    throw error;
  }
};

const getSuppliers = async (filters) => {
  return supplierRepository.getSuppliers(filters);
};

const getSupplierById = async (id) => {
  return supplierRepository.getSupplierById(id);
};

const createSupplier = async (supplierData) => {
  await ensureUniqueSupplierName(supplierData.name);
  return supplierRepository.insertSupplier(supplierData);
};

const updateSupplier = async (id, supplierData) => {
  const existingSupplier = await supplierRepository.getSupplierById(id);

  if (!existingSupplier) {
    const error = new Error("Supplier not found");
    error.statusCode = 404;
    throw error;
  }

  await ensureUniqueSupplierName(supplierData.name, id);

  return supplierRepository.updateSupplier(id, supplierData);
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
};

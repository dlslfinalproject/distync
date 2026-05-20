const supplierRepository = require("../repositories/supplier.repository");
const mayorReportExport = require("../utils/mayorReportExport");

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

const exportSuppliers = async (filters, format) => {
  const suppliers = await getSuppliers(filters);
  const rows = suppliers.map((supplier) => ({
    name: supplier.name || "--",
    contact_person: supplier.contact_person || "--",
    contact_number: supplier.contact_number || "--",
    address: supplier.address || "--",
    has_moa: supplier.has_moa ? "Yes" : "No",
  }));

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-suppliers",
    worksheetName: "Suppliers",
    reportTitle: "Suppliers Report",
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      {
        label: "MOA Filter",
        value:
          filters.has_moa === true
            ? "With MOA"
            : filters.has_moa === false
              ? "Without MOA"
              : "All",
      },
    ],
    columns: [
      { key: "name", label: "Name", width: 28, pdfWidth: 155 },
      { key: "contact_person", label: "Contact Person", width: 24, pdfWidth: 120 },
      { key: "contact_number", label: "Contact Number", width: 22, pdfWidth: 100 },
      { key: "address", label: "Address", width: 32, pdfWidth: 250 },
      { key: "has_moa", label: "Has MOA", width: 14, pdfWidth: 70 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  exportSuppliers,
};

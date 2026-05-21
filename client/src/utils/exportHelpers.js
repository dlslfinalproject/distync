export const COMMON_EXPORT_FORMAT_OPTIONS = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

export const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

export const downloadExportFile = (file) => {
  const downloadUrl = window.URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");

  anchor.href = downloadUrl;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(downloadUrl);
};

export const resolveExportErrorMessage = (
  error,
  fallbackMessage = "Unable to export the selected report.",
) => {
  if (error?.message?.includes("No ")) {
    return NO_EXPORT_DATA_MESSAGE;
  }

  return error?.message || fallbackMessage;
};

export const buildExportSuccessMessage = (reportLabel) => {
  return `${reportLabel} exported successfully.`;
};

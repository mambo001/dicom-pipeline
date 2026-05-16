import { format, isValid, parse } from "date-fns";
import type { DicomMetadataSummary } from "@dicom-pipeline/contracts";

export function formatDicomDate(value?: string): string {
  if (!value) {
    return "not present";
  }

  const parsed = parse(value, "yyyyMMdd", new Date());
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : value;
}

export function formatTimestamp(value: string, pattern = "yyyy-MM-dd HH:mm:ss"): string {
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, pattern) : value;
}

export function metadataRows(metadata: DicomMetadataSummary): readonly (readonly [string, string])[] {
  return [
    ["Patient", metadata.patientName ?? "not present"],
    ["Patient ID", metadata.patientId ?? "not present"],
    ["Birth Date", formatDicomDate(metadata.patientBirthDate)],
    ["Modality", metadata.modality ?? "not present"],
    ["Study Date", formatDicomDate(metadata.studyDate)],
    ["Study UID", metadata.studyInstanceUid ?? "not present"],
    ["Series UID", metadata.seriesInstanceUid ?? "not present"],
    ["SOP UID", metadata.sopInstanceUid ?? "not present"],
    ["Image Size", metadata.rows && metadata.columns ? `${metadata.columns} x ${metadata.rows}` : "not present"]
  ];
}
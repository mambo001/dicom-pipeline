export type DicomMetadataSummary = {
  readonly patientName?: string;
  readonly patientId?: string;
  readonly patientBirthDate?: string;
  readonly studyInstanceUid?: string;
  readonly seriesInstanceUid?: string;
  readonly sopInstanceUid?: string;
  readonly modality?: string;
  readonly studyDate?: string;
  readonly rows?: number;
  readonly columns?: number;
};

export type DeidentificationFinding = {
  readonly tag: string;
  readonly name: string;
  readonly action: "removed" | "replaced" | "retained";
};

export type DeidentificationReport = {
  readonly version: 1;
  readonly kind: "deidentification_report";
  readonly rulesetId: string;
  readonly findings: readonly DeidentificationFinding[];
};

export function createDeidentificationReport(
  input: Omit<DeidentificationReport, "version" | "kind">
): DeidentificationReport {
  return {
    version: 1,
    kind: "deidentification_report",
    rulesetId: input.rulesetId,
    findings: input.findings
  };
}

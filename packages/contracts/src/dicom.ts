import { Schema } from "effect";

export const DicomMetadataSummarySchema = Schema.Struct({
  patientName: Schema.optional(Schema.String),
  patientId: Schema.optional(Schema.String),
  patientBirthDate: Schema.optional(Schema.String),
  studyInstanceUid: Schema.optional(Schema.String),
  seriesInstanceUid: Schema.optional(Schema.String),
  sopInstanceUid: Schema.optional(Schema.String),
  sopClassUid: Schema.optional(Schema.String),
  modality: Schema.optional(Schema.String),
  studyDate: Schema.optional(Schema.String),
  rows: Schema.optional(Schema.Number),
  columns: Schema.optional(Schema.Number),
  samplesPerPixel: Schema.optional(Schema.Number),
  photometricInterpretation: Schema.optional(Schema.String),
  bitsAllocated: Schema.optional(Schema.Number),
  bitsStored: Schema.optional(Schema.Number),
  highBit: Schema.optional(Schema.Number),
  pixelRepresentation: Schema.optional(Schema.Number),
  seriesNumber: Schema.optional(Schema.Number),
  instanceNumber: Schema.optional(Schema.Number),
  transferSyntax: Schema.optional(Schema.String)
});

export const DeidentificationFindingSchema = Schema.Struct({
  tag: Schema.String,
  name: Schema.String,
  action: Schema.Literal("removed", "replaced", "retained")
});

export const DeidentificationReportSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("deidentification_report"),
  rulesetId: Schema.String,
  findings: Schema.Array(DeidentificationFindingSchema)
});

export type DicomMetadataSummary = Schema.Schema.Type<typeof DicomMetadataSummarySchema>;
export type DeidentificationFinding = Schema.Schema.Type<typeof DeidentificationFindingSchema>;
export type DeidentificationReport = Schema.Schema.Type<typeof DeidentificationReportSchema>;

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

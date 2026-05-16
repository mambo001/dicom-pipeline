import type { DicomMetadataSummary, StorageObjectRecord } from "@dicom-pipeline/contracts";

type OhifInstance = {
  readonly metadata: Record<string, string | number | readonly number[] | readonly string[]>;
  readonly url: string;
};

export function createOhifDicomJsonManifest(record: StorageObjectRecord, signedReadUrl: string) {
  const metadata = normalizeMetadata(record);

  return {
    studies: [
      {
        StudyInstanceUID: metadata.StudyInstanceUID,
        StudyDate: metadata.StudyDate ?? "",
        StudyTime: "",
        PatientName: metadata.PatientName ?? "Deidentified",
        PatientID: metadata.PatientID ?? "prototype-patient",
        AccessionNumber: "",
        PatientAge: "",
        PatientSex: "",
        NumInstances: 1,
        Modalities: metadata.Modality ?? "OT",
        series: [
          {
            SeriesInstanceUID: metadata.SeriesInstanceUID,
            SeriesNumber: metadata.SeriesNumber ?? 1,
            Modality: metadata.Modality ?? "OT",
            instances: [
              {
                metadata,
                url: `dicomweb:${signedReadUrl}`
              } satisfies OhifInstance
            ]
          }
        ]
      }
    ]
  };
}

function normalizeMetadata(record: StorageObjectRecord): Record<string, string | number | readonly number[] | readonly string[]> {
  const metadata: DicomMetadataSummary = record.dicomMetadata ?? {};
  const studyInstanceUid = metadata.studyInstanceUid ?? fallbackUid(record.correlationId, "1");
  const seriesInstanceUid = metadata.seriesInstanceUid ?? fallbackUid(record.uploadSessionId, "2");
  const sopInstanceUid = metadata.sopInstanceUid ?? fallbackUid(record.uploadSessionId, "3");

  return removeUndefined({
    Columns: metadata.columns,
    Rows: metadata.rows,
    InstanceNumber: metadata.instanceNumber ?? 1,
    SOPClassUID: metadata.sopClassUid ?? "1.2.840.10008.5.1.4.1.1.7",
    PhotometricInterpretation: metadata.photometricInterpretation,
    BitsAllocated: metadata.bitsAllocated,
    BitsStored: metadata.bitsStored,
    PixelRepresentation: metadata.pixelRepresentation,
    SamplesPerPixel: metadata.samplesPerPixel,
    HighBit: metadata.highBit,
    ImageType: ["ORIGINAL", "PRIMARY"],
    Modality: metadata.modality ?? "OT",
    SOPInstanceUID: sopInstanceUid,
    SeriesInstanceUID: seriesInstanceUid,
    StudyInstanceUID: studyInstanceUid,
    SeriesNumber: metadata.seriesNumber ?? 1,
    SeriesDate: metadata.studyDate,
    StudyDate: metadata.studyDate,
    PatientName: "Deidentified",
    PatientID: "prototype-patient"
  });
}

function removeUndefined(input: Record<string, string | number | readonly number[] | readonly string[] | undefined>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Record<string, string | number | readonly number[] | readonly string[]>;
}

function fallbackUid(source: string, suffix: string): string {
  const digits = source.replace(/\D/g, "").slice(0, 24) || "1";
  return `2.25.${digits}.${suffix}`;
}

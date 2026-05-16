import { Schema } from "effect";
import { DicomMetadataSummarySchema } from "./dicom";

export const UploadSessionStatusSchema = Schema.Literal("created", "uploading", "uploaded", "failed");

export const CreateUploadSessionRequestSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("create_upload_session_request"),
  correlationId: Schema.String,
  fileName: Schema.String,
  contentType: Schema.Literal("application/dicom"),
  dicomMetadata: Schema.optional(DicomMetadataSummarySchema),
  fileSha256: Schema.optional(Schema.String),
  sizeBytes: Schema.optional(Schema.Number)
});

export const CreateUploadSessionResponseSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("create_upload_session_response"),
  uploadSessionId: Schema.String,
  objectName: Schema.String,
  signedUploadUrl: Schema.String,
  expiresAt: Schema.String
});

export const StorageObjectRecordSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("storage_object_record"),
  uploadSessionId: Schema.String,
  correlationId: Schema.String,
  bucket: Schema.String,
  objectName: Schema.String,
  status: UploadSessionStatusSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  fileName: Schema.optional(Schema.String),
  dicomMetadata: Schema.optional(DicomMetadataSummarySchema),
  fileSha256: Schema.optional(Schema.String),
  sizeBytes: Schema.optional(Schema.Number)
});

export const UploadStatusUpdateSchema = Schema.Struct({
  status: UploadSessionStatusSchema
});

export const SignedReadUrlResponseSchema = Schema.Struct({
  signedReadUrl: Schema.String
});

export type UploadSessionStatus = Schema.Schema.Type<typeof UploadSessionStatusSchema>;
export type CreateUploadSessionRequest = Schema.Schema.Type<typeof CreateUploadSessionRequestSchema>;
export type CreateUploadSessionResponse = Schema.Schema.Type<typeof CreateUploadSessionResponseSchema>;
export type StorageObjectRecord = Schema.Schema.Type<typeof StorageObjectRecordSchema>;
export type UploadStatusUpdate = Schema.Schema.Type<typeof UploadStatusUpdateSchema>;
export type SignedReadUrlResponse = Schema.Schema.Type<typeof SignedReadUrlResponseSchema>;

export function createUploadSessionRequest(
  input: Omit<CreateUploadSessionRequest, "version" | "kind" | "contentType"> & {
    readonly contentType?: "application/dicom";
  }
): CreateUploadSessionRequest {
  return {
    version: 1,
    kind: "create_upload_session_request",
    correlationId: input.correlationId,
    fileName: input.fileName,
    contentType: input.contentType ?? "application/dicom",
    dicomMetadata: input.dicomMetadata,
    fileSha256: input.fileSha256,
    sizeBytes: input.sizeBytes
  };
}

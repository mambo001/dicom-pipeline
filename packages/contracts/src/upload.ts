export type UploadSessionStatus = "created" | "uploading" | "uploaded" | "failed";

export type CreateUploadSessionRequest = {
  readonly version: 1;
  readonly kind: "create_upload_session_request";
  readonly correlationId: string;
  readonly fileName: string;
  readonly contentType: "application/dicom";
  readonly fileSha256?: string;
  readonly sizeBytes?: number;
};

export type CreateUploadSessionResponse = {
  readonly version: 1;
  readonly kind: "create_upload_session_response";
  readonly uploadSessionId: string;
  readonly objectName: string;
  readonly signedUploadUrl: string;
  readonly expiresAt: string;
};

export type StorageObjectRecord = {
  readonly version: 1;
  readonly kind: "storage_object_record";
  readonly uploadSessionId: string;
  readonly correlationId: string;
  readonly bucket: string;
  readonly objectName: string;
  readonly status: UploadSessionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fileSha256?: string;
  readonly sizeBytes?: number;
};

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
    fileSha256: input.fileSha256,
    sizeBytes: input.sizeBytes
  };
}

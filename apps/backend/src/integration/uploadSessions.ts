import type {
  CreateUploadSessionRequest,
  CreateUploadSessionResponse
} from "@dicom-pipeline/contracts";
import type { ObjectStorage } from "../ports/ObjectStorage";
import type { StorageRecords } from "../ports/StorageRecords";

export type UploadSessionDependencies = {
  readonly objectStorage: ObjectStorage;
  readonly storageRecords: StorageRecords;
};

export async function createUploadSession(
  request: CreateUploadSessionRequest,
  dependencies: UploadSessionDependencies
): Promise<CreateUploadSessionResponse> {
  const uploadSessionId = crypto.randomUUID();
  const signedUpload = await dependencies.objectStorage.createSignedUpload({
    uploadSessionId,
    correlationId: request.correlationId,
    fileName: request.fileName,
    contentType: request.contentType
  });

  await dependencies.storageRecords.create({
    uploadSessionId,
    correlationId: request.correlationId,
    bucket: dependencies.objectStorage.bucket,
    objectName: signedUpload.objectName,
    status: "created",
    fileName: request.fileName,
    dicomMetadata: request.dicomMetadata,
    fileSha256: request.fileSha256,
    sizeBytes: request.sizeBytes
  });

  return {
    version: 1,
    kind: "create_upload_session_response",
    uploadSessionId,
    objectName: signedUpload.objectName,
    signedUploadUrl: signedUpload.signedUploadUrl,
    expiresAt: signedUpload.expiresAt
  };
}

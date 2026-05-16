import type { AppConfig } from "../../data/config";
import type { ObjectStorage } from "../../ports/ObjectStorage";
import { sanitizeObjectPathSegment } from "../../integration/storageNames";

export function makeInMemoryObjectStorage(config: AppConfig): ObjectStorage {
  return {
    bucket: config.gcsBucket,
    createSignedUpload: async (input) => {
      const objectName = `deidentified/${input.correlationId}/${input.uploadSessionId}-${sanitizeObjectPathSegment(input.fileName)}`;
      const expiresAt = new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString();

      return {
        objectName,
        signedUploadUrl: `http://localhost:${config.port}/dev-storage?uploadSessionId=${encodeURIComponent(input.uploadSessionId)}&objectName=${encodeURIComponent(objectName)}`,
        expiresAt
      };
    }
  };
}

import { Storage } from "@google-cloud/storage";
import type { AppConfig } from "../../data/config";
import type { ObjectStorage } from "../../ports/ObjectStorage";
import { sanitizeObjectPathSegment } from "../../integration/storageNames";

export function makeGcsObjectStorage(config: AppConfig): ObjectStorage {
  const storage = new Storage();
  const bucket = storage.bucket(config.gcsBucket);

  return {
    bucket: config.gcsBucket,
    createSignedUpload: async (input) => {
      const objectName = `deidentified/${input.correlationId}/${input.uploadSessionId}-${sanitizeObjectPathSegment(input.fileName)}`;
      const expiresAtMs = Date.now() + config.signedUrlTtlSeconds * 1000;
      const [signedUploadUrl] = await bucket.file(objectName).getSignedUrl({
        action: "write",
        contentType: input.contentType,
        expires: expiresAtMs,
        version: "v4"
      });

      return {
        objectName,
        signedUploadUrl,
        expiresAt: new Date(expiresAtMs).toISOString()
      };
    },
    createSignedRead: async (objectName) => {
      const expiresAtMs = Date.now() + config.signedUrlTtlSeconds * 1000;
      const [signedReadUrl] = await bucket.file(objectName).getSignedUrl({
        action: "read",
        expires: expiresAtMs,
        version: "v4"
      });

      return {
        objectName,
        signedReadUrl,
        expiresAt: new Date(expiresAtMs).toISOString()
      };
    }
  };
}

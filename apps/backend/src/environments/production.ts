import type { AppConfig } from "../data/config";
import { makeFileAuditLog } from "../adapters/file/AuditLog";
import { makeGcsObjectStorage } from "../adapters/gcs/ObjectStorage";
import { makeFileStorageRecords } from "../adapters/file/StorageRecords";
import type { AppDependencies } from "../program";

export function makeProductionDependencies(config: AppConfig): AppDependencies {
  return {
    auditLog: makeFileAuditLog(),
    objectStorage: makeGcsObjectStorage(config),
    storageRecords: makeFileStorageRecords()
  };
}

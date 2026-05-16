import type { AppConfig } from "../data/config";
import { makeFileAuditLog } from "../adapters/file/AuditLog";
import { makeInMemoryObjectStorage } from "../adapters/in-memory/ObjectStorage";
import { makeFileStorageRecords } from "../adapters/file/StorageRecords";
import type { AppDependencies } from "../program";

export function makeDevelopmentDependencies(config: AppConfig): AppDependencies {
  return {
    auditLog: makeFileAuditLog(),
    objectStorage: makeInMemoryObjectStorage(config),
    storageRecords: makeFileStorageRecords()
  };
}

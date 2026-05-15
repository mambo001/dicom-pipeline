import type { AppConfig } from "../data/config";
import { makeInMemoryAuditLog } from "../adapters/in-memory/AuditLog";
import { makeGcsObjectStorage } from "../adapters/gcs/ObjectStorage";
import { makeInMemoryStorageRecords } from "../adapters/in-memory/StorageRecords";
import type { AppDependencies } from "../program";

export function makeProductionDependencies(config: AppConfig): AppDependencies {
  return {
    auditLog: makeInMemoryAuditLog(),
    objectStorage: makeGcsObjectStorage(config),
    storageRecords: makeInMemoryStorageRecords()
  };
}

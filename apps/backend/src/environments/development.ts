import type { AppConfig } from "../data/config";
import { makeInMemoryAuditLog } from "../adapters/in-memory/AuditLog";
import { makeInMemoryObjectStorage } from "../adapters/in-memory/ObjectStorage";
import { makeInMemoryStorageRecords } from "../adapters/in-memory/StorageRecords";
import type { AppDependencies } from "../program";

export function makeDevelopmentDependencies(config: AppConfig): AppDependencies {
  return {
    auditLog: makeInMemoryAuditLog(),
    objectStorage: makeInMemoryObjectStorage(config),
    storageRecords: makeInMemoryStorageRecords()
  };
}

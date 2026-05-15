import type { StorageObjectRecord } from "@dicom-pipeline/contracts";
import type { CreateStorageRecordInput, StorageRecords } from "../../ports/StorageRecords";

export function makeInMemoryStorageRecords(): StorageRecords {
  const records = new Map<string, StorageObjectRecord>();

  return {
    create: async (input: CreateStorageRecordInput) => {
      const now = new Date().toISOString();
      const record: StorageObjectRecord = {
        version: 1,
        kind: "storage_object_record",
        ...input,
        createdAt: now,
        updatedAt: now
      };

      records.set(record.uploadSessionId, record);
      return record;
    },
    updateStatus: async (uploadSessionId, status) => {
      const existing = records.get(uploadSessionId);

      if (!existing) {
        return undefined;
      }

      const updated: StorageObjectRecord = {
        ...existing,
        status,
        updatedAt: new Date().toISOString()
      };

      records.set(uploadSessionId, updated);
      return updated;
    },
    get: async (uploadSessionId) => records.get(uploadSessionId)
  };
}

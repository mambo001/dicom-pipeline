import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { StorageObjectRecord, UploadSessionStatus } from "@dicom-pipeline/contracts";
import type { CreateStorageRecordInput, StorageRecords } from "../../ports/StorageRecords";

const DATA_DIR = "./storage";
const FILE_PATH = join(DATA_DIR, "storage-records.json");

export function makeFileStorageRecords(): StorageRecords {
  const records = new Map<string, StorageObjectRecord>();

  try {
    const raw = readFileSync(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StorageObjectRecord[];
    for (const record of parsed) {
      records.set(record.uploadSessionId, record);
    }
  } catch {
    // File does not exist yet — start with empty map
  }

  function flush() {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE_PATH, JSON.stringify(Array.from(records.values()), null, 2));
  }

  return {
    create: async (input) => {
      const now = new Date().toISOString();
      const record: StorageObjectRecord = {
        version: 1,
        kind: "storage_object_record",
        uploadSessionId: input.uploadSessionId,
        correlationId: input.correlationId,
        bucket: input.bucket,
        objectName: input.objectName,
        status: input.status,
        fileName: input.fileName,
        dicomMetadata: input.dicomMetadata,
        fileSha256: input.fileSha256,
        sizeBytes: input.sizeBytes,
        createdAt: now,
        updatedAt: now
      };
      records.set(record.uploadSessionId, record);
      flush();
      return record;
    },
    updateStatus: async (uploadSessionId, status) => {
      const record = records.get(uploadSessionId);
      if (!record) return undefined;
      const updated: StorageObjectRecord = {
        ...record,
        status,
        updatedAt: new Date().toISOString()
      };
      records.set(uploadSessionId, updated);
      flush();
      return updated;
    },
    get: async (uploadSessionId) => records.get(uploadSessionId)
  };
}

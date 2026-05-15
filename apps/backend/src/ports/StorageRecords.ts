import type { StorageObjectRecord, UploadSessionStatus } from "@dicom-pipeline/contracts";

export type CreateStorageRecordInput = Omit<StorageObjectRecord, "version" | "kind" | "createdAt" | "updatedAt">;

export type StorageRecords = {
  readonly create: (input: CreateStorageRecordInput) => Promise<StorageObjectRecord>;
  readonly updateStatus: (
    uploadSessionId: string,
    status: UploadSessionStatus
  ) => Promise<StorageObjectRecord | undefined>;
  readonly get: (uploadSessionId: string) => Promise<StorageObjectRecord | undefined>;
};

import { describe, expect, it } from "vitest";
import { makeInMemoryStorageRecords } from "./StorageRecords";

describe("makeInMemoryStorageRecords", () => {
  it("creates, reads, and updates storage object records", async () => {
    const records = makeInMemoryStorageRecords();

    const created = await records.create({
      uploadSessionId: "session-1",
      correlationId: "correlation-1",
      bucket: "bucket-1",
      objectName: "deidentified/correlation-1/session-1-study.dcm",
      status: "created",
      fileName: "study.dcm",
      dicomMetadata: { modality: "CT", rows: 512, columns: 512 },
      fileSha256: "sha-256",
      sizeBytes: 123
    });

    expect(created).toMatchObject({
      version: 1,
      kind: "storage_object_record",
      uploadSessionId: "session-1",
      status: "created"
    });
    expect(Date.parse(created.createdAt)).not.toBeNaN();
    expect(await records.get("session-1")).toEqual(created);

    const updated = await records.updateStatus("session-1", "uploaded");

    expect(updated).toMatchObject({ status: "uploaded" });
    expect(await records.get("session-1")).toEqual(updated);
    expect(await records.updateStatus("missing", "failed")).toBeUndefined();
  });
});

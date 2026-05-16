import { describe, expect, it, vi } from "vitest";
import { createUploadSession } from "./uploadSessions";

describe("createUploadSession", () => {
  it("creates a storage record around a signed upload", async () => {
    const uploadSessionId = "00000000-0000-4000-8000-000000000001";

    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce(uploadSessionId);
    const createSignedUpload = vi.fn().mockResolvedValue({
      objectName: `deidentified/correlation-1/${uploadSessionId}-study.dcm`,
      signedUploadUrl: "http://localhost:8080/dev-storage",
      expiresAt: "2026-01-01T00:15:00.000Z"
    });
    const create = vi.fn().mockResolvedValue(undefined);

    const response = await createUploadSession(
      {
        version: 1,
        kind: "create_upload_session_request",
        correlationId: "correlation-1",
        fileName: "study.dcm",
        contentType: "application/dicom",
        fileSha256: "sha-256",
        sizeBytes: 123
      },
      {
        objectStorage: { bucket: "bucket-1", createSignedUpload },
        storageRecords: { create, get: vi.fn(), updateStatus: vi.fn() }
      }
    );

    expect(createSignedUpload).toHaveBeenCalledWith({
      uploadSessionId,
      correlationId: "correlation-1",
      fileName: "study.dcm",
      contentType: "application/dicom"
    });
    expect(create).toHaveBeenCalledWith({
      uploadSessionId,
      correlationId: "correlation-1",
      bucket: "bucket-1",
      objectName: `deidentified/correlation-1/${uploadSessionId}-study.dcm`,
      status: "created",
      fileSha256: "sha-256",
      sizeBytes: 123
    });
    expect(response).toEqual({
      version: 1,
      kind: "create_upload_session_response",
      uploadSessionId,
      objectName: `deidentified/correlation-1/${uploadSessionId}-study.dcm`,
      signedUploadUrl: "http://localhost:8080/dev-storage",
      expiresAt: "2026-01-01T00:15:00.000Z"
    });
  });
});

import { describe, expect, it } from "vitest";
import { createUploadSessionRequest } from "./upload";

describe("createUploadSessionRequest", () => {
  it("creates a DICOM upload session request with defaults", () => {
    expect(
      createUploadSessionRequest({
        correlationId: "correlation-1",
        fileName: "study.dcm",
        fileSha256: "sha-256",
        sizeBytes: 123
      })
    ).toEqual({
      version: 1,
      kind: "create_upload_session_request",
      correlationId: "correlation-1",
      fileName: "study.dcm",
      contentType: "application/dicom",
      fileSha256: "sha-256",
      sizeBytes: 123
    });
  });
});

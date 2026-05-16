import { describe, expect, it } from "vitest";
import { makeInMemoryObjectStorage } from "./ObjectStorage";

describe("makeInMemoryObjectStorage", () => {
  it("creates deterministic development upload URLs", async () => {
    const storage = makeInMemoryObjectStorage({
      port: 8080,
      appEnv: "development",
      gcsBucket: "dev-bucket",
      signedUrlTtlSeconds: 900,
      allowedOrigins: "http://localhost:5173"
    });

    const signedUpload = await storage.createSignedUpload({
      uploadSessionId: "session-1",
      correlationId: "correlation-1",
      fileName: "patient/study 1.dcm",
      contentType: "application/dicom"
    });

    expect(storage.bucket).toBe("dev-bucket");
    expect(signedUpload.objectName).toBe("deidentified/correlation-1/session-1-patient-study_1.dcm");
    expect(signedUpload.signedUploadUrl).toContain("http://localhost:8080/dev-storage?");
    expect(signedUpload.signedUploadUrl).toContain("uploadSessionId=session-1");
    expect(signedUpload.signedUploadUrl).toContain("objectName=deidentified%2Fcorrelation-1%2Fsession-1-patient-study_1.dcm");
    expect(Date.parse(signedUpload.expiresAt)).not.toBeNaN();

    const signedRead = await storage.createSignedRead(signedUpload.objectName);

    expect(signedRead.signedReadUrl).toContain("http://localhost:8080/dev-storage?");
    expect(signedRead.signedReadUrl).toContain("objectName=deidentified%2Fcorrelation-1%2Fsession-1-patient-study_1.dcm");
    expect(Date.parse(signedRead.expiresAt)).not.toBeNaN();
  });
});

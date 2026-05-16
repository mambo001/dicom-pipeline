import { describe, expect, it } from "vitest";
import { createAuditEvent } from "./audit";

describe("createAuditEvent", () => {
  it("creates an audit event with generated identity and timestamp", () => {
    const event = createAuditEvent({
      correlationId: "correlation-1",
      actor: { kind: "desktop", id: "local-client" },
      action: "dicom.file.selected",
      target: { kind: "local_file", id: "sha-256" },
      result: "success",
      details: { fileName: "scan.dcm" }
    });

    expect(event).toMatchObject({
      version: 1,
      kind: "audit_event",
      correlationId: "correlation-1",
      action: "dicom.file.selected",
      result: "success"
    });
    expect(event.eventId).toEqual(expect.any(String));
    expect(Date.parse(event.occurredAt)).not.toBeNaN();
  });

  it("preserves supplied identity, timestamp, and error details", () => {
    const event = createAuditEvent({
      eventId: "event-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      correlationId: "correlation-1",
      actor: { kind: "desktop", id: "local-client" },
      action: "upload.failed",
      target: { kind: "upload_session", id: "session-1" },
      result: "failure",
      errorCode: "network_error"
    });

    expect(event.eventId).toBe("event-1");
    expect(event.occurredAt).toBe("2026-01-01T00:00:00.000Z");
    expect(event.errorCode).toBe("network_error");
  });
});

import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@dicom-pipeline/contracts";
import { makeInMemoryAuditLog } from "./AuditLog";

describe("makeInMemoryAuditLog", () => {
  it("appends events and lists them by correlation ID", async () => {
    const auditLog = makeInMemoryAuditLog();
    const first = makeAuditEvent("event-1", "correlation-1");
    const second = makeAuditEvent("event-2", "correlation-2");

    await auditLog.append(first);
    await auditLog.append(second);

    expect(await auditLog.listByCorrelationId("correlation-1")).toEqual([first]);
    expect(await auditLog.listByCorrelationId("missing")).toEqual([]);
  });
});

function makeAuditEvent(eventId: string, correlationId: string): AuditEvent {
  return {
    version: 1,
    kind: "audit_event",
    eventId,
    correlationId,
    occurredAt: "2026-01-01T00:00:00.000Z",
    actor: { kind: "desktop", id: "local-client" },
    action: "dicom.file.selected",
    target: { kind: "local_file", id: "sha-256" },
    result: "success"
  };
}

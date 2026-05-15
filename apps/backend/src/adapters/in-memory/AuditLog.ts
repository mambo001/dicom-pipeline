import type { AuditEvent } from "@dicom-pipeline/contracts";
import type { AuditLog } from "../../ports/AuditLog";

export function makeInMemoryAuditLog(): AuditLog {
  const events: AuditEvent[] = [];

  return {
    append: async (event) => {
      events.push(event);
      return event;
    },
    listByCorrelationId: async (correlationId) =>
      events.filter((event) => event.correlationId === correlationId)
  };
}

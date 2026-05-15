import type { AuditEvent } from "@dicom-pipeline/contracts";

export type AuditLog = {
  readonly append: (event: AuditEvent) => Promise<AuditEvent>;
  readonly listByCorrelationId: (correlationId: string) => Promise<readonly AuditEvent[]>;
};

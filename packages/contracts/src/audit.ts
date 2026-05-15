export type AuditAction =
  | "dicom.file.selected"
  | "dicom.metadata.parsed"
  | "dicom.phi.detected"
  | "dicom.deidentified"
  | "upload.session.requested"
  | "upload.started"
  | "upload.succeeded"
  | "upload.failed"
  | "upload.retry_scheduled";

export type AuditResult = "success" | "failure";

export type AuditActor = {
  readonly kind: "desktop" | "service" | "user";
  readonly id: string;
};

export type AuditTarget = {
  readonly kind: "local_file" | "dicom_instance" | "storage_object" | "upload_session";
  readonly id: string;
};

export type AuditEvent = {
  readonly version: 1;
  readonly kind: "audit_event";
  readonly eventId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly actor: AuditActor;
  readonly action: AuditAction;
  readonly target: AuditTarget;
  readonly result: AuditResult;
  readonly details?: Record<string, string | number | boolean | null>;
  readonly errorCode?: string;
  readonly previousEventHash?: string;
  readonly eventHash?: string;
};

export type CreateAuditEventInput = Omit<
  AuditEvent,
  "version" | "kind" | "eventId" | "occurredAt"
> & {
  readonly eventId?: string;
  readonly occurredAt?: string;
};

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  return {
    version: 1,
    kind: "audit_event",
    eventId: input.eventId ?? crypto.randomUUID(),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    correlationId: input.correlationId,
    actor: input.actor,
    action: input.action,
    target: input.target,
    result: input.result,
    details: input.details,
    errorCode: input.errorCode,
    previousEventHash: input.previousEventHash,
    eventHash: input.eventHash
  };
}

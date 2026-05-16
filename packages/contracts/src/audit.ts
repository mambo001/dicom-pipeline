import { Schema } from "effect";

export const AuditActionSchema = Schema.Literal(
  "dicom.file.selected",
  "dicom.metadata.parsed",
  "dicom.phi.detected",
  "dicom.deidentified",
  "upload.session.requested",
  "upload.started",
  "upload.succeeded",
  "upload.failed",
  "upload.retry_scheduled"
);

export const AuditResultSchema = Schema.Literal("success", "failure");

export const AuditActorSchema = Schema.Struct({
  kind: Schema.Literal("desktop", "service", "user"),
  id: Schema.String
});

export const AuditTargetSchema = Schema.Struct({
  kind: Schema.Literal("local_file", "dicom_instance", "storage_object", "upload_session"),
  id: Schema.String
});

export const AuditEventSchema = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("audit_event"),
  eventId: Schema.String,
  correlationId: Schema.String,
  occurredAt: Schema.String,
  actor: AuditActorSchema,
  action: AuditActionSchema,
  target: AuditTargetSchema,
  result: AuditResultSchema,
  details: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null) })
  ),
  errorCode: Schema.optional(Schema.String),
  previousEventHash: Schema.optional(Schema.String),
  eventHash: Schema.optional(Schema.String)
});

export type AuditAction = Schema.Schema.Type<typeof AuditActionSchema>;
export type AuditResult = Schema.Schema.Type<typeof AuditResultSchema>;
export type AuditActor = Schema.Schema.Type<typeof AuditActorSchema>;
export type AuditTarget = Schema.Schema.Type<typeof AuditTargetSchema>;
export type AuditEvent = Schema.Schema.Type<typeof AuditEventSchema>;

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
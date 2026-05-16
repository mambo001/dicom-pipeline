import express from "express";
import cors from "cors";
import type { AuditEvent, CreateUploadSessionRequest } from "@dicom-pipeline/contracts";
import { apiError } from "./data/http";
import { createUploadSession } from "./integration/uploadSessions";
import type { AuditLog } from "./ports/AuditLog";
import type { ObjectStorage } from "./ports/ObjectStorage";
import type { StorageRecords } from "./ports/StorageRecords";

export type AppDependencies = {
  readonly auditLog: AuditLog;
  readonly objectStorage: ObjectStorage;
  readonly storageRecords: StorageRecords;
};

export function createApp(dependencies: AppDependencies): express.Express {
  const app = express();

  app.use(cors());

  app.put("/dev-storage", express.raw({ limit: "2gb", type: "application/dicom" }), async (request, response) => {
    const uploadSessionId = String(request.query.uploadSessionId ?? "");
    const objectName = String(request.query.objectName ?? "");

    if (!uploadSessionId || !objectName) {
      response.status(400).json(apiError("invalid_dev_storage_request", "Upload session and object name are required"));
      return;
    }

    const record = await dependencies.storageRecords.get(uploadSessionId);

    if (!record || record.objectName !== objectName) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    await dependencies.storageRecords.updateStatus(uploadSessionId, "uploaded");
    response.status(200).json({ ok: true, bytesReceived: request.body.length });
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/audit-events", async (request, response) => {
    const event = request.body as AuditEvent;

    if (event.kind !== "audit_event" || !event.eventId || !event.correlationId) {
      response.status(400).json(apiError("invalid_audit_event", "Audit event is missing required fields"));
      return;
    }

    const appended = await dependencies.auditLog.append(event);
    response.status(201).json(appended);
  });

  app.get("/api/audit-events/:correlationId", async (request, response) => {
    const events = await dependencies.auditLog.listByCorrelationId(request.params.correlationId);
    response.json({ events });
  });

  app.post("/api/upload-sessions", async (request, response) => {
    const input = request.body as CreateUploadSessionRequest;

    if (input.kind !== "create_upload_session_request" || input.contentType !== "application/dicom") {
      response.status(400).json(apiError("invalid_upload_session_request", "Expected a DICOM upload session request"));
      return;
    }

    const uploadSession = await createUploadSession(input, dependencies);
    response.status(201).json(uploadSession);
  });

  app.post("/api/upload-sessions/:uploadSessionId/status", async (request, response) => {
    const status = request.body?.status as unknown;

    if (status !== "uploading" && status !== "uploaded" && status !== "failed") {
      response.status(400).json(apiError("invalid_upload_status", "Upload status is not supported"));
      return;
    }

    const record = await dependencies.storageRecords.updateStatus(request.params.uploadSessionId, status);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    response.json(record);
  });

  return app;
}

import express from "express";
import cors from "cors";
import {
  AuditEventSchema,
  CreateUploadSessionRequestSchema,
  StorageObjectRecordSchema,
  UploadStatusUpdateSchema,
  validateUnknown
} from "@dicom-pipeline/contracts";
import type { AuditEvent, CreateUploadSessionRequest, StorageObjectRecord, UploadStatusUpdate } from "@dicom-pipeline/contracts";
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
    const validated = validateUnknown(AuditEventSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_audit_event", validated.errors));
      return;
    }

    const appended = await dependencies.auditLog.append(validated.value as AuditEvent);
    response.status(201).json(appended);
  });

  app.get("/api/audit-events/:correlationId", async (request, response) => {
    const events = await dependencies.auditLog.listByCorrelationId(request.params.correlationId);
    response.json({ events });
  });

  app.post("/api/upload-sessions", async (request, response) => {
    const validated = validateUnknown(CreateUploadSessionRequestSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_upload_session_request", validated.errors));
      return;
    }

    const uploadSession = await createUploadSession(validated.value as CreateUploadSessionRequest, dependencies);
    response.status(201).json(uploadSession);
  });

  app.get("/api/upload-sessions/:uploadSessionId", async (request, response) => {
    const record = await dependencies.storageRecords.get(request.params.uploadSessionId);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    response.json(record);
  });

  app.post("/api/upload-sessions/:uploadSessionId/status", async (request, response) => {
    const validated = validateUnknown(UploadStatusUpdateSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_upload_status", validated.errors));
      return;
    }

    const { status } = validated.value as UploadStatusUpdate;
    const record = await dependencies.storageRecords.updateStatus(request.params.uploadSessionId, status);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    response.json(record);
  });

  return app;
}
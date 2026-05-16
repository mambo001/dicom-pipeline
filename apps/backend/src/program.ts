import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
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

const WINDOW_MINUTES = 15;

const skipPreflight = (request: express.Request) => request.method === "OPTIONS";

const auditWriteLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 200, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });
const auditReadLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });
const sessionCreateLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });
const sessionReadLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });
const statusUpdateLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });
const defaultLimiter = rateLimit({ windowMs: WINDOW_MINUTES * 60_000, limit: 100, standardHeaders: true, legacyHeaders: false, skip: skipPreflight });

export function createApp(dependencies: AppDependencies, appEnv: "development" | "production", allowedOrigins: string): express.Express {
  const app = express();
  const devStorageObjects = new Map<string, Buffer>();

  app.use(cors({ origin: allowedOrigins.split(",").map((o) => o.trim()), maxAge: 86400 }));
  app.use(defaultLimiter);

  if (appEnv === "development") {
    app.get("/dev-storage", async (request, response) => {
      const objectName = String(request.query.objectName ?? "");

      if (!objectName) {
        response.status(400).json(apiError("invalid_dev_storage_request", "Object name is required"));
        return;
      }

      const body = devStorageObjects.get(objectName);
      if (!body) {
        response.status(404).json(apiError("dev_storage_object_not_found", "Stored object was not found"));
        return;
      }

      response.contentType("application/dicom").send(body);
    });

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

      devStorageObjects.set(objectName, Buffer.from(request.body));
      await dependencies.storageRecords.updateStatus(uploadSessionId, "uploaded");
      response.status(200).json({ ok: true, bytesReceived: request.body.length });
    });
  }

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/audit-events", auditWriteLimiter, async (request, response) => {
    const validated = validateUnknown(AuditEventSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_audit_event", validated.errors));
      return;
    }

    const appended = await dependencies.auditLog.append(validated.value as AuditEvent);
    response.status(201).json(appended);
  });

  app.get("/api/audit-events/:correlationId", auditReadLimiter, async (request, response) => {
    const correlationId = request.params.correlationId as string;
    const events = await dependencies.auditLog.listByCorrelationId(correlationId);
    response.json({ events });
  });

  app.post("/api/upload-sessions", sessionCreateLimiter, async (request, response) => {
    const validated = validateUnknown(CreateUploadSessionRequestSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_upload_session_request", validated.errors));
      return;
    }

    const uploadSession = await createUploadSession(validated.value as CreateUploadSessionRequest, dependencies);
    response.status(201).json(uploadSession);
  });

  app.get("/api/upload-sessions/:uploadSessionId", sessionReadLimiter, async (request, response) => {
    const { uploadSessionId } = request.params as { readonly uploadSessionId: string };
    const record = await dependencies.storageRecords.get(uploadSessionId);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    response.json(record);
  });

  app.get("/api/upload-sessions/:uploadSessionId/signed-read", sessionReadLimiter, async (request, response) => {
    const { uploadSessionId } = request.params as { readonly uploadSessionId: string };
    const record = await dependencies.storageRecords.get(uploadSessionId);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    if (record.status !== "uploaded") {
      response.status(409).json(apiError("upload_not_available", "Upload must complete before generating a signed read URL"));
      return;
    }

    const signedRead = await dependencies.objectStorage.createSignedRead(record.objectName);
    response.json({ signedReadUrl: signedRead.signedReadUrl });
  });

  app.post("/api/upload-sessions/:uploadSessionId/status", statusUpdateLimiter, async (request, response) => {
    const validated = validateUnknown(UploadStatusUpdateSchema, request.body);

    if (!validated.ok) {
      response.status(400).json(apiError("invalid_upload_status", validated.errors));
      return;
    }

    const { uploadSessionId } = request.params as { readonly uploadSessionId: string };
    const { status } = validated.value as UploadStatusUpdate;
    const record = await dependencies.storageRecords.updateStatus(uploadSessionId, status);

    if (!record) {
      response.status(404).json(apiError("upload_session_not_found", "Upload session was not found"));
      return;
    }

    response.json(record);
  });

  return app;
}

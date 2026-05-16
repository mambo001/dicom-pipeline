import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { makeDevelopmentDependencies } from "./environments/development";
import { createApp } from "./program";

const config = {
  port: 8080,
  appEnv: "development" as const,
  gcsBucket: "dev-bucket",
  signedUrlTtlSeconds: 900,
  allowedOrigins: "http://localhost:5173"
};

describe("createApp", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = createApp(makeDevelopmentDependencies(config), "development", "http://localhost:5173");

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected server to listen on a TCP port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("writes and lists audit events", async () => {
    const event = {
      version: 1,
      kind: "audit_event",
      eventId: "event-1",
      correlationId: "correlation-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      actor: { kind: "desktop", id: "local-client" },
      action: "dicom.file.selected",
      target: { kind: "local_file", id: "sha-256" },
      result: "success"
    };

    const write = await fetch(`${baseUrl}/api/audit-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });

    expect(write.status).toBe(201);
    expect(await write.json()).toEqual(event);

    const read = await fetch(`${baseUrl}/api/audit-events/correlation-1`);

    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ events: [event] });
  });

  it("creates a session, accepts a development upload, and exposes status", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/upload-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        kind: "create_upload_session_request",
        correlationId: "correlation-1",
        fileName: "study.dcm",
        contentType: "application/dicom",
        fileSha256: "sha-256",
        sizeBytes: 4
      })
    });

    expect(sessionResponse.status).toBe(201);
    const session = (await sessionResponse.json()) as {
      readonly uploadSessionId: string;
      readonly signedUploadUrl: string;
      readonly objectName: string;
    };

    const statusBeforeUpload = await fetch(`${baseUrl}/api/upload-sessions/${session.uploadSessionId}`);

    expect(statusBeforeUpload.status).toBe(200);
    expect(await statusBeforeUpload.json()).toMatchObject({
      uploadSessionId: session.uploadSessionId,
      objectName: session.objectName,
      status: "created"
    });

    const localUploadUrl = session.signedUploadUrl.replace("http://localhost:8080", baseUrl);
    const upload = await fetch(localUploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/dicom" },
      body: new Uint8Array([1, 2, 3, 4])
    });

    expect(upload.status).toBe(200);
    expect(await upload.json()).toEqual({ ok: true, bytesReceived: 4 });

    const statusAfterUpload = await fetch(`${baseUrl}/api/upload-sessions/${session.uploadSessionId}`);

    expect(statusAfterUpload.status).toBe(200);
    expect(await statusAfterUpload.json()).toMatchObject({ status: "uploaded" });
  });

  it("allows CORS from allowed origin", async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" }
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("rejects invalid upload session requests", async () => {
    const response = await fetch(`${baseUrl}/api/upload-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "not_an_upload_session_request" })
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { readonly error: { readonly code: string; readonly message: string } };
    expect(body.error.code).toBe("invalid_upload_session_request");
    expect(body.error.message).toContain("is missing");
  });
});

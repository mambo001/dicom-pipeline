import { useState } from "react";
import {
  createAuditEvent,
  createUploadSessionRequest,
  type CreateUploadSessionResponse
} from "@dicom-pipeline/contracts";

type SelectedDicomFile = Awaited<ReturnType<typeof window.dicomDesktop.selectDicomFile>>;

type WorkflowMessage = {
  readonly level: "info" | "success" | "error";
  readonly text: string;
};

export function App() {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8080");
  const [correlationId, setCorrelationId] = useState(() => crypto.randomUUID());
  const [selectedFile, setSelectedFile] = useState<SelectedDicomFile>();
  const [uploadSession, setUploadSession] = useState<CreateUploadSessionResponse>();
  const [messages, setMessages] = useState<readonly WorkflowMessage[]>([]);

  async function selectFile() {
    const file = await window.dicomDesktop.selectDicomFile();

    if (!file) {
      return;
    }

    const nextCorrelationId = crypto.randomUUID();
    setCorrelationId(nextCorrelationId);
    setSelectedFile(file);
    setUploadSession(undefined);
    addMessage("success", `Selected ${file.name}`);

    await appendAuditEvent(nextCorrelationId, "dicom.file.selected", "local_file", file.sha256, {
      fileName: file.name,
      sizeBytes: file.sizeBytes
    });
  }

  async function requestUploadSession() {
    if (!selectedFile) {
      addMessage("error", "Select a DICOM file before requesting an upload session.");
      return;
    }

    await appendAuditEvent(correlationId, "upload.session.requested", "local_file", selectedFile.sha256, {
      fileName: selectedFile.name
    });

    const response = await fetch(`${backendUrl}/api/upload-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        createUploadSessionRequest({
          correlationId,
          fileName: selectedFile.name,
          fileSha256: selectedFile.sha256,
          sizeBytes: selectedFile.sizeBytes
        })
      )
    });

    if (!response.ok) {
      addMessage("error", "Backend rejected upload session request.");
      return;
    }

    const session = (await response.json()) as CreateUploadSessionResponse;
    setUploadSession(session);
    addMessage("success", "Upload session created with signed storage URL.");
  }

  async function appendAuditEvent(
    eventCorrelationId: string,
    action: Parameters<typeof createAuditEvent>[0]["action"],
    targetKind: Parameters<typeof createAuditEvent>[0]["target"]["kind"],
    targetId: string,
    details?: Record<string, string | number | boolean | null>
  ) {
    const event = createAuditEvent({
      correlationId: eventCorrelationId,
      actor: { kind: "desktop", id: "local-prototype-client" },
      action,
      target: { kind: targetKind, id: targetId },
      result: "success",
      details
    });

    const response = await fetch(`${backendUrl}/api/audit-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      addMessage("error", `Failed to write audit event: ${action}`);
    }
  }

  function addMessage(level: WorkflowMessage["level"], text: string) {
    setMessages((current) => [{ level, text }, ...current].slice(0, 8));
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Medical Imaging Ingestion</p>
        <h1>DICOM pipeline desktop prototype</h1>
        <p>
          Select a local DICOM file, write audit events, and request a cloud-native signed
          upload session from the backend.
        </p>
      </section>

      <section className="panel controls">
        <label>
          Backend URL
          <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
        </label>
        <button onClick={selectFile}>Select DICOM</button>
        <button onClick={requestUploadSession} disabled={!selectedFile}>
          Request upload session
        </button>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>Selected File</h2>
          {selectedFile ? (
            <dl>
              <dt>Name</dt>
              <dd>{selectedFile.name}</dd>
              <dt>Size</dt>
              <dd>{selectedFile.sizeBytes.toLocaleString()} bytes</dd>
              <dt>SHA-256</dt>
              <dd className="mono">{selectedFile.sha256}</dd>
              <dt>Correlation ID</dt>
              <dd className="mono">{correlationId}</dd>
            </dl>
          ) : (
            <p>No DICOM file selected.</p>
          )}
        </article>

        <article className="panel">
          <h2>Upload Session</h2>
          {uploadSession ? (
            <dl>
              <dt>Session ID</dt>
              <dd className="mono">{uploadSession.uploadSessionId}</dd>
              <dt>Object</dt>
              <dd className="mono">{uploadSession.objectName}</dd>
              <dt>Expires</dt>
              <dd>{uploadSession.expiresAt}</dd>
            </dl>
          ) : (
            <p>Request a session after selecting a file.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Workflow Log</h2>
        <ul className="messages">
          {messages.map((message, index) => (
            <li key={`${message.text}-${index}`} className={message.level}>
              {message.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

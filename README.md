# DICOM Pipeline Prototype

This project is a focused prototype for DICOM ingestion, local de-identification, secure cloud upload, and auditability.

The implementation is intentionally plain TypeScript. It keeps the hexagonal architecture used in CareBid, but avoids framework-specific functional libraries so reviewers can quickly follow the code.

## Scope

In scope:

- Electron desktop app for selecting local DICOM files
- backend API for upload sessions, audit events, and storage records
- Google Cloud Storage oriented upload flow
- append-only audit records for import, de-identification, upload, and retry events
- shared contracts for backend and desktop boundaries

Not in scope:

- clinical-grade DICOM de-identification guarantees
- direct PACS or VNA integration
- production HIPAA compliance claims
- full diagnostic imaging viewer

## Architecture Summary

```text
Electron desktop app
  |
  v
Backend API
  |
  +--> audit repository
  +--> upload session service
  +--> storage adapter
       |
       v
     Google Cloud Storage
```

## Upload Flow

The ingestion flow uses three explicit steps so each action is independently auditable — a common requirement in regulated medical-imaging pipelines.

### Step 1: Select DICOM — "Inspect what you have"

The Electron main process reads the file locally, extracts DICOM metadata, and produces a de-identification preview. No bytes leave the machine. Audit events (`dicom.file.selected`, `dicom.metadata.parsed`, `dicom.phi.detected`, `dicom.deidentified`) are written.

### Step 2: Create session — "Reserve the upload slot"

The desktop requests a time-limited signed URL from the backend (`POST /api/upload-sessions`). The backend creates a storage record and returns a signed URL that expires after a configurable window (default 15 minutes). No bytes are transferred yet. A `upload.session.requested` audit event is written.

Why a time-limited signed URL?

| Concern | How a signed URL helps |
|---|---|
| Stolen URL | Damage window is limited to the TTL, not permanent |
| Regulatory (HIPAA/HITECH) | Time-bounded access grants preferred over perpetual credentials |
| Replay attacks | A saved URL cannot upload months later |
| Object collision | Stale URLs from old sessions cannot overwrite newer uploads |
| Audit alignment | The `expiresAt` is recorded so auditors can trace the upload window |

### Step 3: Upload file — "Move the bytes"

The Electron main process streams the file from disk directly to the signed URL (`PUT`), with progress relayed to the renderer. This is the only transfer of file bytes. On completion the backend storage record is updated (`uploading` → `uploaded` or `failed`). Audit events (`upload.started`, `upload.succeeded` or `upload.failed`) are written. A failed upload can be retried against the same session.

### Component Interaction

```
┌─────────────────────────────────────────────────┐
│ Electron Desktop App                            │
│                                                 │
│  ┌──────────┐    IPC     ┌───────────┐         │
│  │  Renderer │◄─────────►│  Preload   │         │
│  │ (React)   │           │ (bridge)   │         │
│  └────┬──────┘           └─────┬──────┘         │
│       │                        │                │
│       │ fetch()         invoke │   invoke       │
│       │                 handle │   handle       │
│       │                        │                │
│  ┌────▼──────┐           ┌─────▼──────┐        │
│  │ Backend   │           │   Main     │        │
│  │  API      │           │  Process   │        │
│  └─────┬─────┘           └─────┬──────┘        │
└────────┼───────────────────────┼────────────────┘
         │                       │
         │ POST /api/            │ PUT signed URL
         │   audit-events        │   (stream)
         │   upload-sessions     │
         │   .../status          │
         │                       │
    ┌────▼────┐             ┌────▼────┐
    │ Backend │             │ Storage │
    │ Express │             │ (GCS /  │
    │         │             │  dev-   │
    │ audit ◄─┼── signed ──► storage │
    │  log   │ │  URL gen   │  mock)  │
    │ session│ │            │         │
    │ records│ │            │         │
    └─────────┘             └─────────┘

Step 1 ──► renderer ◄──IPC──► main (local file read + inspect)
Step 2 ──► renderer ──fetch──► backend (session & signed URL)
Step 3 ──► renderer ◄──IPC──► main ──stream──► storage
```

## Repository Layout

- `apps/backend`: plain TypeScript API with ports, adapters, and environment wiring
- `apps/desktop`: Electron app with main, preload, and React renderer boundaries
- `packages/contracts`: shared request, response, and audit event types

## Local Run

```bash
npm install
npm run typecheck
npm run dev
```

App-specific run commands are documented in each app README.

### Platform Compatibility

The `npm run dev` command currently works on **macOS**. It does not work on Linux or WSL because:

- The `concurrently` process group uses `-k` (`--kill-others`), which relies on `ps` flag support that differs between macOS and Linux
- Signal handling across spawned processes is inconsistent on Linux/WSL, causing orphaned `tsc --watch` and `vite` processes
- The `wait-on` timeout is configured for fast macOS filesystem behavior and may false-fail on slower Linux mounts

Fixes are specific to the host OS process model and are out of scope for this prototype. If you need a Linux development environment, start the backend, renderer, and Electron main/preload processes in separate terminals.

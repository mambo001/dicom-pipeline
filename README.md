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

## Repository Layout

- `apps/backend`: plain TypeScript API with ports, adapters, and environment wiring
- `apps/desktop`: Electron app with main, preload, and React renderer boundaries
- `packages/contracts`: shared request, response, and audit event types

## Local Run

```bash
npm install
npm run typecheck
```

App-specific run commands are documented in each app README.

# DICOM Pipeline Prototype

A focused prototype for DICOM ingestion: local metadata inspection, de-identification preview, signed-URL cloud upload, and append-only auditability — built with plain TypeScript, hexagonal backend architecture, and Effect Schema validation at API boundaries.

**What it demonstrates:** Electron desktop client with local DICOM parsing and preview → backend upload session API with time-limited GCS signed URLs → direct-to-storage upload → append-only audit trail → OHIF viewer integration via DICOM JSON manifest.

## Upload Flow

```text
1. Select      Local DICOM file → SHA-256 hash, metadata extraction, PHI detection
2. Request     POST /api/upload-sessions → backend returns time-limited signed URL
3. Upload      PUT file bytes directly to GCS (never through the backend)
4. View        Open in OHIF viewer via signed-read manifest URL
```

Every step writes an audit event. Signed URLs expire after 900 s by default, limiting replay and stale-upload risk.

## Architecture

```text
┌──────────────────────────────────────────────────┐
│ Electron Desktop App                             │
│                                                  │
│  Renderer ◄──IPC──► Preload                     │
│      │                 │                          │
│      │ fetch()    invoke│                        │
│      ▼                 ▼                          │
│  Backend API      Main Process                   │
│      │                 │                          │
└──────┼─────────────────┼──────────────────────────┘
       │                 │
       │ audit/sessions  │ PUT signed URL
       ▼                 ▼
  Express API       Object Storage
  (validation,      (GCS in production,
   rate limit)       in-memory for dev)
```

The backend follows hexagonal architecture: workflow logic depends on ports, while HTTP, storage, audit persistence, and environment wiring live in adapters.

## Repository Layout

| Path | Purpose |
|---|---|
| `apps/backend` | Express API, ports, adapters, workflows, tests |
| `apps/desktop` | Electron main/preload + React/MUI renderer |
| `packages/contracts` | Shared schemas and types (Effect Schema) |
| `infra/terraform` | GCS bucket, Cloud Run, IAM, Artifact Registry |
| `.github/workflows` | CD (backend deploy) and release (desktop DMG) |

## Key Features

- **Local DICOM parsing** — metadata extraction, window/level preview (Cornerstone.js + canvas fallback), de-identification report for PHI-bearing tags
- **Signed-URL upload** — file bytes stream directly from Electron to GCS; backend never sees the payload
- **Append-only audit** — every action (select, parse, PHI detect, session create, upload start/success/failure) recorded with correlation IDs
- **OHIF integration** — `GET /api/ohif/upload-sessions/:id.json` returns a DICOM JSON manifest with signed-read URLs; desktop opens `viewer.ohif.org` directly
- **Per-route rate limiting** and Effect Schema request validation
- **Shared contracts** between desktop and backend at package boundary

## API Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload-sessions` | Create session, get signed upload URL |
| GET | `/api/upload-sessions/:id` | Read session/storage record |
| PATCH | `/api/upload-sessions/:id/status` | Update upload status |
| GET | `/api/upload-sessions/:id/signed-read` | Get signed read URL for uploaded file |
| GET | `/api/ohif/upload-sessions/:id.json` | OHIF DICOM JSON manifest |
| POST | `/api/audit-events` | Write audit event |
| GET | `/api/audit-events/:correlationId` | Read audit trail |

## Quick Start

```bash
npm install          # install workspace dependencies
npm run dev          # start backend + desktop (macOS)
npm run typecheck    # type-check all workspaces
npm test             # run tests
```

Platform note: `npm run dev` works on macOS. Electron needs a display server; WSL/Linux is unreliable.

Deployed backend: `https://dicom-pipeline-backend-wnlvetmltq-uc.a.run.app`

## Desktop Release

```bash
npm run build --workspace @dicom-pipeline/desktop
npm run dist:mac     # macOS arm64 DMG + ZIP
```

Push a `v*` tag to trigger CI release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

No code signing; builds use ad-hoc signing on macOS.

## Deployment

Backend CD (`.github/workflows/backend-deploy.yml`) pushes to Cloud Run on merge to `main`. Terraform provisions GCS, Cloud Run, Artifact Registry, IAM, and CORS in `infra/terraform`.

Required repository variables: `GCP_PROJECT_ID`, `GCP_REGION`. Secret: `GCP_SA_KEY`.

Backend env vars: `PORT` (8080), `APP_ENV`, `GCS_BUCKET`, `GCS_SIGNED_URL_TTL_SECONDS` (900), `ALLOWED_ORIGINS`.

## Scope

**In scope:** local DICOM selection, metadata inspection, de-identification preview, signed-URL upload, audit trail, shared contracts, Cloud Run deployment.

**Not in scope:** clinical-grade de-identification, PACS/VNA/HL7/FHIR integration, HIPAA compliance claims, production database storage.
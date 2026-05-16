# DICOM Pipeline Prototype

This project is a focused prototype for DICOM ingestion, local metadata inspection, de-identification preview, secure cloud upload, and append-only auditability.

It is intentionally implemented with plain TypeScript and clear process boundaries. The backend follows a hexagonal shape: workflow logic depends on ports, while HTTP, storage, audit persistence, and environment wiring live in adapters. Shared request, response, DICOM, and audit contracts are validated with Effect Schema at API boundaries.

## What It Demonstrates

- Electron desktop ingestion client with local DICOM file selection.
- Local DICOM metadata extraction in the Electron main process.
- De-identification preview for common PHI-bearing tags.
- Backend upload session API with time-limited Google Cloud Storage signed URLs.
- Direct-to-storage upload flow so file bytes do not pass through the backend API.
- Append-only audit events for selection, metadata parsing, PHI detection, session creation, upload start, upload success, upload failure, and retry-oriented status updates.
- Shared TypeScript contracts between desktop and backend.
- Runtime request validation with Effect Schema.
- Cloud Run deployment backed by Artifact Registry and Google Cloud Storage.
- Terraform infrastructure for the demo cloud resources.

## Scope

In scope:

- Electron desktop app for selecting local `.dcm` and `.dicom` files.
- React/MUI renderer for workflow status, metadata, de-identification findings, upload state, and audit timeline.
- Backend API for upload sessions, audit events, and storage records.
- Google Cloud Storage-oriented upload flow using signed URLs.
- Configurable CORS origin allowlist for local development and deployed demos.
- Per-route API rate limiting for demo safety.
- Shared contracts package for backend/desktop boundaries.

Not in scope:

- Clinical-grade DICOM de-identification guarantees.
- Direct PACS, VNA, HL7, or FHIR integration.
- Production HIPAA compliance claims.
- Full diagnostic imaging viewer.
- Durable production database storage for audit/session records.

## Architecture Summary

```text
Electron desktop app
  |
  | fetch API requests
  v
Backend API
  |
  +--> audit log port
  +--> upload session workflow
  +--> storage records port
  +--> object storage port
        |
        v
      Google Cloud Storage
```

## Repository Layout

- `apps/backend`: Express API, ports, adapters, workflows, config, and tests.
- `apps/desktop`: Electron main/preload processes and React renderer.
- `packages/contracts`: shared contract types and Effect Schema validators.
- `infra/terraform`: GCP APIs, GCS bucket, Artifact Registry, Cloud Run, service accounts, and IAM.
- `.github/workflows/backend-deploy.yml`: backend CD workflow for build, push, and Cloud Run deploy.
- `scripts`: DICOM fixture generation/download helpers.
- `test/fixtures/dicom`: local fixture location; `.dcm` files are ignored by Git.

## Upload Flow

The ingestion workflow uses three explicit steps so each action is independently auditable.

### Step 1: Select DICOM

The Electron main process reads the file locally, computes a SHA-256 hash, extracts DICOM metadata, and produces a de-identification preview. No file bytes leave the machine during this step.

Audit events written during selection and inspection include:

- `dicom.file.selected`
- `dicom.metadata.parsed`
- `dicom.phi.detected`
- `dicom.deidentified`

### Step 2: Create Upload Session

The desktop requests a session from the backend with `POST /api/upload-sessions`. The backend validates the request, creates a storage record, and returns a signed upload URL that expires after a configurable window. The default TTL is 900 seconds.

Audit event:

- `upload.session.requested`

Why a time-limited signed URL?

| Concern | How a signed URL helps |
|---|---|
| Stolen URL | Damage window is limited to the TTL, not permanent |
| Regulatory access control | Time-bounded access grants avoid long-lived client credentials |
| Replay attacks | A saved URL cannot upload months later |
| Object collision | Old sessions cannot overwrite new objects after expiration |
| Audit alignment | The `expiresAt` timestamp records the upload authorization window |

### Step 3: Upload File

The Electron main process streams the file from disk directly to the signed URL with `PUT`. Progress is relayed to the renderer. On completion, the backend storage record is updated to `uploaded`; failures are recorded as `failed` and can be retried against the session while the signed URL remains valid.

Audit events:

- `upload.started`
- `upload.succeeded`
- `upload.failed`

## Component Interaction

```text
┌─────────────────────────────────────────────────┐
│ Electron Desktop App                            │
│                                                 │
│  ┌──────────┐    IPC     ┌───────────┐         │
│  │ Renderer │◄─────────►│ Preload   │         │
│  │ (React)  │           │ (bridge)  │         │
│  └────┬─────┘           └─────┬─────┘         │
│       │                       │               │
│       │ fetch()        invoke │               │
│       │                       │               │
│  ┌────▼─────┐           ┌─────▼─────┐         │
│  │ Backend  │           │ Main      │         │
│  │ API      │           │ Process   │         │
│  └────┬─────┘           └─────┬─────┘         │
└───────┼───────────────────────┼───────────────┘
        │                       │
        │ POST /api/audit-events│ PUT signed URL
        │ POST /api/upload-     │ stream file bytes
        │ sessions              │
        │ PATCH status          │
        v                       v
┌──────────────┐          ┌──────────────────────┐
│ Express API  │          │ Object Storage       │
│ validation   │          │ GCS in production    │
│ audit/session│          │ dev storage locally  │
│ records      │          │                      │
└──────────────┘          └──────────────────────┘
```

## Backend

The backend owns upload session creation, storage coordination, request validation, rate limiting, CORS, and authoritative audit writes.

Important behavior:

- `APP_ENV=development` mounts `/dev-storage` for local signed-URL-like development uploads.
- `APP_ENV=production` disables `/dev-storage` and uses GCS signed URLs.
- `ALLOWED_ORIGINS` is a comma-separated origin allowlist.
- CORS preflight requests skip rate limiting so browsers receive CORS headers reliably.
- Per-route rate limits protect audit writes, audit reads, session creation, session reads, and status updates.
- Request bodies are validated with schemas from `@dicom-pipeline/contracts` before workflow logic runs.

Core API routes:

- `POST /api/audit-events`
- `GET /api/audit-events/:correlationId`
- `POST /api/upload-sessions`
- `GET /api/upload-sessions/:uploadSessionId`
- `PATCH /api/upload-sessions/:uploadSessionId/status`

## Desktop App

The desktop app keeps privileged file-system work in Electron main/preload and keeps the renderer focused on UI state and backend interaction.

Current UI features:

- MUI-based workflow with a clinical, flat color palette.
- Backend URL autocomplete with localStorage persistence.
- Known backend defaults for local development and the deployed Cloud Run demo.
- Buttons disabled until the backend URL is valid.
- DICOM file picker restricted to `.dcm` and `.dicom` extensions.
- Workflow log and audit timeline rendered with virtualized lists.
- Upload session, selected file, DICOM metadata, and de-identification summary cards.

## Contracts And Validation

`packages/contracts` exports shared schemas and derived TypeScript types for:

- Audit events.
- Upload session creation requests and responses.
- Storage object records.
- Upload status updates.
- DICOM metadata summaries.
- De-identification reports and findings.
- Backend URL validation.

Effect Schema is used for validation and type derivation. The application runtime remains plain TypeScript rather than requiring an Effect runtime architecture.

## Cloud Infrastructure

Terraform provisions the demo infrastructure in `infra/terraform`:

- Required GCP APIs: Cloud Run, Artifact Registry, Cloud Storage, IAM.
- GCS bucket named `${gcp_project_id}-dicom` with uniform bucket-level access.
- Artifact Registry Docker repository named `dicom-pipeline-backend`.
- Cloud Run service named `dicom-pipeline-backend`.
- Runtime service account named `dicom-pipeline-backend`.
- IAM permissions for storage object access and `iam.serviceAccounts.signBlob` via `roles/iam.serviceAccountTokenCreator`, which is required for GCS signed URL generation.
- Public Cloud Run invocation for the demo API.
- Single Cloud Run instance cap to keep demo cost predictable and keep the in-memory rate limiter behavior straightforward.

Terraform variables:

| Variable | Purpose | Default |
|---|---|---|
| `gcp_project_id` | GCP project ID | required |
| `gcp_region` | GCP region | `us-central1` |
| `backend_image` | Initial Cloud Run image | Cloud Run hello image |
| `allowed_origins` | Comma-separated CORS origins | `http://localhost:5173,http://127.0.0.1:5173` |

## Continuous Deployment

The GitHub Actions workflow at `.github/workflows/backend-deploy.yml` is CD, not full CI.

On push to `main` or manual dispatch, it:

- Authenticates to Google Cloud with `secrets.GCP_SA_KEY`.
- Builds `apps/backend/Dockerfile` from the monorepo root.
- Pushes commit-SHA and `latest` tags to Artifact Registry.
- Generates an `env.yaml` file for Cloud Run environment variables.
- Deploys the backend image to Cloud Run.

Expected repository variables/secrets:

| Name | Type | Purpose |
|---|---|---|
| `GCP_PROJECT_ID` | repository variable | Target GCP project |
| `GCP_REGION` | repository variable | Target region; defaults to `us-central1` if unset |
| `ALLOWED_ORIGINS` | repository variable | Optional comma-separated CORS origins override |
| `GCP_SA_KEY` | secret | JSON service account key for the deployer account |

`ALLOWED_ORIGINS` is written through `--env-vars-file` instead of `--update-env-vars` because gcloud parses commas in flag values as dictionary separators.

## Local Run

Install dependencies and verify the workspace:

```bash
npm install
npm run typecheck
npm test
```

Run the full local development stack:

```bash
npm run dev
```

Useful app-specific commands:

```bash
npm run dev:backend
npm run dev:desktop
npm run build
npm run lint
```

Generate local DICOM fixtures:

```bash
npm run fixtures:dicom
```

Download public test DICOM fixtures:

```bash
npm run fixtures:dicom:download
```

## Platform Compatibility

`npm run dev` works on macOS. It does not work reliably on Windows/WSL or Linux.

The issue is Electron's runtime dependency on a display server such as X11 or Wayland. WSL2 does not ship with one by default. Attempted workarounds such as WSLg on Windows 11, VcXsrv/Xming X servers, and `--no-sandbox` were not stable during development of this prototype. If you are on macOS, `npm run dev` should work as documented. For other platforms, run the backend, Vite renderer, and Electron processes manually in separate terminals.

## Configuration Reference

Backend environment variables:

| Variable | Purpose | Local default |
|---|---|---|
| `PORT` | HTTP port | `8080` |
| `APP_ENV` | `development` or `production` | `development` |
| `GCS_BUCKET` | GCS bucket for production signed URLs | unset |
| `GCS_SIGNED_URL_TTL_SECONDS` | Signed upload URL lifetime | `900` |
| `ALLOWED_ORIGINS` | Browser CORS allowlist | `http://localhost:5173,http://127.0.0.1:5173` |

Known backend URLs in the desktop autocomplete:

- `http://localhost:8080`
- `https://dicom-pipeline-backend-32692867045.us-central1.run.app`

## Verification

Current workspace checks:

```bash
npm run typecheck
npm run build
npm test
terraform -chdir=infra/terraform fmt -check
```

The backend and contracts packages include Vitest coverage for contract factories, validation-adjacent behavior, in-memory adapters, and upload session integration. The desktop renderer currently has no test files, so its Vitest command exits successfully with `--passWithNoTests`.

## Security Notes

- This is a portfolio/demo prototype, not a production medical device or compliance-certified system.
- File bytes are uploaded directly from Electron to object storage via a time-limited signed URL.
- The backend stores metadata and audit/session state, not the file payload itself.
- The current audit and session adapters are suitable for demonstration and tests; production would need durable database-backed adapters.
- CORS is intentionally explicit and should be narrowed to the exact deployed renderer origins for any hosted production client.

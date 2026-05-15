# Backend

The backend owns upload session creation, storage coordination, and authoritative audit trail writes.

## Responsibilities

- Issue upload sessions for de-identified DICOM objects.
- Record immutable audit events.
- Keep storage object metadata separate from file bytes.
- Provide a clear API boundary for the Electron desktop app.

## Architecture

- `src/ports`: interfaces for audit and storage capabilities
- `src/adapters`: concrete implementations for local development and GCS
- `src/integration`: pure workflow and policy logic
- `src/environments`: dependency wiring
- `src/main.ts`: HTTP entry point

This app uses plain TypeScript and dependency injection through function parameters and interfaces.

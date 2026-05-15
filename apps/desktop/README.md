# Desktop

The desktop app is the local DICOM ingestion client. It runs in hospital-like environments where files are selected from disk, inspected, de-identified, and uploaded.

## Responsibilities

- Select local DICOM files through Electron.
- Keep file-system access in the main process.
- Expose a narrow preload API to the renderer.
- Display import, de-identification, and upload status.
- Send structured audit-worthy events to the backend.

## Boundaries

- `src/main`: Electron main process and local file access
- `src/preload`: safe IPC bridge
- `src/renderer`: React UI

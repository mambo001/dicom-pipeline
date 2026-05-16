import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AuditEvent } from "@dicom-pipeline/contracts";
import type { AuditLog } from "../../ports/AuditLog";

const DATA_DIR = "./storage";
const FILE_PATH = join(DATA_DIR, "audit-events.json");

export function makeFileAuditLog(): AuditLog {
  let events: AuditEvent[] = [];

  try {
    const raw = readFileSync(FILE_PATH, "utf8");
    events = JSON.parse(raw) as AuditEvent[];
  } catch {
    // File does not exist yet — start with empty array
  }

  function flush() {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE_PATH, JSON.stringify(events, null, 2));
  }

  return {
    append: async (event) => {
      events.push(event);
      flush();
      return event;
    },
    listByCorrelationId: async (correlationId) =>
      events.filter((event) => event.correlationId === correlationId)
  };
}

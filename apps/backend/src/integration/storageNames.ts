export function sanitizeObjectPathSegment(value: string): string {
  return value
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 160);
}

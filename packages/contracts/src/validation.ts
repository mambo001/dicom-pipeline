import { Schema } from "effect";

export function validateUnknown<A>(schema: Schema.Schema<A>, value: unknown):
  | { ok: true; value: A }
  | { ok: false; errors: string } {
  const result = Schema.decodeUnknownEither(schema)(value);
  if (result._tag === "Right") {
    return { ok: true, value: result.right };
  }
  return { ok: false, errors: String(result.left) };
}

export const BackendUrlSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.filter((url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  })
);
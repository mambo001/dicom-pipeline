export type AppConfig = {
  readonly port: number;
  readonly appEnv: "development" | "production";
  readonly gcsBucket: string;
  readonly signedUrlTtlSeconds: number;
};

export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const port = Number(env.PORT ?? "8080");
  const signedUrlTtlSeconds = Number(env.GCS_SIGNED_URL_TTL_SECONDS ?? "900");
  const appEnv = env.APP_ENV === "production" ? "production" : "development";

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  if (!Number.isInteger(signedUrlTtlSeconds) || signedUrlTtlSeconds <= 0) {
    throw new Error("GCS_SIGNED_URL_TTL_SECONDS must be a positive integer");
  }

  return {
    port,
    appEnv,
    gcsBucket: env.GCS_BUCKET ?? "dicom-pipeline-prototype-dev",
    signedUrlTtlSeconds
  };
}

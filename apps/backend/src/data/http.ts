export type ApiError = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

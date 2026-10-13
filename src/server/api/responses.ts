import type { ApiError, ApiErrorCode } from "@/shared/schemas";

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers: HeadersInit = {},
): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function methodNotAllowed(allow: string[]): Response {
  return errorResponse(405, "method_not_allowed", `Use ${allow.join(", ")} on this endpoint.`, {
    Allow: allow.join(", "),
  });
}

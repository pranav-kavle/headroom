import type { NextRequest } from "next/server";

// Azure Container Apps (and most reverse proxies) terminate TLS at the
// ingress and forward internally over plain HTTP, so request.url reports
// "http://" even though the public request was HTTPS. Google's OAuth server
// rejects a non-localhost redirect_uri outright if it isn't HTTPS ("doesn't
// comply with Google's OAuth 2.0 policy for keeping apps secure") — trust
// the proxy's forwarded headers when both are present, since a host without
// a matching forwarded protocol isn't a signal we can act on safely.
export function resolveRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

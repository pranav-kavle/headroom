import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "../request-origin";

describe("resolveRequestOrigin", () => {
  it("trusts x-forwarded-proto/host over the raw request URL when present", () => {
    const request = new NextRequest("http://internal-container:3000/api/v1/integrations/google-health/authorize", {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "headroom.apps.human-angle.com" },
    });

    expect(resolveRequestOrigin(request)).toBe("https://headroom.apps.human-angle.com");
  });

  it("falls back to the request URL's own origin when there are no forwarded headers", () => {
    const request = new NextRequest("http://localhost:3101/api/v1/integrations/google-health/authorize");

    expect(resolveRequestOrigin(request)).toBe("http://localhost:3101");
  });

  it("falls back to x-forwarded-host with the request's own protocol when only the host is forwarded", () => {
    const request = new NextRequest("http://internal-container:3000/api/v1/integrations/google-health/authorize", {
      headers: { host: "internal-container:3000", "x-forwarded-host": "headroom.apps.human-angle.com" },
    });

    // No x-forwarded-proto here, so this isn't the trusted-proxy case —
    // falls through to the raw request URL's origin rather than guessing.
    expect(resolveRequestOrigin(request)).toBe("http://internal-container:3000");
  });

  it("uses only the first value when a header carries a comma-separated chain", () => {
    const request = new NextRequest("http://internal-container:3000/x", {
      headers: {
        "x-forwarded-proto": "https,http",
        "x-forwarded-host": "headroom.apps.human-angle.com,internal-container:3000",
      },
    });

    expect(resolveRequestOrigin(request)).toBe("https://headroom.apps.human-angle.com");
  });
});

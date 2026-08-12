import { NextResponse } from "next/server";
import { HealthResponse } from "@headroom/contracts";
import { pingDatabase } from "@headroom/graph";

export async function GET() {
  if (!(await pingDatabase())) {
    return NextResponse.json(
      HealthResponse.parse({
        status: "error",
        db: "unreachable",
        message: "SELECT 1 failed",
      }),
      { status: 503 },
    );
  }

  return NextResponse.json(HealthResponse.parse({ status: "ok", db: "connected" }));
}

import { NextResponse } from "next/server";
import { pingDatabase } from "@headroom/graph";

export async function GET() {
  const connected = await pingDatabase();
  if (!connected) {
    return NextResponse.json(
      { status: "error", db: "unreachable", message: "SELECT 1 failed" },
      { status: 503 },
    );
  }
  return NextResponse.json({ status: "ok", db: "connected" });
}

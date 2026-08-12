import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { listUsers } from "@headroom/graph";

export async function GET() {
  const requestor = await getOrCreateUser();
  if (!requestor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json({ users: await listUsers() });
}

import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const requestor = await getOrCreateUser();
  if (!requestor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, v1Eligibility: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

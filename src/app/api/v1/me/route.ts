import { NextResponse } from "next/server";
import { MeResponse } from "@headroom/contracts";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Only the contract's fields cross the wire — clerkUserId stays server-side.
  return NextResponse.json(
    MeResponse.parse({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
    }),
  );
}

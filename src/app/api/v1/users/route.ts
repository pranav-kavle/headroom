import { NextResponse } from "next/server";
import { UsersResponse } from "@headroom/contracts";
import { listUsers } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";

export async function GET() {
  const requestor = await getOrCreateUser();
  if (!requestor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const users = await listUsers();

  return NextResponse.json(
    UsersResponse.parse({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      })),
    }),
  );
}

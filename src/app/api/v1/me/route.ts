import { NextResponse, type NextRequest } from "next/server";
import { CompleteOnboardingRequest, MeResponse } from "@headroom/contracts";
import { completeOnboarding, type UserRow } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";

// Only the contract's fields cross the wire — clerkUserId stays server-side.
function serialize(user: UserRow) {
  return MeResponse.parse({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      timezone: user.timezone,
      onboardedAt: user.onboardedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json(serialize(user));
}

/** Where the /welcome flow lands its answers. */
export async function PATCH(request: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = CompleteOnboardingRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tell me what to call you first." }, { status: 400 });
  }

  const { displayName, role, timezone } = parsed.data;
  const updated = await completeOnboarding(user.id, {
    displayName,
    role: role ?? null,
    timezone: timezone ?? null,
  });

  return NextResponse.json(serialize(updated));
}

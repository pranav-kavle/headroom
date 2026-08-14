import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/auth";
import { WelcomeView } from "@/components/welcome/WelcomeView";

export default async function WelcomePage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.onboardedAt) {
    redirect("/brief");
  }

  // Google hands Clerk a name; email sign-up does not. Either way this is a
  // suggestion the first card lets you overwrite, never a value we keep silently.
  const clerkUser = await currentUser();
  const suggestedName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return <WelcomeView suggestedName={suggestedName} />;
}

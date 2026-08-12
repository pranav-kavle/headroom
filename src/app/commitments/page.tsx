import { redirect } from "next/navigation";
import { listCommitments } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { TopBar } from "@/components/nav/TopBar";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { initialsFromEmail } from "@/lib/initials";
import { CommitmentsView } from "@/components/commitments/CommitmentsView";

export default async function CommitmentsPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const commitments = await listCommitments(user.id);

  return (
    <AppFrame>
      <TopBar variant="home" initials={initialsFromEmail(user.email)} accountHref="/account" />
      <CommitmentsView commitments={commitments} />
      <BottomTabBar active="commitments" />
    </AppFrame>
  );
}

import { redirect } from "next/navigation";
import { listCommitments } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { CommitmentsView } from "@/components/commitments/CommitmentsView";

export default async function CommitmentsPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const commitments = await listCommitments(user.id);

  return (
    <AppFrame>
      <CommitmentsView commitments={commitments} />
      <VoiceOverlay />
      <BottomTabBar active="commitments" />
    </AppFrame>
  );
}

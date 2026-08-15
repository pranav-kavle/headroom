import { listCommitments, listOpenPullRequestsWithoutCommitment } from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { CommitmentsView } from "@/components/commitments/CommitmentsView";

export default async function CommitmentsPage() {
  const user = await requireOnboardedUser();

  const [commitments, openPullRequests] = await Promise.all([
    listCommitments(user.id),
    listOpenPullRequestsWithoutCommitment(user.id),
  ]);

  return (
    <AppFrame>
      <CommitmentsView commitments={commitments} openPullRequests={openPullRequests} />
      <VoiceOverlay />
      <BottomTabBar active="commitments" />
    </AppFrame>
  );
}

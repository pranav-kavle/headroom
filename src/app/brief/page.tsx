import { listCommitments, listOpenPullRequestsWithoutCommitment } from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { greetingName } from "@/lib/assistant";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { BriefView } from "@/components/brief/BriefView";

export default async function BriefPage() {
  const user = await requireOnboardedUser();

  const [commitments, openPullRequests] = await Promise.all([
    listCommitments(user.id),
    listOpenPullRequestsWithoutCommitment(user.id),
  ]);

  return (
    <AppFrame>
      <BriefView
        commitments={commitments}
        openPullRequests={openPullRequests}
        name={greetingName(user.displayName, user.email)}
        timeZone={user.timezone}
      />
      <VoiceOverlay />
      <BottomTabBar active="brief" />
    </AppFrame>
  );
}

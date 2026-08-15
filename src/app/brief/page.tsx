import {
  listCommitments,
  listOpenPullRequestsWithoutCommitment,
  listRecentCapacitySignals,
} from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { buildCapacityTiles } from "@/lib/capacity";
import { greetingName } from "@/lib/assistant";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { BriefView } from "@/components/brief/BriefView";

const CAPACITY_WINDOW_DAYS = 7;

export default async function BriefPage() {
  const user = await requireOnboardedUser();

  // Same trailing week the health and calendar connectors write, so the
  // baseline is drawn from exactly the window that gets resynced.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - CAPACITY_WINDOW_DAYS);

  const [commitments, openPullRequests, capacitySignals] = await Promise.all([
    listCommitments(user.id),
    listOpenPullRequestsWithoutCommitment(user.id),
    listRecentCapacitySignals({ userId: user.id, kinds: ["sleep", "rhr", "hrv"], since }),
  ]);

  return (
    <AppFrame>
      <BriefView
        commitments={commitments}
        openPullRequests={openPullRequests}
        capacityTiles={buildCapacityTiles(capacitySignals)}
        name={greetingName(user.displayName, user.email)}
        timeZone={user.timezone}
      />
      <VoiceOverlay />
      <BottomTabBar active="brief" />
    </AppFrame>
  );
}

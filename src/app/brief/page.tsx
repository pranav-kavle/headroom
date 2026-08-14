import { listCommitments } from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { greetingName } from "@/lib/assistant";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { BriefView } from "@/components/brief/BriefView";

export default async function BriefPage() {
  const user = await requireOnboardedUser();

  const commitments = await listCommitments(user.id);

  return (
    <AppFrame>
      <BriefView
        commitments={commitments}
        name={greetingName(user.displayName, user.email)}
        timeZone={user.timezone}
      />
      <VoiceOverlay />
      <BottomTabBar active="brief" />
    </AppFrame>
  );
}

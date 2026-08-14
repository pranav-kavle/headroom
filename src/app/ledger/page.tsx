import { listActions } from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { LedgerView } from "@/components/ledger/LedgerView";

export default async function LedgerPage() {
  const user = await requireOnboardedUser();

  const actions = await listActions(user.id);

  return (
    <AppFrame>
      <LedgerView actions={actions} />
      <VoiceOverlay />
      <BottomTabBar active="ledger" />
    </AppFrame>
  );
}

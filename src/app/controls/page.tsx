import { listConnectorCursors } from "@headroom/graph";
import { requireOnboardedUser } from "@/lib/auth";
import { accountName } from "@/lib/assistant";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { ControlsView } from "@/components/controls/ControlsView";

// No VoiceOverlay here: the FAB sits bottom-right, directly over this screen's
// column of toggles.
export default async function ControlsPage() {
  const user = await requireOnboardedUser();

  const sources = await listConnectorCursors(user.id);

  return (
    <AppFrame>
      <ControlsView
        email={user.email}
        name={accountName(user.displayName, user.email)}
        sources={sources}
      />
      <BottomTabBar active="controls" />
    </AppFrame>
  );
}

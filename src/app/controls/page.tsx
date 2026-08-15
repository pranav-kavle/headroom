import { getGoogleHealthToken, listConnectorCursors } from "@headroom/graph";
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
  // Health's token lives in our own table, not Clerk's Google connection
  // (spec §9a) — so unlike Calendar/GitHub, its connected state can't be
  // read off the client-side Clerk user object and has to come from here.
  const googleHealthToken = await getGoogleHealthToken(user.id);

  return (
    <AppFrame>
      <ControlsView
        email={user.email}
        name={accountName(user.displayName, user.email)}
        sources={sources}
        googleHealthConnected={googleHealthToken !== null}
      />
      <BottomTabBar active="controls" />
    </AppFrame>
  );
}

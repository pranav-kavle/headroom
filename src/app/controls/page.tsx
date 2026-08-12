import { redirect } from "next/navigation";
import { listConnectorCursors } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { ControlsView } from "@/components/controls/ControlsView";

// No VoiceOverlay here: the FAB sits bottom-right, directly over this screen's
// column of toggles.
export default async function ControlsPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const sources = await listConnectorCursors(user.id);

  return (
    <AppFrame>
      <ControlsView email={user.email} sources={sources} />
      <BottomTabBar active="controls" />
    </AppFrame>
  );
}

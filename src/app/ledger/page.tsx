import { redirect } from "next/navigation";
import { listActions } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { TopBar } from "@/components/nav/TopBar";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { initialsFromEmail } from "@/lib/initials";
import { LedgerView } from "@/components/ledger/LedgerView";

export default async function LedgerPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const actions = await listActions(user.id);

  return (
    <AppFrame>
      <TopBar variant="home" initials={initialsFromEmail(user.email)} accountHref="/account" />
      <LedgerView actions={actions} />
      <VoiceOverlay />
      <BottomTabBar active="ledger" />
    </AppFrame>
  );
}

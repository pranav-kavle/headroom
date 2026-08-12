import { redirect } from "next/navigation";
import { listConnectorCursors } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { AccountView } from "@/components/account/AccountView";

export default async function AccountPage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const sources = await listConnectorCursors(user.id);

  return (
    <AppFrame>
      <AccountView email={user.email} sources={sources} />
    </AppFrame>
  );
}

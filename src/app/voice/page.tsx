import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { AppFrame } from "@/components/nav/AppFrame";
import { TopBar } from "@/components/nav/TopBar";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { initialsFromEmail } from "@/lib/initials";
import styles from "./voice.module.css";

export default async function VoicePage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <AppFrame>
      <TopBar variant="home" initials={initialsFromEmail(user.email)} accountHref="/account" />
      <main className={styles.page}>
        <VoiceRecorder />
      </main>
      <BottomTabBar />
    </AppFrame>
  );
}

import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import styles from "./voice.module.css";

export default async function VoicePage() {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className={styles.page}>
      <VoiceRecorder />
    </main>
  );
}

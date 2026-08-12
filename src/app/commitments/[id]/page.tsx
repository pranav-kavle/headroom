import { notFound, redirect } from "next/navigation";
import { getCommitmentById } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { AppFrame } from "@/components/nav/AppFrame";
import { CommitmentDetailView } from "@/components/commitments/CommitmentDetailView";

export default async function CommitmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const commitment = await getCommitmentById(id, user.id);
  if (!commitment) {
    notFound();
  }

  return (
    <AppFrame>
      <CommitmentDetailView commitment={commitment} />
    </AppFrame>
  );
}

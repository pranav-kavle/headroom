import { NextRequest, NextResponse } from "next/server";
import { TranscriptionResponse } from "@headroom/contracts";
import { createArtifact } from "@headroom/graph";
import { getOrCreateUser } from "@/lib/auth";
import { StubSttProvider, type SttProvider } from "@/lib/stt";

// Stateless by design — the client resends the whole clip recorded so far on
// every call (see docs/superpowers/specs/2026-08-11-headroom-commitments-design.md
// §9). That works unchanged against a stub, a batch STT API, or a streaming
// one, so no provider decision blocks this endpoint existing.
const sttProvider: SttProvider = new StubSttProvider();

export async function POST(request: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const mimeType = request.headers.get("content-type") ?? "application/octet-stream";
  const isFinal = request.nextUrl.searchParams.get("final") === "true";
  const audio = Buffer.from(await request.arrayBuffer());

  const { transcript } = await sttProvider.transcribe(audio, mimeType);

  if (!isFinal) {
    return NextResponse.json(TranscriptionResponse.parse({ transcript, isFinal: false }));
  }

  const artifact = await createArtifact({
    userId: user.id,
    source: "voice_note",
    occurredAt: new Date(),
    excerpt: transcript,
  });

  return NextResponse.json(
    TranscriptionResponse.parse({ transcript, isFinal: true, artifactId: artifact.id }),
  );
}

import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import {
  Skeleton,
  SkeletonHeader,
  SkeletonScreen,
  skeletonStyles as s,
} from "@/components/skeleton/Skeleton";

// Mirrors LedgerView's timeline: a rail down the left with a node per entry.
function EntrySkeleton({ width }: { width: string }) {
  return (
    <div style={{ position: "relative", padding: "0 0 22px 22px" }}>
      <span style={{ position: "absolute", left: 0, top: 5 }}>
        <Skeleton w="8px" h="8px" circle />
      </span>
      <Skeleton w="58px" h="11px" />
      <div style={{ height: 8 }} />
      <Skeleton w={width} h="14px" />
    </div>
  );
}

export default function LedgerLoading() {
  return (
    <AppFrame>
      <SkeletonScreen label="Loading your ledger">
        <SkeletonHeader />
        <div className={s.head} style={{ marginBottom: 0 }}>
          <EntrySkeleton width="82%" />
          <EntrySkeleton width="61%" />
          <EntrySkeleton width="74%" />
          <EntrySkeleton width="55%" />
        </div>
      </SkeletonScreen>
      <VoiceOverlay />
      <BottomTabBar active="ledger" />
    </AppFrame>
  );
}

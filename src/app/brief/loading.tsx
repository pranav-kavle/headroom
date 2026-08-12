import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import {
  Skeleton,
  SkeletonHeader,
  SkeletonScreen,
  skeletonStyles as s,
} from "@/components/skeleton/Skeleton";

// Brief's rows are full-width blocks (title + meta), not the dot rows the
// commitments list uses.
function BriefItemSkeleton({ width }: { width: string }) {
  return (
    <div className={s.row}>
      <span className={s.rowText}>
        <Skeleton w={width} h="15px" />
        <Skeleton w="50%" h="11px" />
      </span>
      <Skeleton w="58px" h="19px" radius="999px" />
    </div>
  );
}

export default function BriefLoading() {
  return (
    <AppFrame>
      <SkeletonScreen label="Loading your brief">
        <SkeletonHeader />
        <div className={s.sectionHead}>
          <Skeleton w="72px" h="11px" />
          <Skeleton w="14px" h="11px" />
        </div>
        <BriefItemSkeleton width="80%" />
        <BriefItemSkeleton width="64%" />
        <BriefItemSkeleton width="73%" />
      </SkeletonScreen>
      <VoiceOverlay />
      <BottomTabBar active="brief" />
    </AppFrame>
  );
}

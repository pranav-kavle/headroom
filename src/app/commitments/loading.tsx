import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import {
  Skeleton,
  SkeletonHeader,
  SkeletonRow,
  SkeletonScreen,
  skeletonStyles as s,
} from "@/components/skeleton/Skeleton";

export default function CommitmentsLoading() {
  return (
    <AppFrame>
      <SkeletonScreen label="Loading your commitments">
        <SkeletonHeader />
        {/* search field */}
        <Skeleton h="40px" radius="10px" />
        <div style={{ height: 14 }} />
        {/* segmented filters */}
        <div style={{ display: "flex", gap: 6 }}>
          <Skeleton w="46px" h="30px" radius="999px" />
          <Skeleton w="86px" h="30px" radius="999px" />
          <Skeleton w="128px" h="30px" radius="999px" />
        </div>
        <div className={s.sectionHead}>
          <Skeleton w="64px" h="11px" />
          <Skeleton w="14px" h="11px" />
        </div>
        <SkeletonRow titleWidth="76%" />
        <SkeletonRow titleWidth="58%" />
        <SkeletonRow titleWidth="68%" />
        <SkeletonRow titleWidth="49%" />
      </SkeletonScreen>
      <VoiceOverlay />
      <BottomTabBar active="commitments" />
    </AppFrame>
  );
}

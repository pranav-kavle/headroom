import { AppFrame } from "@/components/nav/AppFrame";
import { BottomTabBar } from "@/components/nav/BottomTabBar";
import { Skeleton, SkeletonScreen, skeletonStyles as s } from "@/components/skeleton/Skeleton";

export default function ControlsLoading() {
  return (
    <AppFrame>
      <SkeletonScreen label="Loading your controls">
        <Skeleton w="64px" h="11px" />
        <div style={{ height: 16 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingBottom: 24,
            borderBottom: "1px solid var(--hr-line)",
          }}
        >
          <Skeleton w="52px" h="52px" circle />
          <span className={s.rowText}>
            <Skeleton w="58%" h="17px" />
            <Skeleton w="76%" h="12px" />
          </span>
        </div>

        {/* Sources */}
        <div style={{ height: 28 }} />
        <Skeleton w="76px" h="11px" />
        <div style={{ height: 10 }} />
        <Skeleton h="132px" radius="var(--hr-radius-md)" />

        {/* What Headroom may do on its own */}
        <div style={{ height: 28 }} />
        <Skeleton w="94px" h="11px" />
        <div style={{ height: 10 }} />
        <Skeleton h="176px" radius="var(--hr-radius-md)" />
      </SkeletonScreen>
      <BottomTabBar active="controls" />
    </AppFrame>
  );
}

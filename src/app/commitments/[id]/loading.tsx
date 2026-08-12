import { AppFrame } from "@/components/nav/AppFrame";
import { TopBar } from "@/components/nav/TopBar";
import { Skeleton, SkeletonScreen, skeletonStyles as s } from "@/components/skeleton/Skeleton";

// This is the one that most needs a skeleton: it is reached by tapping a row,
// so the tap has to produce a screen immediately or the list just sits there.
export default function CommitmentDetailLoading() {
  return (
    <AppFrame>
      <TopBar label="Commitments" href="/commitments" />
      <SkeletonScreen tight label="Loading commitment">
        <Skeleton w="72px" h="19px" radius="999px" />
        <div style={{ height: 13 }} />
        <Skeleton w="92%" h="23px" />
        <div style={{ height: 8 }} />
        <Skeleton w="58%" h="23px" />

        {/* counterparty */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
          <Skeleton w="26px" h="26px" circle />
          <Skeleton w="38%" h="13px" />
        </div>

        {/* evidence block — the quote this claim traces to */}
        <div style={{ marginTop: 26 }}>
          <Skeleton w="64px" h="11px" />
          <div style={{ height: 11 }} />
          <Skeleton h="86px" radius="var(--hr-radius-sm)" />
          <div className={s.row} style={{ borderBottom: 0 }}>
            <Skeleton w="42%" h="11px" />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <Skeleton w="52px" h="11px" />
          <div style={{ height: 11 }} />
          <Skeleton h="64px" radius="var(--hr-radius-sm)" />
        </div>
      </SkeletonScreen>
    </AppFrame>
  );
}

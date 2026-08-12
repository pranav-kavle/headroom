import { ImageResponse } from "next/og";
import { color } from "@headroom/tokens";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.violet,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 78, height: 11, background: "#fff", borderRadius: 6 }} />
          <div
            style={{
              width: 78,
              height: 11,
              background: "rgba(255,255,255,0.55)",
              borderRadius: 6,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}

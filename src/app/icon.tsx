import { ImageResponse } from "next/og";
import { color } from "@headroom/tokens";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 112,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          <div style={{ width: 220, height: 30, background: "#fff", borderRadius: 15 }} />
          <div
            style={{
              width: 220,
              height: 30,
              background: "rgba(255,255,255,0.55)",
              borderRadius: 15,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}

import type { MetadataRoute } from "next";
import { color } from "@headroom/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Headroom",
    short_name: "Headroom",
    description: "Everything you've promised, weighed against what you have left.",
    start_url: "/",
    display: "standalone",
    background_color: color.canvas,
    theme_color: color.violet,
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

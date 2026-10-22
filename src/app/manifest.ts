import type { MetadataRoute } from "next";
import { BAR_COLOUR } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hôm nay nấu gì?",
    short_name: "Nấu gì?",
    description: "Gợi ý bữa cơm gia đình mỗi ngày, kèm cách nấu và danh sách đi chợ.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BAR_COLOUR.light,
    theme_color: BAR_COLOUR.light,
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

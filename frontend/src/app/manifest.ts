import type { MetadataRoute } from "next";

/** Lets the warehouse phones install /m as an app (home-screen icon, no browser bars). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TechStore Skladište",
    short_name: "Skladište",
    description: "Skeniranje, sklapanje narudžbi, prijem i popis robe",
    lang: "sr-Latn-ME",
    start_url: "/m",
    scope: "/m",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

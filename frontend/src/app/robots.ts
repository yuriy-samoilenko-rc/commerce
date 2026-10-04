import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// The public address (SITE_URL) is read at run time, not at build.
export const dynamic = "force-dynamic";

/** Search engines see the shop; staff screens, accounts and the cart stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/m", "/nalog", "/korpa", "/lista-zelja", "/uporedi", "/api", "/prijava"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

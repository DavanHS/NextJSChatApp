import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/room/", "/api/"],
      },
    ],
    sitemap: "https://termi-chat.vercel.app/sitemap.xml",
  };
}

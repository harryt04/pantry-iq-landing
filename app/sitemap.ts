import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://pantry-iq.com",
      lastModified: new Date(),
    },
  ];
}

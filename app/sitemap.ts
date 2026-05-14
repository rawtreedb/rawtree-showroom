import type { MetadataRoute } from "next";
import { getAllUseCases } from "@/lib/use-cases";
import { SITE_URL } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const useCases = getAllUseCases();

  const useCaseEntries: MetadataRoute.Sitemap = useCases.flatMap((uc) => [
    {
      url: `${SITE_URL}/use-cases/${uc.slug}`,
      lastModified: new Date(uc.publishedAt),
    },
    {
      url: `${SITE_URL}/use-cases/${uc.slug}/dashboard`,
      lastModified: new Date(uc.publishedAt),
    },
  ]);

  return [
    { url: SITE_URL, lastModified: new Date() },
    ...useCaseEntries,
  ];
}

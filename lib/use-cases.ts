import { ghArchiveMongodbCdc } from "@/content/use-cases/gh-archive-mongodb-cdc";
import { cloudfrontWafSecurity } from "@/content/use-cases/cloudfront-waf-security";
import { supabaseSuperstoreCdc } from "@/content/use-cases/supabase-superstore-cdc";
import type { UseCase } from "@/lib/types";

const useCases: UseCase[] = [
  ghArchiveMongodbCdc,
  cloudfrontWafSecurity,
  supabaseSuperstoreCdc,
];

export function getAllUseCases(): UseCase[] {
  return useCases.toSorted(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug);
}

export function getAvailableTags(): string[] {
  const tags = new Set<string>();
  for (const uc of useCases) {
    for (const tag of uc.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

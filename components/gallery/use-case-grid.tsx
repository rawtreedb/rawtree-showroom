"use client";

import { useState } from "react";
import type { UseCase } from "@/lib/types";
import { UseCaseCard } from "@/components/gallery/use-case-card";
import { TagFilter } from "@/components/gallery/tag-filter";

export function UseCaseGrid({
  useCases,
  tags,
}: {
  useCases: UseCase[];
  tags: string[];
}) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filtered = selectedTag
    ? useCases.filter((uc) => uc.tags.includes(selectedTag))
    : useCases;

  return (
    <div>
      <div className="mb-8">
        <TagFilter tags={tags} selected={selectedTag} onSelect={setSelectedTag} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((uc) => (
          <UseCaseCard key={uc.slug} useCase={uc} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          No use cases match this filter.
        </p>
      )}
    </div>
  );
}

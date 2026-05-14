"use client";

import { cn } from "@/lib/utils";

export function TagFilter({
  tags,
  selected,
  onSelect,
}: {
  tags: string[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors",
          selected === null
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
        )}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onSelect(selected === tag ? null : tag)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            selected === tag
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

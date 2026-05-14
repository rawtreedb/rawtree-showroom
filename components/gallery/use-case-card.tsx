import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { UseCase } from "@/lib/types";

export function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <Link
      href={`/use-cases/${useCase.slug}`}
      className="group block overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm ring-1 ring-black/[0.03] transition-all hover:border-primary/40 hover:shadow-md hover:ring-primary/10 dark:ring-white/[0.04]"
    >
      <div className="relative aspect-[2/1] overflow-hidden border-b bg-muted">
        <Image
          src={useCase.heroImage}
          alt={useCase.title}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {useCase.category}
          </Badge>
        </div>
        <h3 className="mb-1 text-base font-semibold leading-tight transition-colors group-hover:text-primary">
          {useCase.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {useCase.shortDescription}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {useCase.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}

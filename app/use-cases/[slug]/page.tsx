import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchitectureDiagram } from "@/components/use-case/architecture-diagram";
import { SetupSteps } from "@/components/use-case/setup-steps";
import { getAllUseCases, getUseCaseBySlug } from "@/lib/use-cases";

export function generateStaticParams() {
  return getAllUseCases().map((uc) => ({ slug: uc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);
  if (!useCase) return {};
  return {
    title: useCase.title,
    description: useCase.shortDescription,
  };
}

export default async function UseCaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);
  if (!useCase) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Showroom
      </Link>

      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{useCase.category}</Badge>
          {useCase.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs font-normal">
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight">
          {useCase.title}
        </h1>
        <p className="text-muted-foreground">{useCase.description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <svg className="size-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            {useCase.repos.map((repo) => (
              <a
                key={repo.name}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {repo.name}
                <ExternalLink className="ml-1.5 size-3" />
              </a>
            ))}
          </div>
          <Link
            href={`/use-cases/${useCase.slug}/dashboard`}
            className={buttonVariants()}
          >
            View Dashboard
          </Link>
        </div>
      </div>

      <div className="space-y-10">
        <ArchitectureDiagram
          nodes={useCase.architecture.nodes}
          edges={useCase.architecture.edges}
        />
        <SetupSteps guides={useCase.setupGuides} />
      </div>
    </div>
  );
}

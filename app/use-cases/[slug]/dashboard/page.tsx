import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getAllUseCases, getUseCaseBySlug } from "@/lib/use-cases";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

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
    title: `Dashboard — ${useCase.title}`,
    description: `Live dashboard for ${useCase.title}`,
  };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const useCase = getUseCaseBySlug(slug);
  if (!useCase) notFound();

  return (
    <div className="px-4 py-6">
      <div className="mb-4 flex items-center gap-4">
        <Link
          href={`/use-cases/${useCase.slug}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          {useCase.title}
        </Link>
        <h1 className="text-sm font-semibold">Live Dashboard</h1>
      </div>

      <DashboardGrid queries={useCase.dashboardQueries} dashboardConfig={useCase.dashboardConfig} slug={useCase.slug} />
    </div>
  );
}

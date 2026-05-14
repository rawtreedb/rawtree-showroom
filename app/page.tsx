import { UseCaseGrid } from "@/components/gallery/use-case-grid";
import { getAllUseCases, getAvailableTags } from "@/lib/use-cases";

export default function HomePage() {
  const useCases = getAllUseCases();
  const tags = getAvailableTags();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12">
        <h1 className="mb-3 text-4xl font-bold tracking-tight">
          RawTree Showroom
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Explore real-world analytics pipelines built with RawTree. Each use
          case includes architecture diagrams, setup guides, and dashboard
          queries you can run yourself.
        </p>
      </div>
      <UseCaseGrid useCases={useCases} tags={tags} />
    </div>
  );
}

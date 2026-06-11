import Image from "next/image";
import { UseCaseGrid } from "@/components/gallery/use-case-grid";
import { AnimatedBg } from "@/components/hero/animated-bg";
import { getAllUseCases, getAvailableTags } from "@/lib/use-cases";

export default function HomePage() {
  const useCases = getAllUseCases();
  const tags = getAvailableTags();

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b border-border bg-background">
        <AnimatedBg />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 py-16 text-center sm:py-20">
          <Image
            src="/rawtree-logo.svg"
            alt="RawTree"
            width={40}
            height={46}
            className="mb-5"
          />

          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            Analytics built by AI agents
          </span>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            One prompt.{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#1B83FE] to-[#5F68FA] bg-clip-text text-transparent">
              Instant analytics on RawTree.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every analytics dashboard in this showroom was created by an AI
            coding agent from a single natural-language prompt — complete SQL
            queries, interactive charts, and live CDC pipeline monitoring,
            generated in minutes on{" "}
            <span className="font-semibold text-foreground">RawTree</span>.
          </p>

        </div>
      </section>

      {/* Gallery */}
      <div id="gallery" className="mx-auto max-w-6xl px-6 py-14">
        <UseCaseGrid useCases={useCases} tags={tags} />
      </div>
    </div>
  );
}

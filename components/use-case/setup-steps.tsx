"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SetupGuide } from "@/lib/types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function highlightCommand(raw: string): string {
  let result = escapeHtml(raw);

  result = result.replace(
    /(&quot;|&#x27;)(?:(?!\1).)*\1/g,
    (m) => `<span class="text-[oklch(0.75_0.12_140)]">${m}</span>`
  );
  result = result.replace(
    /\b(cd|cp|cat|echo|export|helm|kubectl|terraform|make|brew|git|direnv|source|rawtree|mkdir|rm|set|set_sensitive)\b/g,
    (m) => `<span class="text-[oklch(0.75_0.15_250)]">${m}</span>`
  );
  result = result.replace(
    /\s(--?\w[\w-]*)/g,
    (m, flag) =>
      ` <span class="text-[oklch(0.7_0.1_60)]">${escapeHtml(flag)}</span>`
  );

  return result;
}

const PROMPT_SPAN = '<span class="select-none text-[oklch(0.55_0_0)]">$ </span>';
const COMMENT_CLS = "text-[oklch(0.55_0_0)]";

function formatBash(code: string): string {
  let inHeredoc = false;

  return code
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      if (inHeredoc) {
        if (trimmed === "EOF") inHeredoc = false;
        return `  ${escapeHtml(line)}`;
      }

      if (trimmed.startsWith("#")) {
        return `  <span class="${COMMENT_CLS}">${escapeHtml(trimmed)}</span>`;
      }

      if (/<<'?EOF'?/.test(trimmed)) inHeredoc = true;

      const indent = line.slice(0, line.length - line.trimStart().length);
      return `${PROMPT_SPAN}${indent}${highlightCommand(line.trimStart())}`;
    })
    .join("\n");
}

function CodeBlock({ code }: { code: string }) {
  const highlighted = formatBash(code);
  return (
    <pre className="code-surface overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
    </pre>
  );
}

export function SetupSteps({ guides }: { guides: SetupGuide[] }) {
  const [activeMethod, setActiveMethod] = useState(0);

  const guide = guides[activeMethod];
  const isComingSoon = guide.steps.length === 0;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Setup Guide</h2>

      <div className="mb-6 flex gap-0 border-b">
        {guides.map((g, i) => (
          <button
            key={g.method}
            onClick={() => setActiveMethod(i)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer",
              i === activeMethod
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {g.method}
          </button>
        ))}
      </div>

      {isComingSoon ? (
        <div className="rounded-lg border bg-card px-6 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Coming soon
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {guide.comingSoonMessage ??
              `${guide.method} setup for this use case is on our roadmap.`}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {guide.steps.map((step, i) => (
            <div key={i}>
              <h3 className="mb-2 flex items-center gap-3 text-sm font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                {step.title}
              </h3>
              <div className="ml-9 space-y-3">
                <p className="text-sm text-muted-foreground">{step.content}</p>
                {step.notice && (() => {
                  const isAws = step.notice.link?.url?.includes("aws.amazon.com");
                  return (
                    <div className={cn(
                      "flex gap-3 rounded-lg border px-4 py-3",
                      isAws
                        ? "border-[#FF9900]/20 bg-[#FF9900]/5"
                        : "border-primary/20 bg-primary/5"
                    )}>
                      {isAws ? (
                        <img src="/aws.webp" alt="AWS" className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                      )}
                      <div className="text-sm">
                        <p className="text-foreground">{step.notice.text}</p>
                        {step.notice.link && (
                          <a
                            href={step.notice.link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "mt-1 inline-block underline underline-offset-2",
                              isAws
                                ? "text-[#C27400] hover:text-[#FF9900]"
                                : "text-primary hover:text-primary/80"
                            )}
                          >
                            {step.notice.link.label} &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {step.codeBlock && <CodeBlock code={step.codeBlock.code} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

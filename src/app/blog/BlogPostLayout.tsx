import Link from "next/link";

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  readTime: string;
}

export function BlogPostLayout({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta: BlogPostMeta;
}) {
  return (
    <div className="min-h-screen px-6 py-16 sm:px-10 md:px-14 md:py-24">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-[var(--waqtu-muted)] hover:text-[var(--waqtu-text)] transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Blog
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--waqtu-gold)] bg-[var(--waqtu-gold)]/10 px-2 py-0.5 rounded-full">
            {meta.category}
          </span>
          <span className="text-xs text-[var(--waqtu-muted)]">{meta.readTime}</span>
        </div>

        <h1 className="font-display mb-3 text-3xl font-semibold tracking-tight text-[var(--waqtu-text)] sm:text-4xl">
          {meta.title}
        </h1>
        <p className="mb-10 text-sm text-[var(--waqtu-muted)]">{meta.date}</p>

        <div className={`prose prose-invert max-w-none space-y-6 text-[var(--waqtu-muted)] leading-relaxed
          [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--waqtu-text)] [&_h2]:mt-10 [&_h2]:mb-4
          [&_p]:leading-relaxed
          [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2
          [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:space-y-2
          [&_li]:leading-relaxed [&_li]:pl-1
          [&_strong]:text-[var(--waqtu-text)] [&_strong]:font-medium
        `}>
          {children}
        </div>
      </article>
    </div>
  );
}

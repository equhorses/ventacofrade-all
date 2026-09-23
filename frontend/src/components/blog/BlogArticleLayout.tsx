import BlogShell from '@/components/blog/BlogShell';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const BlogArticleLayout = ({
  title,
  description,
  children,
}: BlogArticleLayoutProps) => (
  <BlogShell>
    <main>
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 pt-8 pb-12">
          <a
            href="/blog/"
            className="text-sm text-primary-foreground/70 underline-offset-4 hover:text-primary-foreground hover:underline"
          >
            ← Todas las guías
          </a>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.28em] text-secondary">
            Guía cofrade
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">{title}</h1>
          {description ? (
            <p className="mt-4 text-lg leading-8 text-primary-foreground/80">{description}</p>
          ) : null}
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-6 py-12">{children}</article>
    </main>
  </BlogShell>
);

export default BlogArticleLayout;

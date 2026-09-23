import BlogShell from '@/components/blog/BlogShell';
import { blogPosts, getBlogRoute } from '@/lib/blog';

const BlogIndexPage = () => (
  <BlogShell>
    <main>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
            Guías cofrades
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight max-w-3xl">
            Consejos para comprar y vender túnicas y enseres cofrades
          </h1>
          <p className="mt-4 text-lg leading-8 text-primary-foreground/80 max-w-2xl">
            Medidas, estado, precios y todo lo que conviene saber antes de comprar o
            vender artículos cofrades de segunda mano.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {blogPosts.length > 0 ? (
          <div className="grid gap-6">
            {blogPosts.map((post) => (
              <article
                key={post.slug}
                className="rounded-xl border border-border bg-card p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {post.frontmatter.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-4 text-2xl font-bold text-foreground">
                  <a className="hover:text-primary transition-colors" href={getBlogRoute(post.slug)}>
                    {post.title}
                  </a>
                </h2>
                <p className="mt-3 text-base leading-7 text-muted-foreground">
                  {post.description}
                </p>
                <a
                  href={getBlogRoute(post.slug)}
                  className="mt-5 inline-flex text-sm font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  Leer la guía
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Muy pronto publicaremos nuevas guías.</p>
        )}
      </section>
    </main>
  </BlogShell>
);

export default BlogIndexPage;

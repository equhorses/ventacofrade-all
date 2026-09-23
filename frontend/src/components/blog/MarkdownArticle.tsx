import Markdown from 'markdown-to-jsx';

type MarkdownArticleProps = {
  markdown: string;
};

const MarkdownArticle = ({ markdown }: MarkdownArticleProps) => (
  <div className="prose prose-lg max-w-none prose-headings:text-primary prose-headings:font-bold prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-xl prose-p:leading-8 prose-li:leading-8 prose-strong:text-foreground prose-a:text-primary prose-a:font-semibold prose-a:underline-offset-4 hover:prose-a:text-primary/80 prose-li:marker:text-secondary">
    <Markdown
      options={{
        forceBlock: true,
        overrides: {
          a: {
            props: {
              className: 'font-medium',
            },
          },
          code: {
            props: {
              className: '',
            },
          },
          pre: {
            props: {
              className: 'overflow-x-auto',
            },
          },
        },
      }}
    >
      {markdown}
    </Markdown>
  </div>
);

export default MarkdownArticle;

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children, title }) => href
    ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  // Model output must not load remote images or tracking pixels automatically.
  img: ({ alt }) => <span>{alt}</span>,
  table: ({ children }) => <div role="region" aria-label="Table" tabIndex={0} data-markdown-table><table>{children}</table></div>,
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
};

export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  return <div className={className}><Markdown remarkPlugins={plugins} components={components} skipHtml>{content}</Markdown></div>;
}

import { Copy } from "lucide-react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { remarkFindingTasks, type TaskContext } from "./chat-task-drafts";

const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children, title, node }) => href
    ? <a href={href} title={title} data-chat-task={node?.properties["data-chat-task"] || undefined} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  // Model output must not load remote images or tracking pixels automatically.
  img: ({ alt }) => <span>{alt}</span>,
  table: ({ children }) => <div role="region" aria-label="Table" tabIndex={0} data-markdown-table><table>{children}</table></div>,
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
};

export function ChatMarkdown({ content, className, taskContext }: { content: string; className?: string; taskContext?: TaskContext }) {
  return <div className={className}><Markdown remarkPlugins={taskContext ? [remarkGfm, [remarkFindingTasks, taskContext]] : plugins} components={components} skipHtml>{content}</Markdown></div>;
}

export function ChatCopyButton({ content, className, notify }: {
  content: string;
  className: string;
  notify: (tone: "success" | "error", message: string) => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      notify("success", "Response copied.");
    } catch {
      notify("error", "Couldn’t access the clipboard. Select the response and copy it manually.");
    }
  }
  return <button type="button" className={className} aria-label="Copy response" title="Copy response" onClick={copy}><Copy aria-hidden="true" /></button>;
}

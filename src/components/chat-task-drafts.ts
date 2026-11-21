import type { Paragraph, PhrasingContent, Root } from "mdast";
import type { Plugin } from "unified";
import { citedChatSources } from "@inkspect/core/lib/chat-citations";
import { isKnowledgeReference, isReviewReference, type ChatReference, type ChatKnowledgeReference } from "@inkspect/core/lib/chat-review-evidence";
import type { Repository } from "@inkspect/core/lib/github";

export type TaskContext = { sources: ChatReference[]; repositories: Repository[] };
type RepositoryReference = Exclude<ChatReference, ChatKnowledgeReference>;
type TaskDraft = { title: string; description: string; repository: Repository; evidence: RepositoryReference[] };

function plainText(node: PhrasingContent): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "break") return "\n";
  if ("children" in node) return node.children.map(plainText).join("");
  return "";
}

function findingDraft(paragraph: Paragraph, markdown: string, context: TaskContext): TaskDraft | undefined {
  const [heading, ...rest] = paragraph.children;
  const marker = rest.at(-1);
  if (heading?.type !== "strong" || marker?.type !== "html" || marker.value.trim() !== "<!-- finding -->") return;
  const title = plainText(heading).trim();
  const start = heading.position?.end.offset;
  const end = marker.position?.start.offset;
  if (!title || start === undefined || end === undefined) return;
  const cited = citedChatSources(markdown.slice(start, end), context.sources)
    .filter((source): source is RepositoryReference => !isKnowledgeReference(source));
  const first = cited[0];
  if (!first) return;
  const repository = context.repositories.find(repo => repo.id === first.repositoryId && repo.fullName === first.repository);
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository.fullName) || repository.fullName.split("/").some(part => part === "." || part === "..")) return;
  if (cited.some(source => source.repositoryId !== repository.id || source.repository !== repository.fullName)) return;
  const description = rest.map(plainText).join("")
    .replace(/\[[SRK]\d+\]/g, "").replace(/^\s*[—–:-]\s*/, "").replace(/ +([.,])/g, "$1").trim();
  if (!/[\p{L}\p{N}]/u.test(description)) return;
  return { title, description, repository, evidence: cited };
}

// Destinations receive a single finding with verified repository context.
function githubIssueDraft(draft: TaskDraft) {
  const destination = new URL(`https://github.com/${draft.repository.fullName}/issues/new`);
  const links = draft.evidence.map(source => isReviewReference(source)
    ? `https://github.com/${draft.repository.fullName}/pull/${source.pullNumber} (revision ${source.revision})`
    : source.url);
  destination.searchParams.set("title", [...draft.title].slice(0, 200).join(""));
  destination.searchParams.set("body", [draft.description, ...links].join("\n\n"));
  // A short description and the first supporting source still identify the finding in long replies.
  if (destination.href.length > 7500) {
    destination.searchParams.set("body", [...draft.description].slice(0, 280).join("") + "\n\n" + links[0]);
    if (destination.href.length > 7500) destination.searchParams.set("body", [...draft.description].slice(0, 280).join("") + "\n\nRevision " + draft.evidence[0].revision);
  }
  return { label: "Draft GitHub issue", target: draft.repository.fullName, href: destination.href };
}

const taskDestinations = [githubIssueDraft];

export const remarkFindingTasks: Plugin<[TaskContext], Root> = context => (tree, file) => {
  const markdown = String(file);
  function addActions(paragraph: Paragraph) {
    const draft = findingDraft(paragraph, markdown, context);
    if (!draft) return;
    for (const destination of taskDestinations) {
      const { label, target, href } = destination(draft);
      paragraph.children.push({ type: "break" }, {
        type: "link", url: href, title: `${label} · ${target}`,
        data: { hProperties: { "data-chat-task": true } },
        children: [{ type: "text", value: `${label} · ${target} ↗` }],
      });
    }
  }
  for (const block of tree.children) {
    if (block.type === "paragraph") addActions(block);
    if (block.type === "list") {
      for (const item of block.children) {
        for (const child of item.children) if (child.type === "paragraph") addActions(child);
      }
    }
  }
};

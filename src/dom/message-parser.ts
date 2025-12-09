import { elementToMarkdown } from '../export/markdown';
import type { ExportMessage, QuestionEntry } from '../types/conversation';
import type { ChatRole } from '../types/conversation';

const MESSAGE_SELECTOR =
  '[data-testid="conversation-turn"], [data-message-id], main article';

export function collectMessages(): ExportMessage[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR),
  );
  const unique: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const node of nodes) {
    if (!seen.has(node)) {
      seen.add(node);
      unique.push(node);
    }
  }

  return unique
    .map((node) => serializeMessage(node))
    .filter((item): item is ExportMessage => Boolean(item));
}

export function collectUserQuestions(): QuestionEntry[] {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR),
  );
  const unique: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const node of nodes) {
    if (!seen.has(node)) {
      seen.add(node);
      unique.push(node);
    }
  }

  const entries: QuestionEntry[] = [];

  unique.forEach((node) => {
    const role = detectRole(node);
    if (role !== 'user') return;
    const contentRoot = findContentRoot(node);
    const markdown = contentRoot ? elementToMarkdown(contentRoot) : '';
    const summary = summarize(markdown);
    const id = getMessageKey(node, markdown);
    entries.push({ id, node, summary });
  });

  const seenIds = new Set<string>();
  return entries.filter((entry) => {
    if (seenIds.has(entry.id)) return false;
    seenIds.add(entry.id);
    return true;
  });
}

function serializeMessage(node: HTMLElement): ExportMessage | null {
  const role = detectRole(node);
  const contentRoot = findContentRoot(node);
  const markdown = contentRoot ? elementToMarkdown(contentRoot) : '';
  const trimmed = markdown.trimEnd();

  return { role, content: trimmed };
}

function detectRole(node: HTMLElement): ChatRole {
  const candidates = [
    node.getAttribute('data-message-author-role') ||
      node.dataset.messageAuthorRole,
    node
      .querySelector('[data-message-author-role]')
      ?.getAttribute('data-message-author-role'),
    node.getAttribute('data-testid'),
    node.className,
  ];

  for (const candidate of candidates) {
    const role = normalizeRole(candidate);
    if (role) return role;
  }

  return 'unknown';
}

function normalizeRole(value?: string | null): ChatRole | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes('assistant') || text === 'gpt') return 'assistant';
  if (text.includes('user') || text.includes('human')) return 'user';
  if (text.includes('system')) return 'system';
  if (text.includes('tool')) return 'tool';
  return null;
}

function findContentRoot(node: HTMLElement): HTMLElement | null {
  const selectors = [
    '[data-testid="markdown"]',
    '[data-message-author-role] [data-testid="markdown"]',
    '.markdown',
    '.prose',
    'article',
  ];

  for (const selector of selectors) {
    const found = node.querySelector<HTMLElement>(selector);
    if (found) return found;
  }

  return node;
}

function summarize(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines[0] || '_empty question_';
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

function getMessageKey(node: HTMLElement, fallback: string) {
  return (
    node.getAttribute('data-message-id') ||
    node.dataset.messageId ||
    node.id ||
    fallback.slice(0, 80)
  );
}

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
  const seenKeys = new Set<string>();

  unique.forEach((node) => {
    const root = resolveMessageRoot(node);
    if (!root) return;
    const role = detectRole(root);
    if (role !== 'user') return;
    const markdown = buildMarkdown(root, role);
    const summary = summarize(markdown);
    if (isNoiseSummary(summary)) return;
    const key = getMessageKey(root, markdown);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    entries.push({ id: key, node: root, summary });
  });

  return entries;
}

function serializeMessage(node: HTMLElement): ExportMessage | null {
  const role = detectRole(node);
  const markdown = buildMarkdown(node, role);
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
  let summary = lines[0] || '_empty question_';
  if (summary.toLowerCase().startsWith('you said')) {
    summary = summary.slice('you said'.length).trim() || summary;
  }
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

function getMessageKey(node: HTMLElement, markdown: string) {
  const id =
    node.getAttribute('data-message-id') ||
    node.dataset.messageId ||
    node.id ||
    '';
  if (id) return id;
  const normalized = normalizeText(markdown);
  return `${normalized.slice(0, 160)}::${normalized.length}`;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveMessageRoot(node: HTMLElement) {
  let current: HTMLElement | null = node;
  while (current && current !== document.body) {
    if (current.getAttribute('data-message-author-role') || current.getAttribute('data-message-id')) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function isNoiseSummary(summary: string) {
  const normalized = normalizeText(summary);
  return normalized === 'you said' || normalized === '_empty question_';
}

function buildMarkdown(node: HTMLElement, role: ChatRole) {
  const contentRoot = findContentRoot(node);
  const markdown = contentRoot ? elementToMarkdown(contentRoot) : '';
  const cleaned =
    role === 'user' ? stripUserImageArtifacts(markdown) : markdown;
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

function stripUserImageArtifacts(markdown: string) {
  const withoutMarkdownImages = markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt: string) => {
      const altText = (alt || '').trim();
      if (isImagePlaceholder(altText)) return '';
      return altText || '';
    },
  );

  const imageUrlPattern =
    /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?)$/i;
  const hostedImagePattern =
    /^(https?:\/\/(?:files\.oaiusercontent\.com|files\.openai\.com|oaidalleapiprodscus\.blob\.core\.windows\.net)[^\s]*)$/i;

  const cleanedLines = withoutMarkdownImages
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (imageUrlPattern.test(trimmed)) return false;
      if (hostedImagePattern.test(trimmed)) return false;
      if (isImagePlaceholder(trimmed)) return false;
      return true;
    });

  return cleanedLines.join('\n');
}

function isImagePlaceholder(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (/^uploaded\s+image(\s*\d+)?$/.test(normalized)) return true;
  if (/^image(\s*\d+)?$/.test(normalized)) return true;
  if (/^screenshot(\s*\d+)?$/.test(normalized)) return true;
  if (/^picture(\s*\d+)?$/.test(normalized)) return true;
  if (/^photo(\s*\d+)?$/.test(normalized)) return true;
  if (/^image\.(png|jpe?g|gif|webp|svg)$/.test(normalized)) return true;
  return false;
}

type ChatRole = 'assistant' | 'user' | 'system' | 'tool' | 'unknown';

const EXPORT_BUTTON_ID = 'gpt-exporter-md-button';
const STYLE_ID = 'gpt-exporter-style';

export default defineContentScript({
  matches: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
  runAt: 'document_end',
  main() {
    injectStyle();
    mountButton();
    keepButtonAlive();
  },
});

function keepButtonAlive() {
  const observer = new MutationObserver(() => {
    if (!document.getElementById(EXPORT_BUTTON_ID)) {
      mountButton();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function mountButton() {
  if (!document.body || document.getElementById(EXPORT_BUTTON_ID)) return;
  const button = createExportButton();
  document.body.appendChild(button);
}

function createExportButton() {
  const button = document.createElement('button');
  button.id = EXPORT_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Export MD';
  button.addEventListener('click', async () => {
    button.disabled = true;
    const originalLabel = 'Export MD';
    try {
      button.textContent = 'Exporting...';
      await exportConversation();
      button.textContent = 'Exported';
    } catch (error) {
      console.error('[GPT Exporter] Failed to export conversation', error);
      button.textContent = 'Retry Export';
    } finally {
      setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
      }, 900);
    }
  });
  return button;
}

async function exportConversation() {
  const originalScroll = window.scrollY;
  await ensureConversationLoaded(originalScroll);

  const messages = collectMessages();
  if (messages.length === 0) {
    console.warn('[GPT Exporter] No messages found on this page.');
    return;
  }

  const exportedAt = new Date();
  const title = sanitizeFilename(document.title || 'ChatGPT Conversation');
  const markdown = buildDocument(title, messages, exportedAt);
  triggerDownload(markdown, title, exportedAt);
}

async function ensureConversationLoaded(originalScroll: number) {
  window.scrollTo({ top: 0, behavior: 'auto' });
  await delay(350);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  await delay(350);
  window.scrollTo({ top: originalScroll, behavior: 'auto' });
}

function collectMessages(): ExportMessage[] {
  const selector =
    '[data-testid="conversation-turn"], [data-message-id], main article';
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(selector),
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

function serializeMessage(node: HTMLElement): ExportMessage | null {
  const role = detectRole(node);
  const contentRoot = findContentRoot(node);
  const markdown = contentRoot ? elementToMarkdown(contentRoot) : '';
  const trimmed = markdown.trimEnd();

  return { role, content: trimmed };
}

function detectRole(node: HTMLElement): ChatRole {
  const candidates = [
    node.getAttribute('data-message-author-role') || node.dataset.messageAuthorRole,
    node.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role'),
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

function elementToMarkdown(root: HTMLElement): string {
  const content = serializeNodes(Array.from(root.childNodes), {
    inPre: false,
    listDepth: 0,
  });
  return normalizeBlankLines(content.trim());
}

type SerializeContext = { inPre: boolean; listDepth: number };

function serializeNodes(nodes: Node[], context: SerializeContext): string {
  return nodes.map((node) => serializeNode(node, context)).join('');
}

function serializeNode(node: Node, context: SerializeContext): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    return context.inPre ? text : text.replace(/\s+/g, ' ');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      return '  \n';
    case 'p':
      return block(serializeNodes(Array.from(element.childNodes), context));
    case 'strong':
    case 'b':
      return `**${serializeNodes(Array.from(element.childNodes), context)}**`;
    case 'em':
    case 'i':
      return `*${serializeNodes(Array.from(element.childNodes), context)}*`;
    case 'u':
      return `__${serializeNodes(Array.from(element.childNodes), context)}__`;
    case 'code': {
      const content = serializeNodes(Array.from(element.childNodes), {
        ...context,
        inPre: context.inPre,
      });
      return context.inPre ? content : `\`${content}\``;
    }
    case 'pre': {
      const code = element.querySelector('code');
      const language =
        detectLanguage(code) ||
        element.getAttribute('data-language') ||
        '';
      const codeText = code?.textContent ?? element.textContent ?? '';
      return block(
        `\`\`\`${language}\n${codeText.trimEnd()}\n\`\`\``,
      );
    }
    case 'ul':
      return serializeList(element, false, context.listDepth);
    case 'ol':
      return serializeList(element, true, context.listDepth);
    case 'li':
      return serializeListItem(element, context);
    case 'blockquote': {
      const inner = serializeNodes(Array.from(element.childNodes), context)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
      return block(inner);
    }
    case 'a': {
      const href = element.getAttribute('href') ?? '';
      const text = serializeNodes(Array.from(element.childNodes), context) || href;
      return `[${text}](${href || '#'})`;
    }
    case 'img': {
      const alt = element.getAttribute('alt') ?? '';
      const src = element.getAttribute('src') ?? '';
      return src ? `![${alt}](${src})` : '';
    }
    case 'table':
      return block(serializeTable(element));
    case 'span':
    case 'div':
      return serializeNodes(Array.from(element.childNodes), context);
    default:
      return serializeNodes(Array.from(element.childNodes), context);
  }
}

function serializeList(element: HTMLElement, ordered: boolean, depth: number) {
  const items = Array.from(element.children).filter(
    (child) => child.tagName.toLowerCase() === 'li',
  ) as HTMLElement[];

  const lines: string[] = [];
  items.forEach((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '- ';
    const inner = serializeListItem(item, { inPre: false, listDepth: depth });
    const indented = indentLines(inner, prefix, depth);
    lines.push(indented);
  });

  return `${lines.join('\n')}\n\n`;
}

function serializeListItem(element: HTMLElement, context: SerializeContext) {
  const nextContext = { ...context, listDepth: context.listDepth + 1 };
  const content = serializeNodes(Array.from(element.childNodes), nextContext);
  return content.trim();
}

function indentLines(text: string, prefix: string, depth: number) {
  const indent = '  '.repeat(depth);
  const lines = text.split('\n');
  if (lines.length === 1) {
    return `${indent}${prefix}${lines[0]}`;
  }
  const [first, ...rest] = lines;
  const body = rest.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${prefix}${first}\n${body}`;
}

function serializeTable(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return '';

  const headerCells =
    Array.from(rows.shift()?.querySelectorAll<HTMLElement>('th,td') || []) ||
    [];
  const headers = headerCells.map((cell) =>
    cleanInlineText(serializeNodes(Array.from(cell.childNodes), { inPre: false, listDepth: 0 })),
  );
  const headerLine = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;

  const body = rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll<HTMLElement>('td,th'));
      const values = cells.map((cell) =>
        cleanInlineText(
          serializeNodes(Array.from(cell.childNodes), { inPre: false, listDepth: 0 }),
        ),
      );
      return `| ${values.join(' | ')} |`;
    })
    .join('\n');

  return [headerLine, divider, body].filter(Boolean).join('\n');
}

function cleanInlineText(text: string) {
  return text.replace(/\n+/g, ' ').trim();
}

function block(content: string) {
  return `${content.trimEnd()}\n\n`;
}

function normalizeBlankLines(text: string) {
  return text.replace(/\n{3,}/g, '\n\n');
}

function detectLanguage(code?: HTMLElement | null) {
  if (!code) return '';
  const className = code.className || '';
  const match = className.match(/language-([\w+-]+)/);
  if (match) return match[1];
  const badge = code.parentElement?.querySelector('[data-testid="language-badge"]');
  if (badge) return badge.textContent?.trim() || '';
  return code.getAttribute('data-language') || '';
}

interface ExportMessage {
  role: ChatRole;
  content: string;
}

function buildDocument(title: string, messages: ExportMessage[], exportedAt: Date) {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Exported: ${exportedAt.toISOString()}`);
  lines.push(`Source: ${location.href}`);
  lines.push('');

  const roleLabel: Record<ChatRole, string> = {
    assistant: 'Assistant',
    user: 'User',
    system: 'System',
    tool: 'Tool',
    unknown: 'Unknown',
  };

  messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. ${roleLabel[message.role]}`);
    lines.push('');
    lines.push(message.content || '_empty message_');
    lines.push('');
  });

  const documentText = lines.join('\n');
  return normalizeBlankLines(documentText).trimEnd() + '\n';
}

function triggerDownload(markdown: string, title: string, exportedAt: Date) {
  const fileName = `${buildFilePrefix(exportedAt)}-${toSlug(title)}.md`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildFilePrefix(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `chatgpt-${y}${m}${d}-${hh}${mm}`;
}

function toSlug(text: string) {
  return sanitizeFilename(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'conversation';
}

function sanitizeFilename(name: string) {
  return name.replace(/[\u0000-\u001F<>:\"/\\|?*]+/g, '').trim() || 'conversation';
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${EXPORT_BUTTON_ID} {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 9999;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: linear-gradient(135deg, #1f2937, #111827);
      color: #e5e7eb;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    #${EXPORT_BUTTON_ID}:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 34px rgba(0,0,0,0.32);
    }
    #${EXPORT_BUTTON_ID}:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

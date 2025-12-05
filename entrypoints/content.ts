type ChatRole = 'assistant' | 'user' | 'system' | 'tool' | 'unknown';

const EXPORT_BUTTON_ID = 'gpt-exporter-md-button';
const STYLE_ID = 'gpt-exporter-style';
const MODAL_OVERLAY_ID = 'gpt-exporter-qa-overlay';

let qaPairsCache: QAPair[] = [];
let modalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
let modalOverlay: HTMLDivElement | null = null;

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
    const originalLabel = 'Export MD';
    button.disabled = true;
    try {
      button.textContent = 'Preparing...';
      const success = await prepareQuestionSelection();
      button.textContent = success ? 'Choose Q&A' : 'No Answers';
    } catch (error) {
      console.error('[GPT Exporter] Failed to prepare selection', error);
      button.textContent = 'Retry Setup';
    } finally {
      setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
      }, 900);
    }
  });
  return button;
}

async function prepareQuestionSelection() {
  const originalScroll = window.scrollY;
  await ensureConversationLoaded(originalScroll);

  const messages = collectMessages();
  if (messages.length === 0) {
    console.warn('[GPT Exporter] No messages found on this page.');
    window.alert('No messages detected. Please ensure the conversation is loaded.');
    return false;
  }

  const qaPairs = groupMessagesIntoQA(messages);
  if (!qaPairs.length) {
    console.warn('[GPT Exporter] No answered questions found.');
    window.alert('No answered questions found. Please ensure at least one prompt has a response.');
    return false;
  }

  qaPairsCache = qaPairs;
  openSelectionModal(qaPairs);
  return true;
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

function groupMessagesIntoQA(messages: ExportMessage[]): QAPair[] {
  const pairs: QAPair[] = [];
  let currentQuestion: ExportMessage | null = null;
  let currentAnswers: ExportMessage[] = [];
  let counter = 0;

  const flush = () => {
    if (!currentQuestion) return;
    const meaningfulAnswers = currentAnswers.filter((answer) =>
      isMeaningfulAnswer(answer.content),
    );
    if (!meaningfulAnswers.length) {
      currentQuestion = null;
      currentAnswers = [];
      return;
    }
    counter += 1;
    const question = currentQuestion;
    pairs.push({
      id: `qa-${counter}`,
      question,
      answers: meaningfulAnswers,
      summary: summarizeQuestion(question.content),
    });
    currentQuestion = null;
    currentAnswers = [];
  };

  for (const message of messages) {
    if (message.role === 'user') {
      flush();
      currentQuestion = message;
      currentAnswers = [];
      continue;
    }

    if (!currentQuestion) continue;

    if (message.role === 'assistant' || message.role === 'tool') {
      currentAnswers.push(message);
    }
  }

  flush();
  return pairs;
}

function summarizeQuestion(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines[0] || '_empty question_';
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

function openSelectionModal(pairs: QAPair[]) {
  closeSelectionModal();

  const overlay = document.createElement('div');
  overlay.id = MODAL_OVERLAY_ID;
  overlay.className = 'gpt-exporter-overlay';

  const modal = document.createElement('div');
  modal.className = 'gpt-exporter-modal';
  overlay.appendChild(modal);

  const header = document.createElement('div');
  header.className = 'gpt-exporter-modal-header';
  const title = document.createElement('h2');
  title.textContent = 'Select Questions';
  const subtitle = document.createElement('p');
  subtitle.textContent =
    'Choose the prompts you want to include. Only questions with responses appear here.';
  header.append(title, subtitle);
  modal.appendChild(header);

  const list = document.createElement('div');
  list.className = 'gpt-exporter-qa-list';
  renderQAList(list, pairs);
  modal.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'gpt-exporter-modal-actions';

  const confirmButton = createModalButton('Export Selected', true);
  confirmButton.addEventListener('click', () => {
    void handleConfirmExport(list, confirmButton);
  });

  const selectAllButton = createModalButton('Select All');
  selectAllButton.addEventListener('click', () => {
    setAllCheckboxes(list, true);
    updateConfirmState(list, confirmButton);
  });

  const clearButton = createModalButton('Clear');
  clearButton.addEventListener('click', () => {
    setAllCheckboxes(list, false);
    updateConfirmState(list, confirmButton);
  });

  const cancelButton = createModalButton('Cancel');
  cancelButton.addEventListener('click', () => {
    closeSelectionModal();
  });

  actions.append(selectAllButton, clearButton, cancelButton, confirmButton);
  modal.appendChild(actions);

  list.addEventListener('change', () => updateConfirmState(list, confirmButton));
  updateConfirmState(list, confirmButton);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeSelectionModal();
    }
  });

  modalKeydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSelectionModal();
    }
  };

  document.addEventListener('keydown', modalKeydownHandler, true);
  document.body.appendChild(overlay);
  modalOverlay = overlay;

  const firstCheckbox = list.querySelector<HTMLInputElement>('input[type="checkbox"]');
  firstCheckbox?.focus();
}

function closeSelectionModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
  }
  if (modalKeydownHandler) {
    document.removeEventListener('keydown', modalKeydownHandler, true);
    modalKeydownHandler = null;
  }
}

function renderQAList(container: HTMLElement, pairs: QAPair[]) {
  container.innerHTML = '';
  pairs.forEach((pair) => {
    const label = document.createElement('label');
    label.className = 'gpt-exporter-qa-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.qaId = pair.id;

    const textWrapper = document.createElement('div');
    textWrapper.className = 'gpt-exporter-qa-text';

    const summary = document.createElement('div');
    summary.className = 'gpt-exporter-qa-summary';
    summary.textContent = pair.summary;

    const meta = document.createElement('div');
    meta.className = 'gpt-exporter-qa-meta';
    const answerLabel = pair.answers.length > 1 ? 'answers' : 'answer';
    meta.textContent = `${pair.answers.length} ${answerLabel}`;

    textWrapper.append(summary, meta);
    label.append(checkbox, textWrapper);
    container.appendChild(label);
  });
}

function createModalButton(label: string, primary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = primary
    ? 'gpt-exporter-btn primary'
    : 'gpt-exporter-btn secondary';
  return button;
}

function updateConfirmState(container: HTMLElement, button: HTMLButtonElement) {
  const hasSelection = getSelectedPairIds(container).length > 0;
  button.disabled = !hasSelection;
}

function setAllCheckboxes(container: HTMLElement, checked: boolean) {
  const checkboxes = container.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"][data-qa-id]',
  );
  checkboxes.forEach((checkbox) => {
    checkbox.checked = checked;
  });
}

function getSelectedPairIds(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-qa-id]',
    ),
  )
    .filter((input) => input.checked && input.dataset.qaId)
    .map((input) => input.dataset.qaId!);
}

async function handleConfirmExport(
  container: HTMLElement,
  button: HTMLButtonElement,
) {
  const selectedIds = getSelectedPairIds(container);
  if (!selectedIds.length) {
    window.alert('Please select at least one question before exporting.');
    return;
  }

  const originalText = button.textContent || 'Export Selected';
  button.disabled = true;
  button.textContent = 'Exporting...';

  try {
    await exportSelectedPairs(selectedIds);
    closeSelectionModal();
  } catch (error) {
    console.error('[GPT Exporter] Failed to export selected questions', error);
    button.textContent = 'Retry Export';
    button.disabled = false;
    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  }
}

async function exportSelectedPairs(ids: string[]) {
  const idSet = new Set(ids);
  const selected = qaPairsCache.filter((pair) => idSet.has(pair.id));
  if (!selected.length) {
    throw new Error('Selection is empty after filtering.');
  }
  const exportedAt = new Date();
  const title = sanitizeFilename(document.title || 'ChatGPT Conversation');
  const markdown = buildQADocument(title, selected, exportedAt);
  triggerDownload(markdown, title, exportedAt);
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

interface QAPair {
  id: string;
  question: ExportMessage;
  answers: ExportMessage[];
  summary: string;
}

const ERROR_PATTERNS = [
  /something went wrong/i,
  /network error/i,
  /an error occurred/i,
  /bad gateway/i,
  /please try again/i,
  /timed out/i,
];

function isMeaningfulAnswer(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return !ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildQADocument(title: string, pairs: QAPair[], exportedAt: Date) {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Exported: ${exportedAt.toISOString()}`);
  lines.push(`Source: ${location.href}`);
  lines.push('');

  if (!pairs.length) {
    lines.push('_No questions selected._');
    lines.push('');
  }

  pairs.forEach((pair, index) => {
    lines.push(`## Q${index + 1}`);
    lines.push('');
    lines.push('### Question');
    lines.push('');
    lines.push(pair.question.content || '_empty question_');
    lines.push('');

    if (pair.answers.length === 1) {
      const answer = pair.answers[0];
      lines.push(`### Answer (${formatRoleLabel(answer.role)})`);
      lines.push('');
      lines.push(answer.content || '_empty answer_');
      lines.push('');
      return;
    }

    lines.push('### Answers');
    lines.push('');
    pair.answers.forEach((answer, answerIndex) => {
      lines.push(`#### Answer ${answerIndex + 1} (${formatRoleLabel(answer.role)})`);
      lines.push('');
      lines.push(answer.content || '_empty answer_');
      lines.push('');
    });
  });

  const documentText = lines.join('\n');
  return normalizeBlankLines(documentText).trimEnd() + '\n';
}

function formatRoleLabel(role: ChatRole) {
  switch (role) {
    case 'assistant':
      return 'Assistant';
    case 'user':
      return 'User';
    case 'system':
      return 'System';
    case 'tool':
      return 'Tool';
    default:
      return 'Unknown';
  }
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
    #${MODAL_OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(3px);
    }
    #${MODAL_OVERLAY_ID} .gpt-exporter-modal {
      width: min(560px, calc(100% - 32px));
      max-height: 85vh;
      background: #0f172a;
      color: #f9fafb;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px 22px;
      overflow: hidden;
    }
    .gpt-exporter-modal-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .gpt-exporter-modal-header p {
      margin: 4px 0 0;
      color: rgba(226, 232, 240, 0.82);
      font-size: 14px;
    }
    .gpt-exporter-qa-list {
      flex: 1;
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 8px;
      background: rgba(15, 23, 42, 0.6);
    }
    .gpt-exporter-qa-item {
      display: flex;
      gap: 12px;
      padding: 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .gpt-exporter-qa-item:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .gpt-exporter-qa-item input[type="checkbox"] {
      margin-top: 4px;
    }
    .gpt-exporter-qa-summary {
      font-weight: 600;
      font-size: 14px;
      color: #f8fafc;
    }
    .gpt-exporter-qa-meta {
      font-size: 12px;
      color: rgba(226, 232, 240, 0.75);
      margin-top: 4px;
    }
    .gpt-exporter-modal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
    }
    .gpt-exporter-btn {
      border-radius: 10px;
      padding: 8px 14px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(30, 41, 59, 0.9);
      color: #f8fafc;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease;
    }
    .gpt-exporter-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      background: rgba(51, 65, 85, 0.95);
    }
    .gpt-exporter-btn.primary {
      background: linear-gradient(135deg, #4c1d95, #7c3aed);
      border-color: rgba(124, 58, 237, 0.6);
    }
    .gpt-exporter-btn.primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

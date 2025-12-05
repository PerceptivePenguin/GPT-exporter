import type { ChatRole, QAPair } from '../types/conversation';

type SerializeContext = { inPre: boolean; listDepth: number };

export function elementToMarkdown(root: HTMLElement): string {
  const content = serializeNodes(Array.from(root.childNodes), {
    inPre: false,
    listDepth: 0,
  });
  return normalizeBlankLines(content.trim());
}

export function buildQADocument(
  title: string,
  pairs: QAPair[],
  exportedAt: Date,
): string {
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
      lines.push(
        `#### Answer ${answerIndex + 1} (${formatRoleLabel(answer.role)})`,
      );
      lines.push('');
      lines.push(answer.content || '_empty answer_');
      lines.push('');
    });
  });

  const documentText = lines.join('\n');
  return normalizeBlankLines(documentText).trimEnd() + '\n';
}

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
        detectLanguage(code) || element.getAttribute('data-language') || '';
      const codeText = code?.textContent ?? element.textContent ?? '';
      return block(`\`\`\`${language}\n${codeText.trimEnd()}\n\`\`\``);
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
    Array.from(rows.shift()?.querySelectorAll<HTMLElement>('th,td') || []) || [];
  const headers = headerCells.map((cell) =>
    cleanInlineText(
      serializeNodes(Array.from(cell.childNodes), { inPre: false, listDepth: 0 }),
    ),
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

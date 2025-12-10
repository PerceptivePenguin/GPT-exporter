import type { QAPair } from '../types/conversation';

export interface SummaryDocumentOptions {
  title: string;
  scopeLabel: string;
  providerName: string;
  model: string;
  summaryText: string;
  exportedAt: Date;
}

export function buildSummaryPrompt(
  pairs: QAPair[],
  scopeLabel: string,
  template?: string,
) {
  const serialized = pairs
    .map(
      (pair, index) =>
        `Q${index + 1}:\nUser: ${pair.question.content}\nAssistant:\n${pair.answers
          .map((answer) => answer.content)
          .join('\n')}`,
    )
    .join('\n\n');

  if (template) {
    const processed = template
      .replace(/{{\s*scope\s*}}/gi, scopeLabel)
      .replace(/{{\s*conversation\s*}}/gi, serialized);
    if (template.includes('{{conversation}}')) {
      return processed;
    }
    return `${processed}\n\nConversation:\n${serialized}`;
  }

  return [
    'You are an AI assistant that creates concise structured meeting notes.',
    `Context: ${scopeLabel}`,
    'Please read the following ChatGPT conversation segments and produce a structured summary with the following sections:',
    '1. Overall Summary (2-3 sentences)',
    '2. Key Points (bullet list)',
    '3. Action Items (bullet list with owners if applicable)',
    '4. Open Questions or Risks (if any)',
    'Conversation:',
    serialized,
  ].join('\n\n');
}

export function buildSummaryDocument(options: SummaryDocumentOptions) {
  const { title, scopeLabel, providerName, model, summaryText, exportedAt } =
    options;
  return [
    `# ${title}`,
    '',
    `Scope: ${scopeLabel}`,
    `Generated: ${exportedAt.toISOString()}`,
    `Provider: ${providerName} (${model})`,
    '',
    summaryText.trim(),
    '',
  ].join('\n');
}

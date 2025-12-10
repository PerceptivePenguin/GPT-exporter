const SUMMARY_PROMPT_KEY = 'gptExporterSummaryPrompt';

export const DEFAULT_SUMMARY_PROMPT = [
  'You are an AI assistant that writes concise structured summaries for ChatGPT conversations.',
  'Please include the following sections:',
  '1. Overall Summary (2-3 sentences)',
  '2. Key Points (bullet list)',
  '3. Action Items (bullet list with owners if possible)',
  '4. Open Questions or Risks (if any)',
  '',
  'Scope: {{scope}}',
  'Conversation:',
  '{{conversation}}',
].join('\n');

export async function loadSummaryPromptTemplate() {
  try {
    const stored =
      (await browser?.storage?.sync?.get(SUMMARY_PROMPT_KEY)) ??
      (await browser?.storage?.local?.get(SUMMARY_PROMPT_KEY));
    const value = stored?.[SUMMARY_PROMPT_KEY];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  } catch (error) {
    console.warn('[GPT Exporter] Failed to load summary prompt', error);
  }
  return DEFAULT_SUMMARY_PROMPT;
}

export async function saveSummaryPromptTemplate(template: string) {
  await browser?.storage?.sync?.set({
    [SUMMARY_PROMPT_KEY]: template,
  });
}

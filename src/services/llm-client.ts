import type { QAPair } from '../types/conversation';
import type { ProviderConfig } from '../types/provider';
import { buildSummaryPrompt, buildSummaryDocument } from '../export/summary';
import { sanitizeFilename, triggerDownload } from '../export/download';

interface SummaryParams {
  pairs: QAPair[];
  scopeLabel: string;
  provider: ProviderConfig;
  documentTitle: string;
  fileName?: string;
  promptTemplate?: string;
}

export async function summarizeConversation(params: SummaryParams) {
  const { pairs, scopeLabel, provider, documentTitle, fileName, promptTemplate } =
    params;
  const prompt = buildSummaryPrompt(pairs, scopeLabel, promptTemplate);
  const summaryText = await callProvider(provider, prompt);
  const markdown = buildSummaryDocument({
    title: documentTitle,
    scopeLabel,
    providerName: provider.name,
    model: provider.defaultModel,
    summaryText,
    exportedAt: new Date(),
  });
  const sanitized =
    sanitizeFilename(fileName || `${documentTitle}-summary`) + '.md';
  triggerDownload(markdown, documentTitle, new Date(), sanitized);
}

async function callProvider(provider: ProviderConfig, prompt: string) {
  switch (provider.protocol) {
    case 'openai':
      return callOpenAI(provider, prompt);
    case 'anthropic':
      return callAnthropic(provider, prompt);
    case 'gemini':
      return callGemini(provider, prompt);
    default:
      return callCustom(provider, prompt);
  }
}

async function callOpenAI(provider: ProviderConfig, prompt: string) {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      ...(provider.customHeaders || {}),
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'OpenAI request failed');
  }
  return payload?.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callAnthropic(provider: ProviderConfig, prompt: string) {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(provider.customHeaders || {}),
    },
    body: JSON.stringify({
      model: provider.defaultModel,
      max_tokens: 1024,
      system: 'You summarize conversations into structured sections.',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Anthropic request failed');
  }
  const content = payload?.content?.find?.(
    (segment: any) => segment.type === 'text',
  );
  return content?.text?.trim() ?? '';
}

async function callGemini(provider: ProviderConfig, prompt: string) {
  const url = `${provider.baseUrl.replace(/\/$/, '')}/v1beta/models/${
    provider.defaultModel
  }:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(provider.customHeaders || {}),
    },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Gemini request failed');
  }
  return payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

async function callCustom(provider: ProviderConfig, prompt: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(provider.customHeaders || {}),
  };
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }
  const response = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.defaultModel,
      prompt,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Custom provider request failed');
  }
  return (
    payload?.summary ||
    payload?.content ||
    payload?.result ||
    JSON.stringify(payload)
  );
}

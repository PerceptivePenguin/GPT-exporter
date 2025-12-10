import { collectMessages, collectUserQuestions } from '../src/dom/message-parser';
import { triggerDownload, sanitizeFilename } from '../src/export/download';
import { buildQADocument } from '../src/export/markdown';
import { groupMessagesIntoQA } from '../src/qa/grouping';
import { injectUIStyles } from '../src/styles';
import { openSelectionModal } from '../src/ui/modal';
import {
  toggleNavigationPanel,
  updateNavigationPanel,
} from '../src/ui/navigation';
import { getActiveProvider } from '../src/config/provider-registry';
import { loadSummaryPromptTemplate } from '../src/config/summary-prompt';
import { summarizeConversation } from '../src/services/llm-client';
import type { QAPair } from '../src/types/conversation';
import type { QuestionEntry } from '../src/types/conversation';

const EXPORT_BUTTON_ID = 'gpt-exporter-md-button';
const NAV_BUTTON_ID = 'gpt-exporter-nav-button';
const STYLE_ID = 'gpt-exporter-style';
const MODAL_OVERLAY_ID = 'gpt-exporter-qa-overlay';
const NAV_PANEL_ID = 'gpt-exporter-nav-panel';
const HIGHLIGHT_CLASS = 'gpt-exporter-highlight';

let qaPairsCache: QAPair[] = [];
let questionEntries: QuestionEntry[] = [];
let lastQuestionIds: string[] = [];
let questionRefreshTimer: number | null = null;
let questionObserver: MutationObserver | null = null;

export default defineContentScript({
  matches: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
  runAt: 'document_end',
  main() {
    injectUIStyles(
      STYLE_ID,
      EXPORT_BUTTON_ID,
      MODAL_OVERLAY_ID,
      [NAV_BUTTON_ID],
      NAV_PANEL_ID,
      HIGHLIGHT_CLASS,
    );
    mountButtons();
    keepButtonAlive();
    startQuestionIndexWatcher();
  },
});

function keepButtonAlive() {
  const observer = new MutationObserver(() => {
    if (!document.getElementById(EXPORT_BUTTON_ID)) {
      mountButtons();
    }
    if (!document.getElementById(NAV_BUTTON_ID)) {
      mountButtons();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function mountButtons() {
  if (!document.body) return;
  if (!document.getElementById(EXPORT_BUTTON_ID)) {
    document.body.appendChild(createExportButton());
  }
  if (!document.getElementById(NAV_BUTTON_ID)) {
    document.body.appendChild(createNavigationButton());
  }
}

function createExportButton() {
  const button = document.createElement('button');
  button.id = EXPORT_BUTTON_ID;
  button.type = 'button';
  button.textContent = '导出为MD';
  button.addEventListener('click', async () => {
    const originalLabel = '导出为MD';
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

function createNavigationButton() {
  const button = document.createElement('button');
  button.id = NAV_BUTTON_ID;
  button.type = 'button';
  button.textContent = '问题导航';
  button.addEventListener('click', () => {
    toggleNavigationPanel(questionEntries, {
      panelId: NAV_PANEL_ID,
      onEntryClick: handleNavigationClick,
    });
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
  openSelectionModal(qaPairs, {
    overlayId: MODAL_OVERLAY_ID,
    onConfirm: exportSelectedPairs,
    summaryAction: {
      label: 'Summarize Selected',
      handler: summarizeSelectedPairs,
    },
  });
  return true;
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

function startQuestionIndexWatcher() {
  refreshQuestionEntries();
  if (questionObserver) {
    questionObserver.disconnect();
  }
  questionObserver = new MutationObserver(scheduleQuestionRefresh);
  questionObserver.observe(document.body, { childList: true, subtree: true });
}

function scheduleQuestionRefresh() {
  if (questionRefreshTimer) return;
  questionRefreshTimer = window.setTimeout(() => {
    questionRefreshTimer = null;
    refreshQuestionEntries();
  }, 200);
}

function refreshQuestionEntries() {
  const nextEntries = collectUserQuestions();
  const nextIds = nextEntries.map((item) => item.id);
  if (
    nextIds.length === lastQuestionIds.length &&
    nextIds.every((id, idx) => id === lastQuestionIds[idx])
  ) {
    return;
  }
  questionEntries = nextEntries;
  lastQuestionIds = nextIds;
  updateNavigationPanel(questionEntries);
}

function handleNavigationClick(entry: QuestionEntry) {
  try {
    entry.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashHighlight(entry.node);
  } catch (error) {
    console.error('[GPT Exporter] Failed to scroll to question', error);
  }
}

async function ensureConversationLoaded(originalScroll: number) {
  window.scrollTo({ top: 0, behavior: 'auto' });
  await delay(350);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  await delay(350);
  window.scrollTo({ top: originalScroll, behavior: 'auto' });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flashHighlight(node: HTMLElement) {
  node.classList.add(HIGHLIGHT_CLASS);
  window.setTimeout(() => {
    node.classList.remove(HIGHLIGHT_CLASS);
  }, 1400);
}

async function handleSummarizeAll(button: HTMLButtonElement) {
  const originalText = button.textContent || 'Summarize All';
  button.disabled = true;
  try {
    button.textContent = 'Summarizing...';
    const pairs = await loadConversationPairs();
    if (!pairs.length) return;
    await summarizePairs(pairs, 'Full Conversation');
    button.textContent = 'Summary Ready';
  } catch (error) {
    console.error('[GPT Exporter] Summarize all failed', error);
    window.alert('Failed to generate summary. Please check provider settings or console logs.');
    button.textContent = 'Retry Summary';
  } finally {
    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1200);
  }
}

async function loadConversationPairs() {
  const originalScroll = window.scrollY;
  await ensureConversationLoaded(originalScroll);
  const messages = collectMessages();
  if (!messages.length) {
    window.alert('No messages detected. Please ensure the conversation is loaded.');
    return [];
  }
  const pairs = groupMessagesIntoQA(messages);
  if (!pairs.length) {
    window.alert('No answered questions found. Please ensure at least one prompt has a response.');
  }
  return pairs;
}

async function summarizeSelectedPairs(ids: string[]) {
  const idSet = new Set(ids);
  const selected = qaPairsCache.filter((pair) => idSet.has(pair.id));
  if (!selected.length) {
    window.alert('No questions selected for summary.');
    return;
  }
  await summarizePairs(
    selected,
    `Selected (${selected.length} question${selected.length > 1 ? 's' : ''})`,
  );
}

async function summarizePairs(pairs: QAPair[], scopeLabel: string) {
  if (!pairs.length) return;
  const provider = await getActiveProvider();
  if (!provider || !provider.baseUrl || !provider.apiKey) {
    window.alert(
      'No summary provider configured. Please add API credentials in provider settings.',
    );
    return;
  }
  const rawTitle = document.title || 'ChatGPT Conversation';
  const defaultName = `${sanitizeFilename(rawTitle)}-${scopeLabel
    .toLowerCase()
    .replace(/\s+/g, '-')}-summary`;
  const userFileName =
    window.prompt(
      'Enter summary file name (without extension). Leave blank to use default.',
      defaultName,
    ) || defaultName;
  const template = await loadSummaryPromptTemplate();
  await summarizeConversation({
    pairs,
    scopeLabel,
    provider,
    documentTitle: rawTitle,
    fileName: userFileName,
    promptTemplate: template,
  });
}

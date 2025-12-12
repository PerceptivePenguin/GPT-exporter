import { collectMessages, collectUserQuestions } from '../src/dom/message-parser';
import {
  triggerDownload,
  sanitizeFilename,
  buildFilePrefix,
  toSlug,
} from '../src/export/download';
import { buildQADocument } from '../src/export/markdown';
import { groupMessagesIntoQA } from '../src/qa/grouping';
import { injectUIStyles } from '../src/styles';
import { openSelectionModal, updateSelectionModalLocale } from '../src/ui/modal';
import {
  toggleNavigationPanel,
  updateNavigationPanel,
} from '../src/ui/navigation';
import { getActiveProvider } from '../src/config/provider-registry';
import { loadSummaryPromptTemplate } from '../src/config/summary-prompt';
import { summarizeConversation } from '../src/services/llm-client';
import {
  LOCALE_KEY,
  loadLocale,
  resolveLocale,
  setLocaleCache,
  t,
} from '../src/config/i18n';
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
    void bootstrapLocale();
    listenLocaleChanges();
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

async function bootstrapLocale() {
  const loaded = await loadLocale();
  setLocaleCache(loaded);
  refreshInjectedUIText();
}

function listenLocaleChanges() {
  const globalAny = globalThis as any;
  const storage = globalAny.browser?.storage ?? globalAny.chrome?.storage;
  storage?.onChanged?.addListener(
    (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'sync' && area !== 'local') return;
      const change = changes?.[LOCALE_KEY];
      if (!change) return;
      const next = resolveLocale(change.newValue as string | null | undefined);
      setLocaleCache(next);
      refreshInjectedUIText();
    },
  );
}

function refreshInjectedUIText() {
  const exportButton = document.getElementById(EXPORT_BUTTON_ID) as
    | HTMLButtonElement
    | null;
  if (exportButton && !exportButton.disabled) {
    exportButton.textContent = t('exportButton');
  }
  const navButton = document.getElementById(NAV_BUTTON_ID) as HTMLButtonElement | null;
  if (navButton) {
    navButton.textContent = t('navButton');
  }
  updateNavigationPanel(questionEntries);
  updateSelectionModalLocale();
}

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
  button.textContent = t('exportButton');
  button.addEventListener('click', async () => {
    const originalLabel = t('exportButton');
    button.disabled = true;
    try {
      button.textContent = t('preparing');
      const success = await prepareQuestionSelection();
      button.textContent = success ? t('chooseQA') : t('noAnswers');
    } catch (error) {
      console.error('[GPT Exporter] Failed to prepare selection', error);
      button.textContent = t('retrySetup');
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
  button.textContent = t('navButton');
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
    window.alert(t('noMessagesAlert'));
    return false;
  }

  const qaPairs = groupMessagesIntoQA(messages);
  if (!qaPairs.length) {
    console.warn('[GPT Exporter] No answered questions found.');
    window.alert(t('noAnsweredAlert'));
    return false;
  }

  qaPairsCache = qaPairs;
  openSelectionModal(qaPairs, {
    overlayId: MODAL_OVERLAY_ID,
    onConfirm: exportSelectedPairs,
    summaryAction: {
      key: 'summarizeSelected',
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
  const rawTitle = document.title || 'ChatGPT Conversation';
  const title = sanitizeFilename(rawTitle);
  const defaultFileName = `${buildFilePrefix(exportedAt)}-${toSlug(title)}`;
  const userFileName = window.prompt(t('exportFilePrompt'), defaultFileName);
  if (userFileName === null) {
    throw new Error('EXPORT_CANCELLED');
  }
  const baseName = userFileName.trim() || defaultFileName;
  const withExtension = baseName.toLowerCase().endsWith('.md')
    ? baseName
    : `${baseName}.md`;
  const sanitizedFileName = sanitizeFilename(withExtension);
  const markdown = buildQADocument(title, selected, exportedAt);
  triggerDownload(markdown, title, exportedAt, sanitizedFileName);
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
    button.textContent = t('summarizing');
    const pairs = await loadConversationPairs();
    if (!pairs.length) return;
    await summarizePairs(pairs, 'Full Conversation');
    button.textContent = t('summaryReady');
  } catch (error) {
    console.error('[GPT Exporter] Summarize all failed', error);
    window.alert('Failed to generate summary. Please check provider settings or console logs.');
    button.textContent = t('retrySummary');
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
    window.alert(t('noMessagesAlert'));
    return [];
  }
  const pairs = groupMessagesIntoQA(messages);
  if (!pairs.length) {
    window.alert(t('noAnsweredAlert'));
  }
  return pairs;
}

async function summarizeSelectedPairs(ids: string[]) {
  const idSet = new Set(ids);
  const selected = qaPairsCache.filter((pair) => idSet.has(pair.id));
  if (!selected.length) {
    window.alert(t('summarySelectionEmpty'));
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
    window.alert(t('noSummaryProvider'));
    return;
  }
  const rawTitle = document.title || 'ChatGPT Conversation';
  const defaultName = `${sanitizeFilename(rawTitle)}-${scopeLabel
    .toLowerCase()
    .replace(/\s+/g, '-')}-summary`;
  const userFileName =
    window.prompt(
      t('summaryFilePrompt'),
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

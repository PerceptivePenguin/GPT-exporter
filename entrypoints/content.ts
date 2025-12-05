import { collectMessages } from '../src/dom/message-parser';
import { triggerDownload, sanitizeFilename } from '../src/export/download';
import { buildQADocument } from '../src/export/markdown';
import { groupMessagesIntoQA } from '../src/qa/grouping';
import { injectUIStyles } from '../src/styles';
import { openSelectionModal } from '../src/ui/modal';
import type { QAPair } from '../src/types/conversation';

const EXPORT_BUTTON_ID = 'gpt-exporter-md-button';
const STYLE_ID = 'gpt-exporter-style';
const MODAL_OVERLAY_ID = 'gpt-exporter-qa-overlay';

let qaPairsCache: QAPair[] = [];

export default defineContentScript({
  matches: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
  runAt: 'document_end',
  main() {
    injectUIStyles(STYLE_ID, EXPORT_BUTTON_ID, MODAL_OVERLAY_ID);
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
  openSelectionModal(qaPairs, {
    overlayId: MODAL_OVERLAY_ID,
    onConfirm: exportSelectedPairs,
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

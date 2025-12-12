import { t } from '../config/i18n';
import type { QAPair } from '../types/conversation';

export interface SelectionModalOptions {
  overlayId: string;
  onConfirm: (ids: string[]) => Promise<void>;
  onCancel?: () => void;
  summaryAction?: {
    label?: string;
    key?: Parameters<typeof t>[0];
    handler: (ids: string[]) => Promise<void>;
  };
}

let overlayRef: HTMLDivElement | null = null;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let activeOptions: SelectionModalOptions | null = null;

export function openSelectionModal(pairs: QAPair[], options: SelectionModalOptions) {
  closeSelectionModal();
  const tr = (key: Parameters<typeof t>[0]) => t(key);

  const overlay = document.createElement('div');
  overlay.id = options.overlayId;
  overlay.className = 'gpt-exporter-overlay';

  const modal = document.createElement('div');
  modal.className = 'gpt-exporter-modal';
  overlay.appendChild(modal);

  const header = document.createElement('div');
  header.className = 'gpt-exporter-modal-header';
  const title = document.createElement('h2');
  title.textContent = tr('modalTitle');
  const subtitle = document.createElement('p');
  subtitle.textContent = tr('modalSubtitle');
  header.append(title, subtitle);
  modal.appendChild(header);

  const list = document.createElement('div');
  list.className = 'gpt-exporter-qa-list';
  renderQAList(list, pairs);
  modal.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'gpt-exporter-modal-actions';

  const confirmButton = createModalButton(tr('exportSelected'), true, 'exportSelected');
  confirmButton.addEventListener('click', () => {
    void handleConfirm(list, confirmButton, options);
  });
  let summarizeButton: HTMLButtonElement | null = null;
  if (options.summaryAction) {
    const summaryKey = options.summaryAction.key;
    const summaryLabel =
      summaryKey ? tr(summaryKey) : options.summaryAction.label || tr('summarizeSelected');
    summarizeButton = createModalButton(summaryLabel, true, summaryKey);
    summarizeButton.addEventListener('click', () => {
      void handleSummary(list, summarizeButton!, options.summaryAction!);
    });
  }

  const selectAllButton = createModalButton(tr('selectAll'), false, 'selectAll');
  selectAllButton.addEventListener('click', () => {
    setAllCheckboxes(list, true);
    updateConfirmState(list, confirmButton);
  });

  const clearButton = createModalButton(tr('clear'), false, 'clear');
  clearButton.addEventListener('click', () => {
    setAllCheckboxes(list, false);
    updateConfirmState(list, confirmButton);
  });

  const cancelButton = createModalButton(tr('cancel'), false, 'cancel');
  cancelButton.addEventListener('click', () => {
    closeSelectionModal('cancel');
  });

  if (summarizeButton) {
    actions.append(
      selectAllButton,
      clearButton,
      cancelButton,
      confirmButton,
      summarizeButton,
    );
  } else {
    actions.append(selectAllButton, clearButton, cancelButton, confirmButton);
  }
  modal.appendChild(actions);

  list.addEventListener('change', () => updateConfirmState(list, confirmButton));
  updateConfirmState(list, confirmButton);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeSelectionModal('cancel');
    }
  });

  keydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSelectionModal('cancel');
    }
  };

  document.addEventListener('keydown', keydownHandler, true);
  document.body.appendChild(overlay);
  overlayRef = overlay;
  activeOptions = options;

  const firstCheckbox = list.querySelector<HTMLInputElement>('input[type="checkbox"]');
  firstCheckbox?.focus();
}

export function closeSelectionModal(reason: 'confirm' | 'cancel' = 'cancel') {
  if (overlayRef) {
    overlayRef.remove();
    overlayRef = null;
  }
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, true);
    keydownHandler = null;
  }
  if (reason === 'cancel') {
    activeOptions?.onCancel?.();
  }
  activeOptions = null;
}

export function updateSelectionModalLocale() {
  if (!overlayRef) return;
  const title = overlayRef.querySelector<HTMLHeadingElement>(
    '.gpt-exporter-modal-header h2',
  );
  if (title) title.textContent = t('modalTitle');
  const subtitle = overlayRef.querySelector<HTMLParagraphElement>(
    '.gpt-exporter-modal-header p',
  );
  if (subtitle) subtitle.textContent = t('modalSubtitle');
  overlayRef
    .querySelectorAll<HTMLButtonElement>('button[data-i18n-key]')
    .forEach((button) => {
      const key = button.dataset.i18nKey as Parameters<typeof t>[0] | undefined;
      if (key) button.textContent = t(key);
    });
  overlayRef
    .querySelectorAll<HTMLDivElement>('.gpt-exporter-qa-meta')
    .forEach((meta) => {
      const count = Number(meta.dataset.answerCount || '0');
      const labelKey = count > 1 ? 'answersLabel' : 'answerLabel';
      meta.textContent = `${count} ${t(labelKey)}`;
    });
}

async function handleConfirm(
  container: HTMLElement,
  button: HTMLButtonElement,
  options: SelectionModalOptions,
) {
  const selectedIds = getSelectedPairIds(container);
  if (!selectedIds.length) {
    window.alert(t('selectionEmptyAlert'));
    return;
  }

  const originalText = button.textContent || t('exportSelected');
  button.disabled = true;
  button.textContent = t('exporting');

  try {
    await options.onConfirm(selectedIds);
    closeSelectionModal('confirm');
  } catch (error) {
    const isCancelled =
      error instanceof Error && error.message === 'EXPORT_CANCELLED';
    if (isCancelled) {
      button.textContent = originalText;
      button.disabled = false;
      return;
    }

    console.error('[GPT Exporter] Failed to export selected questions', error);
    button.textContent = t('retryExport');
    button.disabled = false;
    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  }
}

async function handleSummary(
  container: HTMLElement,
  button: HTMLButtonElement,
  summaryAction: {
    label?: string;
    key?: Parameters<typeof t>[0];
    handler: (ids: string[]) => Promise<void>;
  },
) {
  const selectedIds = getSelectedPairIds(container);
  if (!selectedIds.length) {
    window.alert(t('summarySelectionEmpty'));
    return;
  }
  const originalText =
    button.textContent ||
    (summaryAction.key ? t(summaryAction.key) : summaryAction.label) ||
    t('summarizeSelected');
  button.disabled = true;
  button.textContent = t('summarizing');
  let succeeded = false;
  try {
    await summaryAction.handler(selectedIds);
    succeeded = true;
  } catch (error) {
    console.error('[GPT Exporter] Failed to summarize selected questions', error);
    button.textContent = t('retrySummary');
    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
  } finally {
    if (succeeded) {
      button.textContent = originalText;
    }
    button.disabled = false;
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
    meta.dataset.answerCount = String(pair.answers.length);
    const answerLabelKey = pair.answers.length > 1 ? 'answersLabel' : 'answerLabel';
    meta.textContent = `${pair.answers.length} ${t(answerLabelKey)}`;

    textWrapper.append(summary, meta);
    label.append(checkbox, textWrapper);
    container.appendChild(label);
  });
}

function createModalButton(
  label: string,
  primary = false,
  i18nKey?: Parameters<typeof t>[0],
) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = primary
    ? 'gpt-exporter-btn primary'
    : 'gpt-exporter-btn secondary';
  if (i18nKey) {
    button.dataset.i18nKey = i18nKey;
  }
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

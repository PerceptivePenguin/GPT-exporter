import type { QAPair } from '../types/conversation';

export interface SelectionModalOptions {
  overlayId: string;
  onConfirm: (ids: string[]) => Promise<void>;
  onCancel?: () => void;
}

let overlayRef: HTMLDivElement | null = null;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
let activeOptions: SelectionModalOptions | null = null;

export function openSelectionModal(pairs: QAPair[], options: SelectionModalOptions) {
  closeSelectionModal();

  const overlay = document.createElement('div');
  overlay.id = options.overlayId;
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
    void handleConfirm(list, confirmButton, options);
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
    closeSelectionModal('cancel');
  });

  actions.append(selectAllButton, clearButton, cancelButton, confirmButton);
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

async function handleConfirm(
  container: HTMLElement,
  button: HTMLButtonElement,
  options: SelectionModalOptions,
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
    await options.onConfirm(selectedIds);
    closeSelectionModal('confirm');
  } catch (error) {
    console.error('[GPT Exporter] Failed to export selected questions', error);
    button.textContent = 'Retry Export';
    button.disabled = false;
    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);
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

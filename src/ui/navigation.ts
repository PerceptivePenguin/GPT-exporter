import { t } from '../config/i18n';
import type { QuestionEntry } from '../types/conversation';

export interface NavigationOptions {
  panelId: string;
  onEntryClick: (entry: QuestionEntry) => void;
}

let panelRef: HTMLDivElement | null = null;
let cachedOptions: NavigationOptions | null = null;
let cachedEntries: QuestionEntry[] = [];

export function toggleNavigationPanel(entries: QuestionEntry[], options: NavigationOptions) {
  if (panelRef) {
    closeNavigationPanel();
    return;
  }
  renderPanel(entries, options);
}

export function updateNavigationPanel(entries: QuestionEntry[]) {
  cachedEntries = entries;
  if (!panelRef || !cachedOptions) return;
  const title = panelRef.querySelector<HTMLElement>('.gpt-exporter-nav-header span');
  if (title) {
    title.textContent = t('navTitle');
  }
  const empty = panelRef.querySelector<HTMLElement>('.gpt-exporter-nav-empty');
  if (empty) {
    empty.textContent = t('navEmpty');
  }
  renderList(panelRef, entries, cachedOptions);
}

export function closeNavigationPanel() {
  if (panelRef) {
    panelRef.remove();
    panelRef = null;
  }
  cachedOptions = null;
}

function renderPanel(entries: QuestionEntry[], options: NavigationOptions) {
  closeNavigationPanel();

  const panel = document.createElement('div');
  panel.id = options.panelId;
  panel.className = 'gpt-exporter-nav-panel';

  const header = document.createElement('div');
  header.className = 'gpt-exporter-nav-header';
  const title = document.createElement('span');
  title.textContent = t('navTitle');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'gpt-exporter-nav-close';
  close.textContent = 'X';
  close.addEventListener('click', () => closeNavigationPanel());
  header.append(title, close);
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'gpt-exporter-nav-list';
  panel.appendChild(list);

  const empty = document.createElement('div');
  empty.className = 'gpt-exporter-nav-empty';
  empty.textContent = t('navEmpty');
  panel.appendChild(empty);

  cachedOptions = options;
  cachedEntries = entries;
  renderList(panel, entries, options);

  document.body.appendChild(panel);
  panelRef = panel;
}

function renderList(
  panel: HTMLDivElement,
  entries: QuestionEntry[],
  options: NavigationOptions,
) {
  const list = panel.querySelector<HTMLDivElement>('.gpt-exporter-nav-list');
  const empty = panel.querySelector<HTMLDivElement>('.gpt-exporter-nav-empty');
  if (!list || !empty) return;

  list.innerHTML = '';

  if (!entries.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  entries.forEach((entry, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'gpt-exporter-nav-item';
    const label = document.createElement('span');
    label.className = 'gpt-exporter-nav-index';
    label.textContent = String(index + 1);
    const summary = document.createElement('span');
    summary.className = 'gpt-exporter-nav-summary';
    summary.textContent = entry.summary;
    item.append(label, summary);
    item.addEventListener('click', () => options.onEntryClick(entry));
    list.appendChild(item);
  });
}

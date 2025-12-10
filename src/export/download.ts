export function triggerDownload(
  markdown: string,
  title: string,
  exportedAt: Date,
  overrideFileName?: string,
) {
  const fileName =
    overrideFileName ||
    `${buildFilePrefix(exportedAt)}-${toSlug(title)}.md`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildFilePrefix(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `chatgpt-${y}${m}${d}-${hh}${mm}`;
}

export function toSlug(text: string) {
  return sanitizeFilename(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'conversation';
}

export function sanitizeFilename(name: string) {
  return name.replace(/[\u0000-\u001F<>:\"/\\|?*]+/g, '').trim() || 'conversation';
}

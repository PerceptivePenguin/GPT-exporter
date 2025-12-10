export function injectUIStyles(
  styleId: string,
  buttonId: string,
  overlayId: string,
  floatingButtonIds: string[] = [],
  navPanelId?: string,
  highlightClass = 'gpt-exporter-highlight',
) {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  const floatingButtonsCss = floatingButtonIds
    .map((id, index) => {
      const bottom = 72 + index * 48;
      return `
      #${id} {
        position: fixed;
        right: 20px;
        bottom: ${bottom}px;
        z-index: 9999;
        padding: 9px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.2);
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #e5e7eb;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      }
      #${id}:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 12px 34px rgba(0,0,0,0.32);
      }
      #${id}:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }`;
    })
    .join('\n');
  style.textContent = `
    #${buttonId} {
      position: fixed;
      right: 20px;
      bottom: 24px;
      z-index: 9999;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: linear-gradient(135deg, #1f2937, #111827);
      color: #e5e7eb;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }
    #${buttonId}:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 34px rgba(0,0,0,0.32);
    }
    #${buttonId}:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    #${overlayId} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(3px);
    }
    #${overlayId} .gpt-exporter-modal {
      width: min(560px, calc(100% - 32px));
      max-height: 85vh;
      background: #0f172a;
      color: #f9fafb;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 20px 22px;
      overflow: hidden;
    }
    .gpt-exporter-modal-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .gpt-exporter-modal-header p {
      margin: 4px 0 0;
      color: rgba(226, 232, 240, 0.82);
      font-size: 14px;
    }
    .gpt-exporter-qa-list {
      flex: 1;
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 8px;
      background: rgba(15, 23, 42, 0.6);
    }
    .gpt-exporter-qa-item {
      display: flex;
      gap: 12px;
      padding: 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .gpt-exporter-qa-item:hover {
      background: rgba(255, 255, 255, 0.04);
    }
    .gpt-exporter-qa-item input[type="checkbox"] {
      margin-top: 4px;
    }
    .gpt-exporter-qa-summary {
      font-weight: 600;
      font-size: 14px;
      color: #f8fafc;
    }
    .gpt-exporter-qa-meta {
      font-size: 12px;
      color: rgba(226, 232, 240, 0.75);
      margin-top: 4px;
    }
    .gpt-exporter-modal-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
    }
    .gpt-exporter-btn {
      border-radius: 10px;
      padding: 8px 14px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(30, 41, 59, 0.9);
      color: #f8fafc;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease, opacity 0.15s ease;
    }
    .gpt-exporter-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      background: rgba(51, 65, 85, 0.95);
    }
    .gpt-exporter-btn.primary {
      background: linear-gradient(135deg, #4c1d95, #7c3aed);
      border-color: rgba(124, 58, 237, 0.6);
    }
    .gpt-exporter-btn.primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${floatingButtonsCss}
    ${navPanelId ? `
    #${navPanelId} {
      position: fixed;
      right: 16px;
      bottom: 120px;
      width: min(360px, calc(100% - 32px));
      max-height: 70vh;
      background: rgba(15, 23, 42, 0.95);
      color: #f9fafb;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10001;
    }
    #${navPanelId} .gpt-exporter-nav-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-weight: 700;
      font-size: 14px;
    }
    #${navPanelId} .gpt-exporter-nav-close {
      background: none;
      border: none;
      color: #e2e8f0;
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
    }
    #${navPanelId} .gpt-exporter-nav-list {
      overflow: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #${navPanelId} .gpt-exporter-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      text-align: left;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: #f8fafc;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.12s ease, transform 0.12s ease;
    }
    #${navPanelId} .gpt-exporter-nav-item:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-1px);
    }
    #${navPanelId} .gpt-exporter-nav-index {
      min-width: 20px;
      height: 20px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(124, 58, 237, 0.2);
      color: #c4b5fd;
      font-size: 12px;
      font-weight: 700;
    }
    #${navPanelId} .gpt-exporter-nav-summary {
      flex: 1;
      font-size: 13px;
      line-height: 1.4;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${navPanelId} .gpt-exporter-nav-empty {
      padding: 14px;
      color: rgba(226, 232, 240, 0.8);
      font-size: 13px;
      text-align: center;
    }
    ` : ''}
    .${highlightClass} {
      outline: 2px solid rgba(124, 58, 237, 0.8);
      outline-offset: 3px;
      transition: outline-color 0.4s ease;
    }
  `;
  document.head.appendChild(style);
}

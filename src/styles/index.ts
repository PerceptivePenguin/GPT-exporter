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
      const bottom = 80 + index * 56;
      return `
      #${id} {
        position: fixed;
        right: 20px;
        bottom: ${bottom}px;
        z-index: 9999;
        padding: 11px 14px;
        min-width: 112px;
        height: 44px;
        text-align: center;
        border-radius: 12px;
        border: 2px solid #212121;
        background: #fff;
        color: #212121;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 0 #212121;
        transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
      }
      #${id}:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 0 #212121;
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
      padding: 12px 16px;
      min-width: 112px;
      height: 44px;
      text-align: center;
      border-radius: 12px;
      border: 2px solid #212121;
      background: #ffd900;
      color: #212121;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 0 #212121;
      transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
    }
    #${buttonId}:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 0 #212121;
    }
    #${buttonId}:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    #${overlayId} {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(33, 33, 33, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(3px);
    }
    #${overlayId} .gpt-exporter-modal {
      width: min(560px, calc(100% - 32px));
      max-height: 85vh;
      background: #fefae8;
      color: #212121;
      border-radius: 18px;
      border: 2px solid #212121;
      box-shadow: 0 10px 0 #212121;
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
      color: #3b3b3b;
      font-size: 14px;
    }
    .gpt-exporter-qa-list {
      flex: 1;
      overflow: auto;
      border: 2px solid #212121;
      border-radius: 14px;
      padding: 8px;
      background: #fffdf5;
    }
    .gpt-exporter-qa-item {
      display: flex;
      gap: 12px;
      padding: 10px;
      border-radius: 12px;
      cursor: pointer;
      background: #ffffff;
      border: 2px solid #212121;
      box-shadow: 0 4px 0 #212121;
      transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
    }
    .gpt-exporter-qa-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 0 #212121;
      background: #fff6d6;
    }
    .gpt-exporter-qa-item input[type="checkbox"] {
      margin-top: 4px;
    }
    .gpt-exporter-qa-summary {
      font-weight: 600;
      font-size: 14px;
      color: #212121;
    }
    .gpt-exporter-qa-meta {
      font-size: 12px;
      color: #3b3b3b;
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
      border: 2px solid #212121;
      background: #fff;
      color: #212121;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 0 #212121;
      transition: transform 0.12s ease, background 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
    }
    .gpt-exporter-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 0 #212121;
      background: #fff6d6;
    }
    .gpt-exporter-btn.primary {
      background: #ffd900;
      border-color: #212121;
      color: #212121;
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
      background: #fefae8;
      color: #212121;
      border-radius: 16px;
      border: 2px solid #212121;
      box-shadow: 0 10px 0 #212121;
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
      border-bottom: 2px solid #212121;
      font-weight: 700;
      font-size: 14px;
    }
    #${navPanelId} .gpt-exporter-nav-close {
      background: #ffd900;
      border: 2px solid #212121;
      color: #212121;
      font-size: 14px;
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      box-shadow: 0 3px 0 #212121;
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
      border: 2px solid #212121;
      background: #fff;
      color: #212121;
      padding: 10px 12px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 4px 0 #212121;
      transition: background 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
    }
    #${navPanelId} .gpt-exporter-nav-item:hover {
      background: #fff6d6;
      transform: translateY(-2px);
      box-shadow: 0 6px 0 #212121;
    }
    #${navPanelId} .gpt-exporter-nav-index {
      min-width: 20px;
      height: 20px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffd900;
      color: #212121;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid #212121;
    }
    #${navPanelId} .gpt-exporter-nav-summary {
      flex: 1;
      font-size: 13px;
      line-height: 1.4;
      color: #212121 !important;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${navPanelId} .gpt-exporter-nav-empty {
      padding: 14px;
      color: #3b3b3b;
      font-size: 13px;
      text-align: center;
    }
    ` : ''}
    .${highlightClass} {
      outline: 3px solid #ffd900;
      outline-offset: 3px;
      transition: outline-color 0.4s ease;
    }
  `;
  document.head.appendChild(style);
}

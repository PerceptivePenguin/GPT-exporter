export function injectUIStyles(
  styleId: string,
  buttonId: string,
  overlayId: string,
) {
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
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
  `;
  document.head.appendChild(style);
}

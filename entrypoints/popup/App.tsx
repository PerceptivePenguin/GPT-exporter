import { useEffect, useMemo, useState } from 'react';
import type { ProviderRegistry } from '../../src/types/provider';
import {
  loadProviderRegistry,
  setActiveProvider,
  updateProviderConfig,
} from '../../src/config/provider-registry';
import {
  DEFAULT_SUMMARY_PROMPT,
  loadSummaryPromptTemplate,
  saveSummaryPromptTemplate,
} from '../../src/config/summary-prompt';
import './App.css';

type FormState = {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
};

type ActivePanel = 'providers' | 'prompt';

export default function App() {
  const [registry, setRegistry] = useState<ProviderRegistry | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('providers');
  const [formState, setFormState] = useState<FormState>({
    baseUrl: '',
    apiKey: '',
    defaultModel: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeSaving, setActiveSaving] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!registry?.providers.length) return;
    const provider =
      registry.providers.find((item) => item.id === selectedProviderId) ||
      registry.providers.find(
        (item) => item.id === registry.activeProviderId,
      );
    if (!provider) return;
    setSelectedProviderId(provider.id);
    setFormState({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      defaultModel: provider.defaultModel,
    });
  }, [registry, selectedProviderId]);

  const providerList = useMemo(
    () => registry?.providers ?? [],
    [registry?.providers],
  );

  async function bootstrap() {
    const [loadedRegistry, template] = await Promise.all([
      loadProviderRegistry(),
      loadSummaryPromptTemplate(),
    ]);
    setRegistry(loadedRegistry);
    setSelectedProviderId(loadedRegistry.activeProviderId);
    setPromptTemplate(template);
  }

  const currentProvider = providerList.find(
    (item) => item.id === selectedProviderId,
  );

  function updateForm(field: keyof FormState, value: string) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveProvider() {
    if (!currentProvider) return;
    setSaving(true);
    try {
      const updated = await updateProviderConfig(currentProvider.id, formState);
      setRegistry(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(providerId: string) {
    setActiveSaving(true);
    try {
      await setActiveProvider(providerId);
      const refreshed = await loadProviderRegistry();
      setRegistry(refreshed);
    } finally {
      setActiveSaving(false);
    }
  }

  async function handlePromptSave() {
    setPromptSaving(true);
    try {
      await saveSummaryPromptTemplate(promptTemplate);
    } finally {
      setPromptSaving(false);
    }
  }

  async function handlePromptReset() {
    setPromptTemplate(DEFAULT_SUMMARY_PROMPT);
    await saveSummaryPromptTemplate(DEFAULT_SUMMARY_PROMPT);
  }

  return (
    <div className="settings-popup">
      <div className="settings-header">
        <h1>GPT Exporter Settings</h1>
        <div className="panel-switch" role="tablist" aria-label="Settings tabs">
          <button
            type="button"
            className={activePanel === 'providers' ? 'active' : ''}
            onClick={() => setActivePanel('providers')}
            title="Providers"
            aria-pressed={activePanel === 'providers'}
          >
            <ProvidersIcon />
          </button>
          <button
            type="button"
            className={activePanel === 'prompt' ? 'active' : ''}
            onClick={() => setActivePanel('prompt')}
            title="Summary Prompt"
            aria-pressed={activePanel === 'prompt'}
          >
            <PromptIcon />
          </button>
        </div>
      </div>

      {activePanel === 'providers' && (
        <section className="panel">
          <header>
            <div>
              <h2>Providers</h2>
              <p className="subtitle">
                Configure base URL、API Key、默认模型，并设置当前使用的服务商。
              </p>
            </div>
          </header>
          <div className="provider-layout">
            <div className="provider-list">
              {providerList.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-item ${
                    provider.id === selectedProviderId ? 'active' : ''
                  }`}
                  onClick={() => setSelectedProviderId(provider.id)}
                >
                  <span>{provider.name}</span>
                  {registry?.activeProviderId === provider.id && (
                    <span className="badge">Active</span>
                  )}
                </button>
              ))}
            </div>
            {currentProvider ? (
              <div className="provider-form">
                <label>
                  Base URL
                  <input
                    type="text"
                    value={formState.baseUrl}
                    onChange={(event) =>
                      updateForm('baseUrl', event.target.value)
                    }
                  />
                </label>
                <label>
                  API Key
                  <input
                    type="password"
                    value={formState.apiKey}
                    onChange={(event) =>
                      updateForm('apiKey', event.target.value)
                    }
                  />
                </label>
                <label>
                  Default Model
                  <input
                    type="text"
                    value={formState.defaultModel}
                    onChange={(event) =>
                      updateForm('defaultModel', event.target.value)
                    }
                  />
                </label>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => handleSetActive(currentProvider.id)}
                    disabled={activeSaving}
                  >
                    {activeSaving ? 'Setting...' : 'Set Active'}
                  </button>
                  <button
                    className="primary"
                    onClick={handleSaveProvider}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Provider'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="provider-form empty">请选择左侧服务商</div>
            )}
          </div>
        </section>
      )}

      {activePanel === 'prompt' && (
        <section className="panel">
          <header>
            <div>
              <h2>Summary Prompt</h2>
              <p className="subtitle">
                自定义总结输出结构，可使用{' '}
                <code>{'{{scope}}'}</code> 和{' '}
                <code>{'{{conversation}}'}</code> 变量。
              </p>
            </div>
          </header>
          <textarea
            value={promptTemplate}
            onChange={(event) => setPromptTemplate(event.target.value)}
            rows={10}
          />
          <div className="actions">
            <button className="secondary" onClick={handlePromptReset}>
              Reset Default
            </button>
            <button
              className="primary"
              onClick={handlePromptSave}
              disabled={promptSaving}
            >
              {promptSaving ? 'Saving...' : 'Save Prompt'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function ProvidersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M4 13h5" />
      <path d="M12 16v-8h3a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-3" />
      <path d="M20 8v8" />
      <path d="M9 16v-5.5a2.5 2.5 0 0 0 -5 0v5.5" />
    </svg>
  );
}

function PromptIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
      <path d="M12 21l-3 -3h-3a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v5" />
      <path d="M19.001 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M19.001 15.5v1.5" />
      <path d="M19.001 21v1.5" />
      <path d="M22.032 17.25l-1.299 .75" />
      <path d="M17.27 20l-1.3 .75" />
      <path d="M15.97 17.25l1.3 .75" />
      <path d="M20.733 20l1.3 .75" />
    </svg>
  );
}

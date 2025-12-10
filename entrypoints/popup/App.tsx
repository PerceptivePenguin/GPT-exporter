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

export default function App() {
  const [registry, setRegistry] = useState<ProviderRegistry | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
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
      <h1>GPT Exporter Settings</h1>
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

      <section className="panel">
        <header>
          <div>
            <h2>Summary Prompt</h2>
            <p className="subtitle">
              自定义总结输出结构，可使用{' '}
              <code>{'{{scope}}'}</code> 和 <code>{'{{conversation}}'}</code>{' '}
              变量。
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
    </div>
  );
}

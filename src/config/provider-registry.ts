import type { ProviderConfig, ProviderRegistry } from '../types/provider';

const PROVIDER_STORAGE_KEY = 'gptExporterProviderRegistry';

const DEFAULT_REGISTRY: ProviderRegistry = {
  activeProviderId: 'openai',
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKey: '',
      defaultModel: '',
      protocol: 'openai',
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      defaultModel: '',
      protocol: 'anthropic',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: '',
      defaultModel: '',
      protocol: 'gemini',
    },
    {
      id: 'custom',
      name: 'Custom',
      baseUrl: '',
      apiKey: '',
      defaultModel: '',
      protocol: 'custom',
    },
  ],
};

export async function loadProviderRegistry(): Promise<ProviderRegistry> {
  try {
    const stored =
      (await browser?.storage?.sync?.get(PROVIDER_STORAGE_KEY)) ??
      (await browser?.storage?.local?.get(PROVIDER_STORAGE_KEY));
    const payload = stored?.[PROVIDER_STORAGE_KEY];
    if (payload && payload.providers?.length) {
      return payload as ProviderRegistry;
    }
  } catch (error) {
    console.warn('[GPT Exporter] Failed to load provider registry', error);
  }
  return DEFAULT_REGISTRY;
}

export async function saveProviderRegistry(registry: ProviderRegistry) {
  await browser?.storage?.sync?.set({ [PROVIDER_STORAGE_KEY]: registry });
}

export async function getActiveProvider(): Promise<ProviderConfig | null> {
  const registry = await loadProviderRegistry();
  return (
    registry.providers.find((item) => item.id === registry.activeProviderId) ||
    null
  );
}

export async function setActiveProvider(providerId: string) {
  const registry = await loadProviderRegistry();
  if (registry.providers.some((item) => item.id === providerId)) {
    registry.activeProviderId = providerId;
    await saveProviderRegistry(registry);
  }
}

export async function updateProviderConfig(
  providerId: string,
  updates: Partial<ProviderConfig>,
) {
  const registry = await loadProviderRegistry();
  const index = registry.providers.findIndex((item) => item.id === providerId);
  if (index === -1) return registry;
  registry.providers[index] = {
    ...registry.providers[index],
    ...updates,
  };
  await saveProviderRegistry(registry);
  return registry;
}

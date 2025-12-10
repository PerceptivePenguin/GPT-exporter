export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  protocol: ProviderProtocol;
  customHeaders?: Record<string, string>;
}

export interface ProviderRegistry {
  activeProviderId: string;
  providers: ProviderConfig[];
}

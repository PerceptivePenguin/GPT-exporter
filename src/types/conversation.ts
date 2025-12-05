export type ChatRole = 'assistant' | 'user' | 'system' | 'tool' | 'unknown';

export interface ExportMessage {
  role: ChatRole;
  content: string;
}

export interface QAPair {
  id: string;
  question: ExportMessage;
  answers: ExportMessage[];
  summary: string;
}

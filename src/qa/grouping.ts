import type { ExportMessage, QAPair } from '../types/conversation';

const ERROR_PATTERNS = [
  /something went wrong/i,
  /network error/i,
  /an error occurred/i,
  /bad gateway/i,
  /please try again/i,
  /timed out/i,
];

export function groupMessagesIntoQA(messages: ExportMessage[]): QAPair[] {
  const pairs: QAPair[] = [];
  let currentQuestion: ExportMessage | null = null;
  let currentAnswers: ExportMessage[] = [];
  let counter = 0;

  const flush = () => {
    if (!currentQuestion) return;
    const meaningfulAnswers = currentAnswers.filter((answer) =>
      isMeaningfulAnswer(answer.content),
    );
    const lastAssistant = [...meaningfulAnswers]
      .reverse()
      .find((answer) => answer.role === 'assistant');
    const finalAnswers = lastAssistant
      ? [lastAssistant]
      : meaningfulAnswers.slice(-1);

    if (!finalAnswers.length) {
      currentQuestion = null;
      currentAnswers = [];
      return;
    }
    counter += 1;
    const question = currentQuestion;
    pairs.push({
      id: `qa-${counter}`,
      question,
      answers: finalAnswers,
      summary: summarizeQuestion(question.content),
    });
    currentQuestion = null;
    currentAnswers = [];
  };

  for (const message of messages) {
    if (message.role === 'user') {
      flush();
      currentQuestion = message;
      currentAnswers = [];
      continue;
    }

    if (!currentQuestion) continue;

    if (message.role === 'assistant' || message.role === 'tool') {
      currentAnswers.push(message);
    }
  }

  flush();
  return pairs;
}

export function summarizeQuestion(markdown: string) {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines[0] || '_empty question_';
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

export function isMeaningfulAnswer(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return !ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

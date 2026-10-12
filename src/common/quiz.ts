import { BadRequestException } from '@nestjs/common';

export type StoredQuestion = { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };

/** Questions as the student sees them: never send the answers to the phone. */
export const publicQuestions = (qs: StoredQuestion[]) => qs.map(({ id, prompt, options }) => ({ id, prompt, options }));

export function grade(qs: StoredQuestion[], answers: Record<string, string>) {
  if (!answers || typeof answers !== 'object') throw new BadRequestException('Send your answers.');
  const results = qs.map((q) => ({ questionId: q.id, chosenId: answers[q.id] ?? null, correctId: q.answerId, correct: answers[q.id] === q.answerId }));
  const correct = results.filter((r) => r.correct).length;
  return { correct, total: qs.length, score: qs.length ? correct / qs.length : 0, results };
}

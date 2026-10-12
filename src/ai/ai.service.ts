import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';

export type QuizQuestion = { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };

/**
 * Gemini wrapper. Every method returns null when AI is unavailable (no key, quota, bad output)
 * so callers can fall back to non-AI behaviour instead of failing the user.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  readonly model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';

  private async json<T>(prompt: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const model = this.client.getGenerativeModel({ model: this.model, generationConfig: { responseMimeType: 'application/json', temperature: 0.6 } });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text()) as T;
    } catch (e) {
      this.logger.warn(`Gemini call failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** Five multiple-choice questions on exactly what the tutor says they covered. */
  async lessonQuiz(input: { subject: string; levelLabel: string; grade?: string | null; topics: string[]; notes?: string | null }): Promise<QuizQuestion[] | null> {
    const out = await this.json<{ questions: { prompt: string; options: string[]; answerIndex: number }[] }>(
      `You write short check-up quizzes for Nigerian school children after a private lesson.
Subject: ${input.subject}. Level: ${input.levelLabel}${input.grade ? ` (${input.grade})` : ''}.
Topics the teacher covered today: ${input.topics.join('; ')}.
${input.notes ? `Teacher's notes: ${input.notes}` : ''}
Write exactly 5 multiple-choice questions that test ONLY these topics, at this level, using Nigerian context where natural (naira, local names, places).
Each question has 4 short options and exactly one correct answer. No trick questions.
Return JSON: {"questions":[{"prompt":"...","options":["a","b","c","d"],"answerIndex":0}]}`,
    );
    const qs = out?.questions;
    if (!Array.isArray(qs) || qs.length < 3) return null;
    const valid = qs.filter((q) => typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4);
    if (valid.length < 3) return null;
    return valid.slice(0, 5).map((q, i) => ({
      id: `q${i + 1}`,
      prompt: q.prompt,
      options: q.options.map((label, j) => ({ id: 'abcd'[j], label: String(label) })),
      answerId: 'abcd'[q.answerIndex],
    }));
  }

  /** Parent-facing summary of a week. `facts` is the only information the model may use. */
  async weeklySummary(facts: unknown): Promise<{ headline: string; summary: string; homeTip: string } | null> {
    const out = await this.json<{ headline: string; summary: string; homeTip: string }>(
      `You write a warm, honest weekly progress note to a Nigerian parent about their child.
Use ONLY these facts (JSON). Never invent scores, subjects or events that are not in the facts.
Refer to the child by their first name or "they". Never guess the child's gender or use he/she/him/her.
${JSON.stringify(facts)}
Return JSON with:
- "headline": one sentence, max 22 words, plain English, name the child, mention the biggest win and (if any) the subject needing help.
- "summary": 2–3 short sentences for the parent.
- "homeTip": one practical 10-minute activity the parent can do at home this week for the weakest area, using everyday Nigerian life (market, cooking, transport). Max 40 words.`,
    );
    if (!out || typeof out.headline !== 'string' || typeof out.homeTip !== 'string') return null;
    return { headline: out.headline.trim(), summary: String(out.summary ?? '').trim(), homeTip: out.homeTip.trim() };
  }
}

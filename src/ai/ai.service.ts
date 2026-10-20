import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import type { AiFeature, Curriculum, EducationLevel } from '@prisma/client';

import { LEVEL_LABEL } from '../catalog/catalog.js';
import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type QuizQuestion = { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };

/** Who an AI call is for. `schoolId` picks the school's AI profile and is what the cost is charged to. */
export type AiContext = { schoolId?: string | null; userId?: string | null };
export type CallContext = AiContext & { feature: AiFeature; subject?: string; level?: EducationLevel; grade?: string | null };

export const CURRICULUM_LABEL: Record<Curriculum, string> = {
  NIGERIAN: 'Nigerian national curriculum (NERDC / UBE)',
  BRITISH: 'British curriculum (UK National Curriculum, IGCSE)',
  AMERICAN: 'American curriculum (Common Core)',
  MONTESSORI: 'Montessori approach',
  IB: 'International Baccalaureate (PYP / MYP)',
  BLENDED: 'blended Nigerian and British curriculum',
};
const TERM_LABEL = { FIRST: 'First term', SECOND: 'Second term', THIRD: 'Third term' } as const;

/**
 * What AI costs. Prices are US dollars per million tokens; set them to your model's price
 * (ai.google.dev/pricing). The naira rate only affects how costs and budgets are shown.
 */
export const aiPricing = () => ({
  inputPerM: Number(process.env.AI_PRICE_INPUT_PER_M || 0.3),
  outputPerM: Number(process.env.AI_PRICE_OUTPUT_PER_M || 2.5),
  ngnPerUsd: Number(process.env.AI_NGN_PER_USD || 1550),
  /** Hard ceiling on all AI spend in a Lagos calendar month, in dollars. Unset or 0 = no ceiling. */
  monthlyBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 0),
});
/** Millionths of a dollar → kobo, at the configured rate. */
export const microUsdToKobo = (micro: number) => BigInt(Math.round((micro * aiPricing().ngnPerUsd) / 10_000));

/** Start of the current Lagos calendar month, as a real instant. */
export function lagosMonthStart(date = new Date()) {
  const day = lagosDay(date);
  return lagosMidnightInstant(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)));
}

/**
 * Gemini wrapper. Every method returns null when AI is unavailable (no key, quota, bad output,
 * switched off or over budget for the school) so callers fall back to non-AI behaviour.
 * Every call that reaches Gemini is recorded in AiUsage with its token count and cost.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
  readonly model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
  readonly configured = !!this.client;

  constructor(private readonly prisma: PrismaService) {}

  /** Why AI won't run for this school right now, or null if it will. */
  async blockedReason(schoolId?: string | null): Promise<string | null> {
    if (!this.client) return 'No GEMINI_API_KEY is set on the server.';
    const { monthlyBudgetUsd } = aiPricing();
    if (monthlyBudgetUsd > 0) {
      const spent = await this.prisma.aiUsage.aggregate({ where: { createdAt: { gte: lagosMonthStart() } }, _sum: { costMicroUsd: true } });
      if ((spent._sum.costMicroUsd ?? 0) >= monthlyBudgetUsd * 1_000_000) return 'BrainBox has used its AI budget for the month (AI_MONTHLY_BUDGET_USD).';
    }
    if (!schoolId) return null;
    const profile = await this.prisma.schoolAiProfile.findUnique({ where: { schoolId } });
    if (!profile) return null;
    if (!profile.aiEnabled) return 'AI is switched off for this school.';
    if (profile.monthlyBudgetKobo !== null) {
      const spent = await this.prisma.aiUsage.aggregate({ where: { schoolId, createdAt: { gte: lagosMonthStart() } }, _sum: { costMicroUsd: true } });
      if (microUsdToKobo(spent._sum.costMicroUsd ?? 0) >= profile.monthlyBudgetKobo) return 'This school has used its AI budget for the month.';
    }
    return null;
  }

  /** The school's curriculum, rules and scheme of work, written as prompt instructions. Empty when the school has none. */
  async schoolGuidance(ctx: { schoolId?: string | null; subject?: string; level?: EducationLevel; grade?: string | null }): Promise<string> {
    if (!ctx.schoolId) return '';
    const [profile, topics] = await Promise.all([
      this.prisma.schoolAiProfile.findUnique({ where: { schoolId: ctx.schoolId } }),
      ctx.subject && ctx.level
        ? this.prisma.curriculumTopic.findMany({
            where: { schoolId: ctx.schoolId, subject: { equals: ctx.subject, mode: 'insensitive' }, level: ctx.level, ...(ctx.grade ? { OR: [{ gradeName: null }, { gradeName: ctx.grade }] } : {}) },
            orderBy: [{ term: 'asc' }, { week: 'asc' }, { createdAt: 'asc' }],
            take: 60,
          })
        : Promise.resolve([]),
    ]);
    const lines: string[] = [];
    if (profile) lines.push(`This school follows the ${CURRICULUM_LABEL[profile.curriculum]}. Match its terminology, standards and question style.`);
    if (profile?.instructions?.trim()) lines.push(`The school's own rules (follow them unless they break a rule below):\n${profile.instructions.trim()}`);
    if (topics.length) {
      const where = `${ctx.subject}, ${ctx.grade ?? LEVEL_LABEL[ctx.level!]}`;
      const list = topics.map((t) => `- ${TERM_LABEL[t.term]}${t.week ? `, week ${t.week}` : ''}: ${t.topic}${t.objectives ? ` (${t.objectives})` : ''}`).join('\n');
      lines.push(`The school's scheme of work for ${where}:\n${list}\nKeep to these topics and this order where they fit the request.`);
    }
    return lines.length ? `SCHOOL CONTEXT\n${lines.join('\n\n')}\n\nTASK\n` : '';
  }

  /** One JSON-mode call. Returns null on any failure; every call that reaches Gemini is recorded. */
  async json<T>(prompt: string, ctx: CallContext, { temperature = 0.6 }: { temperature?: number } = {}): Promise<T | null> {
    if (!this.client) return null;
    const blocked = await this.blockedReason(ctx.schoolId);
    if (blocked) {
      this.logger.log(`AI skipped for school ${ctx.schoolId}: ${blocked}`);
      return null;
    }
    const guidance = await this.schoolGuidance(ctx);
    const model = this.client.getGenerativeModel({ model: this.model, generationConfig: { responseMimeType: 'application/json', temperature } });
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      let usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
      try {
        const result = await model.generateContent(guidance + prompt);
        usage = result.response.usageMetadata as typeof usage;
        const parsed = JSON.parse(result.response.text()) as T;
        await this.record(ctx, usage, Date.now() - started, null);
        return parsed;
      } catch (e) {
        const message = (e as Error).message;
        // Rate limited: wait as long as Google asks (a minute at most), then try again.
        const wait = /429/.test(message) ? Number(message.match(/retry in ([\d.]+)s/i)?.[1] ?? 30) : null;
        if (wait !== null && attempt < 4) {
          this.logger.log(`Gemini rate limit; retrying in ${Math.ceil(wait)}s`);
          await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000 + 500));
          continue;
        }
        this.logger.warn(`Gemini call failed: ${message.slice(0, 300)}`);
        await this.record(ctx, usage, Date.now() - started, message);
        return null;
      }
    }
  }

  private async record(ctx: CallContext, usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined, latencyMs: number, error: string | null) {
    const inputTokens = usage?.promptTokenCount ?? 0;
    // Thinking tokens are billed as output.
    const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
    const { inputPerM, outputPerM } = aiPricing();
    try {
      await this.prisma.aiUsage.create({
        data: {
          feature: ctx.feature,
          model: this.model,
          schoolId: ctx.schoolId ?? null,
          userId: ctx.userId ?? null,
          inputTokens,
          outputTokens,
          costMicroUsd: Math.round(inputTokens * inputPerM + outputTokens * outputPerM),
          ok: !error,
          latencyMs,
          error: error?.slice(0, 500) ?? null,
        },
      });
    } catch (e) {
      this.logger.warn(`Could not record AI usage: ${(e as Error).message}`);
    }
  }

  private toQuestions(qs: { prompt: string; options: string[]; answerIndex: number }[] | undefined, min: number, max: number): QuizQuestion[] | null {
    if (!Array.isArray(qs)) return null;
    const valid = qs.filter((q) => typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4);
    if (valid.length < min) return null;
    return valid.slice(0, max).map((q, i) => ({
      id: `q${i + 1}`,
      prompt: q.prompt,
      options: q.options.map((label, j) => ({ id: 'abcd'[j], label: String(label) })),
      answerId: 'abcd'[q.answerIndex],
    }));
  }

  /** Five multiple-choice questions on exactly what the tutor says they covered. */
  async lessonQuiz(input: { subject: string; level: EducationLevel; grade?: string | null; topics: string[]; notes?: string | null }, ctx: AiContext = {}): Promise<QuizQuestion[] | null> {
    const out = await this.json<{ questions: { prompt: string; options: string[]; answerIndex: number }[] }>(
      `You write short check-up quizzes for Nigerian school children after a private lesson.
Subject: ${input.subject}. Level: ${LEVEL_LABEL[input.level]}${input.grade ? ` (${input.grade})` : ''}.
Topics the teacher covered today: ${input.topics.join('; ')}.
${input.notes ? `Teacher's notes: ${input.notes}` : ''}
Write exactly 5 multiple-choice questions that test ONLY these topics, at this level, using Nigerian context where natural (naira, local names, places).
Each question has 4 short options and exactly one correct answer. No trick questions.
Return JSON: {"questions":[{"prompt":"...","options":["a","b","c","d"],"answerIndex":0}]}`,
      { ...ctx, feature: 'LESSON_QUIZ', subject: input.subject, level: input.level, grade: input.grade },
    );
    return this.toQuestions(out?.questions, 3, 5);
  }

  /** A student quest drafted for Overwatch to review before it is published. */
  async draftActivity(input: { subject: string; level: EducationLevel; grade?: string | null; topic: string; count: number }, ctx: AiContext = {}): Promise<{ title: string; questions: QuizQuestion[] } | null> {
    const out = await this.json<{ title: string; questions: { prompt: string; options: string[]; answerIndex: number }[] }>(
      `You write practice quests for a learning app used by Nigerian school children.
Subject: ${input.subject}. Level: ${LEVEL_LABEL[input.level]}${input.grade ? ` (${input.grade})` : ''}. Topic: ${input.topic}.
Write exactly ${input.count} multiple-choice questions on this topic, at this level, from easy to harder, using Nigerian context where natural (naira, local names, places, food).
Each question has 4 short options and exactly one correct answer. Double-check every answer. No trick questions.
Also give the quest a short, friendly title (max 6 words).
Return JSON: {"title":"...","questions":[{"prompt":"...","options":["a","b","c","d"],"answerIndex":0}]}`,
      { ...ctx, feature: 'ACTIVITY_DRAFT', subject: input.subject, level: input.level, grade: input.grade },
    );
    const questions = this.toQuestions(out?.questions, Math.min(3, input.count), input.count);
    if (!questions) return null;
    return { title: typeof out?.title === 'string' && out.title.trim() ? out.title.trim() : input.topic, questions };
  }

  /** Parent-facing summary of a week. `facts` is the only information the model may use. */
  async weeklySummary(facts: unknown, ctx: AiContext = {}): Promise<{ headline: string; summary: string; homeTip: string } | null> {
    const out = await this.json<{ headline: string; summary: string; homeTip: string }>(
      `You write a warm, honest weekly progress note to a Nigerian parent about their child.
Use ONLY these facts (JSON). Never invent scores, subjects or events that are not in the facts.
Refer to the child by their first name or "they". Never guess the child's gender or use he/she/him/her.
${JSON.stringify(facts)}
Return JSON with:
- "headline": one sentence, max 22 words, plain English, name the child, mention the biggest win and (if any) the subject needing help.
- "summary": 2–3 short sentences for the parent.
- "homeTip": one practical 10-minute activity the parent can do at home this week for the weakest area, using everyday Nigerian life (market, cooking, transport). Max 40 words.`,
      { ...ctx, feature: 'WEEKLY_REPORT' },
    );
    if (!out || typeof out.headline !== 'string' || typeof out.homeTip !== 'string') return null;
    return { headline: out.headline.trim(), summary: String(out.summary ?? '').trim(), homeTip: out.homeTip.trim() };
  }
}

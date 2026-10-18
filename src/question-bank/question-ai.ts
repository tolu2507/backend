import type { AiService } from '../ai/ai.service.js';

export type TopicTree = { name: string; subtopics: string[] }[];
export type PastForAi = { id: string; stem: string; options: { label: string; text: string }[] | null; answer: string | null };
export type QuestionTag = { id: string; topic: string; subtopic: string | null; difficulty: number; type: string; broken: string | null };

export const QUESTION_TYPES = ['recall', 'concept', 'calculation', 'application', 'comprehension', 'vocabulary', 'grammar', 'oral-english', 'data-or-graph', 'diagram'] as const;

const asText = (q: PastForAi) =>
  `[${q.id}] ${q.stem}${q.options ? `\n${q.options.map((o) => `${o.label}. ${o.text}`).join('\n')}` : ''}${q.answer ? `\nAnswer: ${q.answer}` : ''}`;

/** AI steps for the question bank. Each returns null when AI is unavailable or the output is unusable. */
export class QuestionAi {
  constructor(private readonly ai: AiService) {}

  /** The exam's syllabus as topics → subtopics, checked against real past questions so every question fits somewhere. */
  async proposeTopics(input: { exam: string; subject: string; samples: PastForAi[] }): Promise<TopicTree | null> {
    const out = await this.ai.json<{ topics: TopicTree }>(
      `You are an expert on Nigerian public examinations.
List the syllabus for ${input.exam} ${input.subject} as the exam body sets it: 6–20 topics, each with 2–8 subtopics, in the official syllabus order.
Use the exam body's own topic names where you know them. Keep names short (max 6 words). No numbering.
Make sure every one of these real past questions fits one topic and subtopic:
${input.samples.map(asText).join('\n\n')}
Return JSON: {"topics":[{"name":"...","subtopics":["...","..."]}]}`,
      { feature: 'QUESTION_TAGGING', subject: input.subject },
      { temperature: 0.2 },
    );
    const topics = out?.topics?.filter((t) => typeof t?.name === 'string' && Array.isArray(t.subtopics));
    return topics?.length ? topics.map((t) => ({ name: t.name.trim(), subtopics: t.subtopics.filter((x) => typeof x === 'string').map((x) => x.trim()) })) : null;
  }

  /** Topic, difficulty and type for a batch of past questions; flags ones the source broke. */
  async tag(input: { exam: string; subject: string; topics: TopicTree; questions: PastForAi[] }): Promise<QuestionTag[] | null> {
    const tree = input.topics.map((t) => `- ${t.name}: ${t.subtopics.join('; ')}`).join('\n');
    const out = await this.ai.json<{ tags: QuestionTag[] }>(
      `You label real ${input.exam} ${input.subject} past questions for analysis.
Syllabus (topic: subtopics):
${tree}

For EVERY question below return:
- "id": as given in [brackets]
- "topic": exactly one topic name from the syllabus
- "subtopic": exactly one of that topic's subtopics, or null if none fits
- "difficulty": 1 = pure recall, 2 = one simple step, 3 = typical exam question, 4 = several steps or a common trap, 5 = among the hardest this exam asks
- "type": one of ${QUESTION_TYPES.join(', ')}
- "broken": null, or a few words if the question can't be used as an example: text or symbols missing, it needs a passage or diagram that isn't included, or the marked answer is wrong

Questions:
${input.questions.map(asText).join('\n\n')}

Return JSON: {"tags":[{"id":"...","topic":"...","subtopic":"...","difficulty":3,"type":"...","broken":null}]}`,
      { feature: 'QUESTION_TAGGING', subject: input.subject },
      { temperature: 0.1 },
    );
    if (!Array.isArray(out?.tags)) return null;
    const names = new Map(input.topics.map((t) => [t.name.toLowerCase(), t]));
    return out.tags.flatMap((t) => {
      const topic = typeof t?.topic === 'string' ? names.get(t.topic.trim().toLowerCase()) : undefined;
      if (!topic || typeof t.id !== 'string') return [];
      const subtopic = typeof t.subtopic === 'string' ? (topic.subtopics.find((s) => s.toLowerCase() === t.subtopic!.trim().toLowerCase()) ?? null) : null;
      const difficulty = Math.min(5, Math.max(1, Math.round(Number(t.difficulty) || 3)));
      const type = (QUESTION_TYPES as readonly string[]).includes(t.type) ? t.type : 'concept';
      return [{ id: t.id, topic: topic.name, subtopic, difficulty, type, broken: typeof t.broken === 'string' && t.broken.trim() ? t.broken.trim().slice(0, 120) : null }];
    });
  }
}

export type WrittenQuestion = { stem: string; options: string[]; answerIndex: number; explanation: string };

const LETTERS = 'ABCDE';

/** Writing and checking our own questions. */
export class QuestionWriter {
  constructor(private readonly ai: AiService) {}

  /** New questions on one topic, in the exam's style. `examples` are real past questions to copy the style of, never the content. */
  async write(input: {
    exam: string;
    subject: string;
    level: string;
    topic: string;
    subtopic: string | null;
    difficulty: number;
    count: number;
    optionCount: number;
    examples: PastForAi[];
    avoid: string[];
  }): Promise<WrittenQuestion[] | null> {
    const out = await this.ai.json<{ questions: WrittenQuestion[] }>(
      `You write ORIGINAL practice questions for Nigerian students preparing for ${input.exam} ${input.subject} (${input.level}).
Topic: ${input.topic}${input.subtopic ? ` › ${input.subtopic}` : ''}.
Difficulty ${input.difficulty} of 5 (1 = pure recall, 3 = typical exam question, 5 = among the hardest this exam asks).

Real past questions on this topic, to show the exam's style, length and level. Do NOT copy them, reword them or reuse their numbers, names or sentences:
${input.examples.map(asText).join('\n\n') || '(none available: follow the official syllabus)'}

${input.avoid.length ? `Our bank already has these; write different ones:\n${input.avoid.map((s) => `- ${s}`).join('\n')}\n` : ''}
Write exactly ${input.count} multiple-choice questions:
- each tests ${input.topic}${input.subtopic ? ` (${input.subtopic})` : ''} at difficulty ${input.difficulty}, the way ${input.exam} would
- exactly ${input.optionCount} options, one correct; wrong options are mistakes students really make
- Nigerian context where it fits (naira, local names, places, food); no trick wording
- maths and symbols in LaTeX between $ signs, e.g. $\\frac{3}{4}$, $x^2$, $H_2O$
- no question needs a diagram, graph or passage that isn't written out in the question
- "explanation": 1–4 short lines a student can follow, ending with the correct answer
- double-check every answer before you give it

Return JSON: {"questions":[{"stem":"...","options":[${Array.from({ length: input.optionCount }, () => '"..."').join(',')}],"answerIndex":0,"explanation":"..."}]}`,
      { feature: 'QUESTION_WRITING', subject: input.subject },
      { temperature: 0.8 },
    );
    if (!Array.isArray(out?.questions)) return null;
    return out.questions.filter(
      (q) =>
        typeof q?.stem === 'string' &&
        q.stem.trim().length > 8 &&
        Array.isArray(q.options) &&
        q.options.length === input.optionCount &&
        q.options.every((o) => typeof o === 'string' && o.trim()) &&
        new Set(q.options.map((o) => o.trim().toLowerCase())).size === input.optionCount &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < input.optionCount &&
        typeof q.explanation === 'string',
    );
  }

  /** Solves questions without being told the answers. Returns each chosen option index, or null where unsure. */
  async solve(input: { exam: string; subject: string; questions: { id: string; stem: string; options: string[] }[] }): Promise<Map<string, number | null> | null> {
    const out = await this.ai.json<{ answers: { id: string; answer: string; sure: boolean }[] }>(
      `You are a careful ${input.exam} ${input.subject} examiner. Work out each question yourself, step by step in your head, then give the letter of the correct option.
If a question is ambiguous, has no correct option or more than one, set "sure" to false.

${input.questions.map((q) => `[${q.id}] ${q.stem}\n${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n')}`).join('\n\n')}

Return JSON: {"answers":[{"id":"...","answer":"A","sure":true}]}`,
      { feature: 'QUESTION_CHECK', subject: input.subject },
      { temperature: 0 },
    );
    if (!Array.isArray(out?.answers)) return null;
    const result = new Map<string, number | null>();
    for (const a of out.answers) {
      if (typeof a?.id !== 'string') continue;
      const i = LETTERS.indexOf(String(a.answer).trim().toUpperCase());
      result.set(a.id, a.sure === false || i < 0 ? null : i);
    }
    return result;
  }
}

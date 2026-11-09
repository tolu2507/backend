/**
 * The shape of a classroom lesson: what the writer (scripts/university/build.ts) asks Gemini for,
 * and what the app's classroom player draws. Keep in step with mobile/src/features/uni/types.ts.
 */

export const BRAIN_REGIONS = [
  'frontal-lobe', 'parietal-lobe', 'temporal-lobe', 'occipital-lobe', 'cerebellum', 'brainstem',
  'hippocampus', 'amygdala', 'hypothalamus', 'thalamus', 'corpus-callosum', 'prefrontal-cortex', 'whole-brain',
] as const;
export const NEURON_PARTS = ['dendrites', 'cell-body', 'axon', 'myelin', 'terminals', 'synapse', 'whole'] as const;
/** Icon names the app has (Ionicons). */
export const ICONS = [
  'person', 'people', 'child', 'school', 'book', 'bulb', 'eye', 'ear', 'chatbubbles', 'heart', 'sad', 'happy', 'flash', 'time',
  'globe', 'flag', 'shield', 'scale', 'cash', 'home', 'medkit', 'pulse', 'fitness', 'search', 'warning', 'checkmark-circle',
  'close-circle', 'git-network', 'layers', 'repeat', 'trending-up', 'trending-down', 'megaphone', 'briefcase', 'hand-left', 'leaf',
] as const;

export type Visual =
  | { type: 'flow'; nodes: string[] }
  | { type: 'cycle'; nodes: string[] }
  | { type: 'pyramid'; levels: string[] }
  | { type: 'venn'; left: string; right: string; both: string }
  | { type: 'scale'; left: string; right: string; heavier: 'left' | 'right' | 'even' }
  | { type: 'stat'; value: string; label: string }
  | { type: 'brain'; region: (typeof BRAIN_REGIONS)[number]; label: string }
  | { type: 'neuron'; part: (typeof NEURON_PARTS)[number]; label: string }
  | { type: 'spectrum'; left: string; right: string; marker: number; label: string }
  | { type: 'icons'; items: { icon: (typeof ICONS)[number]; label: string }[] };

export type Slide =
  | { kind: 'teach'; heading: string; body: string; visual?: Visual }
  | { kind: 'example'; heading: string; story: string; takeaway: string }
  | { kind: 'check'; question: string; options: string[]; answerIndex: number; why: string }
  | { kind: 'compare'; heading: string; left: { title: string; points: string[] }; right: { title: string; points: string[] } }
  | { kind: 'steps'; heading: string; steps: { title: string; detail: string }[] }
  | { kind: 'terms'; heading: string; terms: { term: string; meaning: string }[] }
  | { kind: 'lecturer'; heading: string; body: string; sampleQuestion: string; howToAnswer: string; scholars: string[] }
  | { kind: 'recap'; points: string[] };

export type Lesson = { title: string; minutes: number; hook: string; slides: Slide[] };

/** The JSON contract, written out for the prompt. */
export const LESSON_SCHEMA = `{
  "title": "short lesson title, max 8 words",
  "minutes": 6-12,
  "hook": "the teacher's opening line: one or two sentences that make the student curious (a question, a surprising fact or an everyday Nigerian moment)",
  "slides": [ 10 to 16 slides, any of these kinds:
    {"kind":"teach","heading":"...","body":"40-110 words of plain, warm explanation. Markdown **bold** for key terms. Short paragraphs.","visual": optional, one of the VISUALS below},
    {"kind":"example","heading":"...","story":"a short real-life scene, preferably Nigerian (names like Chiamaka, Tunde, Musa; places like Ibadan, Lagos, a danfo, the market, a hostel), 40-90 words","takeaway":"one sentence linking it back to the idea"},
    {"kind":"check","question":"a quick question on what was just taught","options":["4 options"],"answerIndex":0,"why":"one or two sentences explaining the right answer"},
    {"kind":"compare","heading":"X vs Y","left":{"title":"X","points":["2-4 short points"]},"right":{"title":"Y","points":["2-4 short points"]}},
    {"kind":"steps","heading":"...","steps":[{"title":"short","detail":"one sentence"}] (3-6 steps, for stages, processes or a sequence in time)},
    {"kind":"terms","heading":"Key terms","terms":[{"term":"...","meaning":"one plain sentence"}] (3-6 terms)},
    {"kind":"lecturer","heading":"How your lecturer will ask this","body":"how this idea is examined in Nigerian universities and the trap students fall into, 30-80 words","sampleQuestion":"one exam-style question (objective or short essay) twisted the way lecturers set it","howToAnswer":"how to approach it, 1-3 sentences","scholars":["names and years worth quoting in an exam answer, e.g. Atkinson & Shiffrin (1968); [] if none"]},
    {"kind":"recap","points":["3-6 one-line points"]}
  ]
}
VISUALS (pick the one that genuinely helps; most teach slides should have one):
  {"type":"flow","nodes":["2-6 short labels, in order"]}
  {"type":"cycle","nodes":["3-6 short labels that loop"]}
  {"type":"pyramid","levels":["3-5 labels, top first"]}
  {"type":"venn","left":"...","right":"...","both":"what they share"}
  {"type":"scale","left":"...","right":"...","heavier":"left" | "right" | "even"}
  {"type":"stat","value":"a number or short figure, e.g. 7 ± 2","label":"what it means"}
  {"type":"brain","region":one of ${BRAIN_REGIONS.map((r) => `"${r}"`).join(', ')},"label":"..."}
  {"type":"neuron","part":one of ${NEURON_PARTS.map((r) => `"${r}"`).join(', ')},"label":"..."}
  {"type":"spectrum","left":"...","right":"...","marker":0-100,"label":"where the idea sits"}
  {"type":"icons","items":[{"icon":one of ${ICONS.map((r) => `"${r}"`).join(', ')},"label":"..."}] (2-4 items)}
Labels in visuals: max 4 words each.`;

const str = (v: unknown, max = 2000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const strs = (v: unknown, min: number, max: number, len = 300) => {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => str(x, len)).filter((x): x is string => !!x);
  return out.length >= min ? out.slice(0, max) : null;
};

function visual(v: unknown): Visual | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  switch (o.type) {
    case 'flow': { const nodes = strs(o.nodes, 2, 6, 40); return nodes ? { type: 'flow', nodes } : undefined; }
    case 'cycle': { const nodes = strs(o.nodes, 3, 6, 40); return nodes ? { type: 'cycle', nodes } : undefined; }
    case 'pyramid': { const levels = strs(o.levels, 3, 5, 40); return levels ? { type: 'pyramid', levels } : undefined; }
    case 'venn': { const [l, r, b] = [str(o.left, 40), str(o.right, 40), str(o.both, 60)]; return l && r && b ? { type: 'venn', left: l, right: r, both: b } : undefined; }
    case 'scale': {
      const [l, r] = [str(o.left, 40), str(o.right, 40)];
      const heavier = o.heavier === 'left' || o.heavier === 'right' ? o.heavier : 'even';
      return l && r ? { type: 'scale', left: l, right: r, heavier } : undefined;
    }
    case 'stat': { const [value, label] = [str(o.value, 20), str(o.label, 80)]; return value && label ? { type: 'stat', value, label } : undefined; }
    case 'brain': {
      const region = (BRAIN_REGIONS as readonly string[]).includes(o.region as string) ? (o.region as Visual & { type: 'brain' })['region'] : null;
      const label = str(o.label, 60);
      return region && label ? { type: 'brain', region, label } : undefined;
    }
    case 'neuron': {
      const part = (NEURON_PARTS as readonly string[]).includes(o.part as string) ? (o.part as (typeof NEURON_PARTS)[number]) : null;
      const label = str(o.label, 60);
      return part && label ? { type: 'neuron', part, label } : undefined;
    }
    case 'spectrum': {
      const [l, r, label] = [str(o.left, 40), str(o.right, 40), str(o.label, 60)];
      const marker = Math.max(0, Math.min(100, Math.round(Number(o.marker))));
      return l && r && label && Number.isFinite(marker) ? { type: 'spectrum', left: l, right: r, marker, label } : undefined;
    }
    case 'icons': {
      if (!Array.isArray(o.items)) return undefined;
      const items = o.items.flatMap((it) => {
        const i = it as Record<string, unknown>;
        const label = str(i?.label, 40);
        return label && (ICONS as readonly string[]).includes(i.icon as string) ? [{ icon: i.icon as (typeof ICONS)[number], label }] : [];
      });
      return items.length >= 2 ? { type: 'icons', items: items.slice(0, 4) } : undefined;
    }
    default:
      return undefined;
  }
}

function slide(v: unknown): Slide | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  switch (o.kind) {
    case 'teach': {
      const [heading, body] = [str(o.heading, 120), str(o.body, 1200)];
      if (!heading || !body) return null;
      const vis = visual(o.visual);
      return vis ? { kind: 'teach', heading, body, visual: vis } : { kind: 'teach', heading, body };
    }
    case 'example': {
      const [heading, story, takeaway] = [str(o.heading, 120), str(o.story, 900), str(o.takeaway, 300)];
      return heading && story && takeaway ? { kind: 'example', heading, story, takeaway } : null;
    }
    case 'check': {
      const [question, why] = [str(o.question, 500), str(o.why, 500)];
      const options = strs(o.options, 4, 4, 200);
      const answerIndex = Number(o.answerIndex);
      if (!question || !why || !options || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return null;
      if (new Set(options.map((x) => x.toLowerCase())).size !== 4) return null;
      return { kind: 'check', question, options, answerIndex, why };
    }
    case 'compare': {
      const heading = str(o.heading, 120);
      const side = (s: unknown) => {
        const x = s as Record<string, unknown> | null;
        const title = str(x?.title, 60);
        const points = strs(x?.points, 2, 4, 160);
        return title && points ? { title, points } : null;
      };
      const [left, right] = [side(o.left), side(o.right)];
      return heading && left && right ? { kind: 'compare', heading, left, right } : null;
    }
    case 'steps': {
      const heading = str(o.heading, 120);
      if (!heading || !Array.isArray(o.steps)) return null;
      const steps = o.steps.flatMap((s) => {
        const x = s as Record<string, unknown>;
        const [title, detail] = [str(x?.title, 60), str(x?.detail, 240)];
        return title && detail ? [{ title, detail }] : [];
      });
      return steps.length >= 3 ? { kind: 'steps', heading, steps: steps.slice(0, 6) } : null;
    }
    case 'terms': {
      const heading = str(o.heading, 120) ?? 'Key terms';
      if (!Array.isArray(o.terms)) return null;
      const terms = o.terms.flatMap((s) => {
        const x = s as Record<string, unknown>;
        const [term, meaning] = [str(x?.term, 60), str(x?.meaning, 300)];
        return term && meaning ? [{ term, meaning }] : [];
      });
      return terms.length >= 2 ? { kind: 'terms', heading, terms: terms.slice(0, 6) } : null;
    }
    case 'lecturer': {
      const [heading, body, sampleQuestion, howToAnswer] = [str(o.heading, 120) ?? 'How your lecturer will ask this', str(o.body, 800), str(o.sampleQuestion, 600), str(o.howToAnswer, 600)];
      if (!body || !sampleQuestion || !howToAnswer) return null;
      return { kind: 'lecturer', heading, body, sampleQuestion, howToAnswer, scholars: strs(o.scholars, 0, 6, 80) ?? [] };
    }
    case 'recap': {
      const points = strs(o.points, 2, 6, 200);
      return points ? { kind: 'recap', points } : null;
    }
    default:
      return null;
  }
}

/** Cleans what the model returned. Null when too little survives to make a lesson. */
export function parseLesson(v: unknown): { lesson: Lesson; dropped: number } | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const [title, hook] = [str(o.title, 100), str(o.hook, 400)];
  if (!title || !hook || !Array.isArray(o.slides)) return null;
  const slides = o.slides.map(slide).filter((s): s is Slide => !!s);
  if (slides.length < 6 || !slides.some((s) => s.kind === 'check')) return null;
  // The recap always closes the lesson.
  const recaps = slides.filter((s) => s.kind === 'recap');
  const body: Slide[] = slides.filter((s) => s.kind !== 'recap');
  if (recaps.length) body.push(recaps[recaps.length - 1]);
  const minutes = Math.max(4, Math.min(20, Math.round(Number(o.minutes)) || Math.ceil(body.length * 0.7)));
  return { lesson: { title, minutes, hook, slides: body }, dropped: o.slides.length - body.length };
}

/** All the words a student reads in a lesson, for the copied-wording check. */
export function lessonText(l: Lesson): string {
  return [
    l.hook,
    ...l.slides.flatMap((s) => {
      switch (s.kind) {
        case 'teach': return [s.heading, s.body];
        case 'example': return [s.story, s.takeaway];
        case 'check': return [s.question, ...s.options, s.why];
        case 'compare': return [...s.left.points, ...s.right.points];
        case 'steps': return s.steps.map((x) => x.detail);
        case 'terms': return s.terms.map((x) => x.meaning);
        case 'lecturer': return [s.body, s.sampleQuestion, s.howToAnswer];
        case 'recap': return s.points;
      }
    }),
  ].join('\n');
}

const RUN = 10;
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/** Runs of 10+ words that appear word for word in the manual: we teach in our own words, never copy. */
export function copiedRuns(ours: string, source: string): string[] {
  const src = tokens(source);
  const seen = new Set<string>();
  for (let i = 0; i + RUN <= src.length; i++) seen.add(src.slice(i, i + RUN).join(' '));
  const mine = tokens(ours);
  const hits: string[] = [];
  for (let i = 0; i + RUN <= mine.length; i++) {
    const run = mine.slice(i, i + RUN).join(' ');
    if (seen.has(run)) {
      hits.push(run);
      i += RUN - 1;
    }
  }
  return hits;
}

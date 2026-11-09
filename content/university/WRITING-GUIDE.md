# Writing BrainBox university classes

Each study session of a course manual becomes one **unit file**: `content/university/<course>/unit-NN.json`
(e.g. `psy-316/unit-03.json`). The manual text for each session is in
`data/university/sessions/<course>/unit-NN.txt` (made by `pnpm uni:build --export`; not committed).

Check a file with `pnpm uni:import --check content/university/<course>/unit-NN.json`, then load all with
`pnpm uni:import`. Everything loads as *waiting review*; Overwatch → University approves it.

A finished example: `psy-316/unit-01.json`. Match its depth and tone.

## Who we teach

300 Level students at a Nigerian university (University of Ibadan standard). Smart, busy, often reading on
a phone with slow data. Teach so a struggling student finally gets it, and a first-class student still
learns something. The manual is the syllabus: **cover everything in the session that could be examined**,
then go beyond it with accurate, well-established knowledge from the field (classic studies, real cases).

## The copyright rule

The manuals are copyrighted. Read them to understand; **never copy their sentences**. Never reproduce
10 or more words in a row from the manual (the checker rejects it). Explain freshly, with your own examples.
Never invent studies, statistics or quotes; if unsure of a detail, leave it out.

## The unit file

```json
{
  "unit": 3,
  "title": "Short Term Memory",
  "summary": "One sentence on what this unit is about, for the course page (max 25 words).",
  "sections": [
    { "name": "Short section name, max 6 words", "lesson": { ... }, "questions": [ ... ] }
  ]
}
```

- `unit` and `title`: the study session's number and title (fix obvious typos in the title).
- **Sections**: 2–4 per session, in teaching order; long sessions (over ~25,000 characters) get more, about
  one per 6,000 characters, up to 10. Each section = one 6–12 minute class.

## The lesson

```json
{ "title": "max 8 words", "minutes": 8, "hook": "the teacher's opening line", "slides": [ ... ] }
```

`hook`: one or two sentences that make them curious: a question, a surprising fact or an everyday Nigerian moment.

10–16 slides. Every lesson has at least **2 `check` slides spread through it** (not all at the end), at least
**1 `example`**, **1 `lecturer`**, and **ends with a `recap`**. Most `teach` slides get a `visual`.

Slide kinds (exact field names):

| kind | fields |
|---|---|
| `teach` | `heading`, `body` (40–110 words, plain warm explanation, `**bold**` for key terms, short paragraphs), optional `visual` |
| `example` | `heading`, `story` (40–90 words, a real-life scene, preferably Nigerian: Chiamaka, Tunde, Musa, Ibadan, a danfo, the market, a hostel), `takeaway` (one sentence linking back) |
| `check` | `question`, `options` (exactly 4), `answerIndex` (0–3), `why` (1–2 sentences) |
| `compare` | `heading`, `left` `{title, points[2–4]}`, `right` `{title, points[2–4]}` |
| `steps` | `heading`, `steps` (3–6 of `{title, detail}`), for stages, processes, sequences |
| `terms` | `heading`, `terms` (3–6 of `{term, meaning}`) |
| `lecturer` | `heading` ("How your lecturer will ask this"), `body` (how it's examined and the trap students fall into, 30–80 words), `sampleQuestion` (objective or short essay, twisted the way lecturers set it), `howToAnswer` (1–3 sentences), `scholars` (names + years worth quoting, e.g. `"Atkinson & Shiffrin (1968)"`; `[]` if none) |
| `recap` | `points` (3–6 one-liners) |

Visuals (labels max 4 words each):

- `{"type":"flow","nodes":[2–6 labels in order]}`
- `{"type":"cycle","nodes":[3–6 labels that loop]}`
- `{"type":"pyramid","levels":[3–5 labels, top first]}`
- `{"type":"venn","left":"…","right":"…","both":"what they share"}`
- `{"type":"scale","left":"…","right":"…","heavier":"left"|"right"|"even"}`
- `{"type":"stat","value":"7 ± 2","label":"what it means"}` (value max 20 characters)
- `{"type":"brain","region":R,"label":"…"}`, R one of: frontal-lobe, parietal-lobe, temporal-lobe, occipital-lobe, cerebellum, brainstem, hippocampus, amygdala, hypothalamus, thalamus, corpus-callosum, prefrontal-cortex, whole-brain
- `{"type":"neuron","part":P,"label":"…"}`, P one of: dendrites, cell-body, axon, myelin, terminals, synapse, whole
- `{"type":"spectrum","left":"…","right":"…","marker":0–100,"label":"where the idea sits"}`
- `{"type":"icons","items":[2–4 of {"icon":I,"label":"…"}]}`, I one of: person, people, child, school, book, bulb, eye, ear, chatbubbles, heart, sad, happy, flash, time, globe, flag, shield, scale, cash, home, medkit, pulse, fitness, search, warning, checkmark-circle, close-circle, git-network, layers, repeat, trending-up, trending-down, megaphone, briefcase, hand-left, leaf

Style: plain British English. Explain WHY, not just WHAT. Start from what they know. No filler
("In this lesson we will…"). Never guess anyone's gender in examples beyond the name you chose.

## The questions (15 per section, 3 at each difficulty 1–5)

```json
{ "difficulty": 3, "stem": "…", "options": ["…","…","…","…"], "answerIndex": 1, "explanation": "…" }
```

Nigerian lecturers rarely ask bare "define X". They twist it. Write the way they really set papers:

- scenarios: "Chidi can recall a phone number long enough to dial it but forgets it a minute later. This best illustrates…"
- negatives and exceptions: "All of the following are true of X EXCEPT", "Which of these is NOT…"
- attribution: "The view that … is most closely associated with"
- matching and combinations: "Which pair is correctly matched?", "I, II and III… A. I and II only…"
- near-miss options: wrong options that are real terms from the course that students confuse
- "A researcher who found … would most likely conclude that…", "The major weakness of … is"

Difficulty: 1 = core idea, still not a bare definition; 2 = understanding; 3 = applying to a scenario;
4 = fine distinctions and traps; 5 = the hardest a strict lecturer would set (combinations, two concepts, subtle exceptions).

Rules: exactly 4 options, one correct; no "all/none of the above"; options of similar length; spread the
correct answers across A–D; no question needs a diagram. `explanation`: 1–3 sentences that teach why the
answer is right AND why the tempting wrong option is wrong. **Double-check every answer.** Keep questions
within what the section taught (or well-established knowledge it builds on).

import { itemSet, type Item, type Template } from '../engine.js';

/**
 * Comprehension and cloze passages, written by BrainBox (not taken from any past paper). Each question
 * shows its passage, so a question still makes sense on its own in practice or a mock.
 */

const COMP = 'Comprehension and Summary';

const read = (p: { title: string; text: string }, q: string) => `Read the passage and answer the question.\n\n“${p.title}”\n${p.text}\n\n${q}`;
const comprehension = (key: string, difficulty: Template['difficulty'], passages: { title: string; text: string; questions: (Omit<Item, 'stem'> & { q: string })[] }[]) =>
  itemSet(
    key,
    [COMP, 'Comprehension passages'],
    difficulty,
    passages.flatMap((p) => p.questions.map(({ q, ...rest }) => ({ stem: read(p, q), ...rest }))),
  );

/** Cloze: the passage with numbered gaps; each item asks for one gap. */
type Gap = { answer: string; wrong: string[]; why: string };
const cloze = (key: string, difficulty: Template['difficulty'], passages: { text: string; gaps: Gap[] }[]) =>
  itemSet(
    key,
    [COMP, 'Cloze passages'],
    difficulty,
    passages.flatMap((p) =>
      p.gaps.map((g, i) => ({
        stem: `In the passage below, each numbered gap stands for a missing word. Choose the word that best fills gap ${i + 1}.\n\n${p.text}`,
        answer: g.answer,
        wrong: g.wrong,
        explanation: g.why,
      })),
    ),
  );

const SENIOR: { title: string; text: string; questions: (Omit<Item, 'stem'> & { q: string })[] }[] = [
  {
    title: 'The Market Woman’s Phone',
    text: 'For twenty years, Mama Bisi sold tomatoes at the Mile 12 market in Lagos, keeping her accounts in a battered exercise book. When her daughter showed her how to receive payments on a mobile phone, she was suspicious. “Money you cannot touch is not money,” she said. But within a month she noticed that she no longer lost change to customers who claimed they had no smaller notes, and that her book no longer had pages smudged by rain. Today she buys her stock from farmers in Kano without travelling, and the farmers are paid before the lorry leaves. She still keeps the exercise book, though, “in case the phone forgets.”',
    questions: [
      { q: 'Why was Mama Bisi suspicious of mobile payments at first?', answer: 'She did not trust money she could not hold.', wrong: ['She could not read the phone screen.', 'Her customers refused to use phones.', 'The farmers in Kano did not have phones.'], explanation: 'She said, “Money you cannot touch is not money.”' },
      { q: 'Which benefit of mobile payments did Mama Bisi notice within a month?', answer: 'She stopped losing change to customers.', wrong: ['She sold more tomatoes than before.', 'She travelled to Kano more often.', 'She threw away her exercise book.'], explanation: 'The passage says she “no longer lost change to customers who claimed they had no smaller notes”.' },
      { q: 'The phrase “in case the phone forgets” suggests that Mama Bisi', answer: 'still does not fully trust the phone', wrong: ['has lost her phone before', 'cannot remember her accounts', 'wants to stop using the phone'], explanation: 'Keeping the old book as a back-up shows a lingering lack of trust.' },
      { q: 'The word “battered”, as used in the passage, means', answer: 'worn and damaged from long use', wrong: ['new and clean', 'expensive', 'hidden'], explanation: 'A battered book is old and damaged from being used a lot.' },
      { q: 'What is the main idea of the passage?', answer: 'A trader slowly comes to see the benefits of new technology.', wrong: ['Markets in Lagos are too crowded.', 'Farmers in Kano are paid too late.', 'Exercise books are better than phones.'], explanation: 'The passage traces Mama Bisi’s change from suspicion to using mobile payments every day.' },
    ],
  },
  {
    title: 'Saving the Rain',
    text: 'In many northern villages, the dry season stretches for more than six months, and women walk for hours to fetch water. A young engineer from Kaduna, Halima Musa, noticed that the same villages lost thousands of litres of rain every wet season as it ran off tin roofs and into dusty gullies. With a few gutters, pipes and large plastic tanks, her team began to store the rain that fell on schools and clinics. The tanks are not a cure for every problem; they must be cleaned, and they run dry in very long droughts. Yet in the villages that use them, girls who once missed school to fetch water now sit in class, and the clinics no longer turn away mothers for lack of clean water.',
    questions: [
      { q: 'What problem did Halima Musa notice?', answer: 'Rainwater was being wasted in the wet season.', wrong: ['Tin roofs were leaking.', 'Schools had too many pupils.', 'Engineers were not trained in Kaduna.'], explanation: 'She saw that villages “lost thousands of litres of rain” that ran off roofs.' },
      { q: 'According to the passage, a weakness of the tanks is that they', answer: 'can run dry in a very long drought', wrong: ['cost too much to buy', 'make the water dirty', 'are too heavy for roofs'], explanation: 'The passage says they “run dry in very long droughts” and must be cleaned.' },
      { q: 'How has the project helped girls in the villages?', answer: 'They now attend school instead of fetching water.', wrong: ['They now work as engineers.', 'They clean the tanks after school.', 'They walk farther to fetch water.'], explanation: 'Girls “who once missed school to fetch water now sit in class”.' },
      { q: 'The writer’s attitude to the project is best described as', answer: 'positive but realistic', wrong: ['completely critical', 'uninterested', 'angry'], explanation: 'The writer praises the results but admits the tanks are “not a cure for every problem”.' },
      { q: 'The word “gullies”, as used in the passage, refers to', answer: 'channels worn into the ground by running water', wrong: ['large water tanks', 'narrow village roads', 'dry riverbeds full of sand'], explanation: 'Rain runs off the roofs and into the gullies, the channels it has cut in the soil.' },
    ],
  },
  {
    title: 'The Footballer Who Read',
    text: 'When Chidi joined the academy at fifteen, the coaches praised his speed and his left foot, but they also noticed that he was always the last to leave the classroom where the players did their schoolwork. His teammates laughed at him for carrying novels on the bus. Years later, when an injury ended his playing career at twenty-three, many of those teammates had nothing to fall back on. Chidi, who had quietly finished his secondary school certificate and a diploma in sports management, became the club’s youngest scout. “The ball can leave you any day,” he now tells the boys he discovers. “What you put in your head stays.”',
    questions: [
      { q: 'Why did Chidi’s teammates laugh at him?', answer: 'He carried novels on the team bus.', wrong: ['He was slower than they were.', 'He used only his left foot.', 'He left the academy early.'], explanation: 'The passage says, “His teammates laughed at him for carrying novels on the bus.”' },
      { q: 'What happened to Chidi’s playing career?', answer: 'An injury ended it when he was twenty-three.', wrong: ['He left football to become a teacher.', 'He was dropped for being too slow.', 'He retired at fifteen.'], explanation: 'An injury ended his playing career at twenty-three.' },
      { q: '“The ball can leave you any day” means that', answer: 'a football career can end suddenly', wrong: ['players often lose the ball', 'football is not a serious sport', 'coaches drop players without reason'], explanation: 'Chidi is warning that careers in sport can end at any time, as his did.' },
      { q: 'The lesson of the passage is that', answer: 'education gives security beyond a sporting career', wrong: ['footballers should not read novels', 'injuries are always the coach’s fault', 'scouts earn more than players'], explanation: 'Chidi’s studies gave him a new career when football ended.' },
    ],
  },
];

const JUNIOR: { title: string; text: string; questions: (Omit<Item, 'stem'> & { q: string })[] }[] = [
  {
    title: 'The Lost Goat',
    text: 'On Saturday morning, Tunde’s goat, Baba, broke its rope and ran away. Tunde searched behind the house, near the stream and at the market, but Baba was nowhere to be found. Tired and sad, he sat under the mango tree. Then he heard a loud “Meeeh!” from the roof of the kitchen. Baba had climbed onto a pile of firewood and jumped up there. Everyone laughed, and Tunde’s father fixed a stronger rope that same afternoon.',
    questions: [
      { q: 'What was the name of Tunde’s goat?', answer: 'Baba', wrong: ['Tunde', 'Meeeh', 'Mango'], explanation: 'The passage says “Tunde’s goat, Baba”.' },
      { q: 'Where did Tunde finally find the goat?', answer: 'on the roof of the kitchen', wrong: ['near the stream', 'at the market', 'under the mango tree'], explanation: 'Baba had jumped onto the kitchen roof.' },
      { q: 'How did the goat get onto the roof?', answer: 'It climbed a pile of firewood and jumped up.', wrong: ['Tunde carried it up.', 'It climbed the mango tree.', 'It used a ladder.'], explanation: '“Baba had climbed onto a pile of firewood and jumped up there.”' },
      { q: 'What did Tunde’s father do that afternoon?', answer: 'He fixed a stronger rope.', wrong: ['He sold the goat.', 'He built a new kitchen.', 'He cut down the mango tree.'], explanation: 'His father “fixed a stronger rope that same afternoon”.' },
    ],
  },
  {
    title: 'Ada’s Garden',
    text: 'Ada wanted to grow vegetables at school. Her teacher gave her a small piece of land behind the classroom. Every morning before lessons, Ada watered her spinach and pulled out the weeds. When the dry season came, she covered the soil with dry grass to keep it from losing water. After eight weeks, the spinach was tall and green. Ada gave some to the school cook, and that day every pupil had vegetable soup with lunch.',
    questions: [
      { q: 'Where was Ada’s garden?', answer: 'behind the classroom', wrong: ['at her house', 'beside the market', 'near the stream'], explanation: 'Her teacher gave her land “behind the classroom”.' },
      { q: 'Why did Ada cover the soil with dry grass?', answer: 'to stop the soil losing water', wrong: ['to kill the weeds', 'to make the soil warm', 'to hide the spinach'], explanation: 'She covered it “to keep it from losing water”.' },
      { q: 'How long did the spinach take to grow tall?', answer: 'eight weeks', wrong: ['eight days', 'two weeks', 'one year'], explanation: '“After eight weeks, the spinach was tall and green.”' },
      { q: 'Which word best describes Ada?', answer: 'hardworking', wrong: ['lazy', 'selfish', 'careless'], explanation: 'She watered and weeded every morning and shared her harvest.' },
    ],
  },
];

const SENIOR_CLOZE = [
  {
    text: 'Road accidents are a major (1) ___ of death among young people in Nigeria. Many of them could be (2) ___ if drivers obeyed speed limits and passengers wore seat belts. The Federal Road Safety Corps carries out campaigns to (3) ___ the public, but laws alone cannot (4) ___ the problem. Each road user must take (5) ___ for his or her own safety.',
    gaps: [
      { answer: 'cause', wrong: ['reason', 'source', 'result'], why: '“A major cause of death” is the usual expression.' },
      { answer: 'prevented', wrong: ['provoked', 'presented', 'pretended'], why: 'Accidents “could be prevented”: stopped from happening.' },
      { answer: 'educate', wrong: ['punish', 'confuse', 'entertain'], why: 'Campaigns aim to educate the public about road safety.' },
      { answer: 'solve', wrong: ['create', 'enjoy', 'increase'], why: 'Laws alone cannot solve the problem.' },
      { answer: 'responsibility', wrong: ['permission', 'possession', 'advantage'], why: '“Take responsibility for” one’s own safety.' },
    ],
  },
  {
    text: 'The internet has changed the way students learn. A pupil in a small town can now (1) ___ lessons from teachers in other countries. However, not everything online is (2) ___. Students must learn to check whether a source can be (3) ___ before they believe it. Spending too many hours online can also (4) ___ sleep and schoolwork.',
    gaps: [
      { answer: 'watch', wrong: ['wash', 'want', 'waste'], why: 'Pupils can “watch lessons” online.' },
      { answer: 'true', wrong: ['fast', 'cheap', 'free'], why: 'The next sentence is about checking sources, so the point is that not everything online is true.' },
      { answer: 'trusted', wrong: ['tasted', 'twisted', 'treated'], why: 'Students check whether a source “can be trusted”.' },
      { answer: 'harm', wrong: ['help', 'hear', 'hire'], why: 'Too many hours online can harm sleep and schoolwork.' },
    ],
  },
];

const JUNIOR_CLOZE = [
  {
    text: 'Every Monday, the pupils of our school gather in the hall for (1) ___. We sing the national anthem and say the (2) ___. The head teacher then tells us the news of the week. After that, we (3) ___ quietly to our classrooms.',
    gaps: [
      { answer: 'assembly', wrong: ['breakfast', 'football', 'holiday'], why: 'Pupils gather in the hall for assembly.' },
      { answer: 'pledge', wrong: ['plate', 'price', 'place'], why: 'At assembly pupils say the national pledge.' },
      { answer: 'walk', wrong: ['shout', 'sleep', 'cook'], why: 'Pupils walk quietly to their classrooms.' },
    ],
  },
  {
    text: 'My mother wakes up very (1) ___ every day. She prepares breakfast before the sun (2) ___. Then she takes my little brother to school (3) ___ going to her shop in the market.',
    gaps: [
      { answer: 'early', wrong: ['late', 'slowly', 'loudly'], why: 'She prepares breakfast before sunrise, so she wakes up early.' },
      { answer: 'rises', wrong: ['sets', 'sleeps', 'falls'], why: 'Breakfast is ready before the sun rises.' },
      { answer: 'before', wrong: ['under', 'between', 'without'], why: 'She takes him to school before going to her shop.' },
    ],
  },
];

export const seniorPassages: Template[] = [comprehension('english/comprehension', 3, SENIOR), cloze('english/cloze', 3, SENIOR_CLOZE)];
export const juniorPassages: Template[] = [comprehension('english/comprehension-junior', 1, JUNIOR), cloze('english/cloze-junior', 1, JUNIOR_CLOZE)];

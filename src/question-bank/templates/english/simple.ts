import type { Template } from '../engine.js';

/** Primary-6 vocabulary for Common Entrance: everyday words, one clear meaning each. */

const LEX = 'Lexis and Structure';

const SAME: [sentence: string, answer: string, wrong: string[]][] = [
  ['The boy was *glad* to see his mother.', 'happy', ['sad', 'afraid', 'tired']],
  ['The *tiny* ant carried a grain of rice.', 'very small', ['very big', 'very lazy', 'very slow']],
  ['She *began* her homework after lunch.', 'started', ['finished', 'forgot', 'hated']],
  ['The elephant is a *huge* animal.', 'very big', ['very small', 'very fast', 'very quiet']],
  ['The old man was *weary* after the journey.', 'tired', ['angry', 'hungry', 'rich']],
  ['Please *shut* the window.', 'close', ['open', 'clean', 'break']],
  ['The teacher was *pleased* with our work.', 'satisfied', ['angry', 'surprised', 'bored']],
  ['The thief *vanished* into the crowd.', 'disappeared', ['shouted', 'fell', 'stopped']],
  ['Ngozi is a *clever* girl.', 'intelligent', ['lazy', 'rude', 'tall']],
  ['We had a *quick* meal before school.', 'fast', ['slow', 'big', 'cold']],
  ['The baby is *asleep* in the room.', 'sleeping', ['crying', 'playing', 'eating']],
  ['The house was *silent* at night.', 'quiet', ['noisy', 'bright', 'empty']],
  ['Emeka was *frightened* by the thunder.', 'scared', ['excited', 'hurt', 'woken']],
  ['The market was *crowded* on Saturday.', 'full of people', ['empty', 'closed', 'clean']],
];

const OPPOSITE: [sentence: string, answer: string, wrong: string[]][] = [
  ['The water in the pot is *hot*.', 'cold', ['warm', 'boiling', 'dirty']],
  ['Musa is a *strong* boy.', 'weak', ['tall', 'kind', 'brave']],
  ['The shop *opens* at eight.', 'closes', ['starts', 'sells', 'waits']],
  ['Our classroom is *clean*.', 'dirty', ['tidy', 'small', 'bright']],
  ['The bag is *heavy*.', 'light', ['full', 'big', 'new']],
  ['Ada came *early* to school.', 'late', ['quickly', 'happily', 'first']],
  ['The story has a *happy* ending.', 'sad', ['funny', 'long', 'good']],
  ['The farmer is *rich*.', 'poor', ['kind', 'old', 'busy']],
  ['Please *remember* your books.', 'forget', ['carry', 'read', 'open']],
  ['The river is *deep*.', 'shallow', ['wide', 'long', 'dirty']],
  ['He *won* the race.', 'lost', ['ran', 'started', 'enjoyed']],
  ['The soldier was *brave*.', 'cowardly', ['strong', 'tall', 'proud']],
  ['She *bought* a new dress.', 'sold', ['wore', 'washed', 'made']],
  ['The tortoise is *slow*.', 'fast', ['lazy', 'old', 'clever']],
];

const ask = (kind: 'same' | 'opposite', list: [string, string, string[]][]): Template['make'] => (r) => {
  const [sentence, answer, wrong] = r.pick(list);
  const word = sentence.match(/\*(.+?)\*/)![1];
  return {
    stem: `Choose the word ${kind === 'same' ? 'nearest in meaning to' : 'opposite in meaning to'} the word in italics.\n${sentence}`,
    answer,
    wrong,
    explanation: kind === 'same' ? `*${word[0].toUpperCase() + word.slice(1)}* means ${answer}.` : `The opposite of *${word}* is *${answer}*.`,
  };
};

export const simpleEnglish: Template[] = [
  { key: 'english/simple-synonyms', topic: [LEX, 'Synonyms'], difficulty: 1, variety: SAME.length, make: ask('same', SAME) },
  { key: 'english/simple-antonyms', topic: [LEX, 'Antonyms'], difficulty: 1, variety: OPPOSITE.length, make: ask('opposite', OPPOSITE) },
];

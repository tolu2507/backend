import { otherValues, type Rng, type Template } from '../engine.js';

/**
 * English for JAMB, WAEC and NECO: lexis and structure from checked word lists and grammar rules,
 * oral forms from RP sound groups (what WAEC and JAMB examine). Sound questions point at exact
 * letters ("the 'ea' in *heart*"), so no option is ambiguous. Keys get an exam prefix in index.ts.
 */

const LEX = 'Lexis and Structure';
const ORAL = 'Oral Forms';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** [sentence with *word*, nearest meaning, wrong options] */
const SYNONYMS: [string, string, string[]][] = [
  ['The manager was *adamant* that the work must end today.', 'firm', ['unsure', 'angry', 'careless']],
  ['Her *candid* reply surprised the panel.', 'frank', ['rude', 'false', 'brief']],
  ['The soldiers showed great *fortitude* in battle.', 'courage', ['cowardice', 'wisdom', 'speed']],
  ['The new rule is *ambiguous*.', 'unclear', ['strict', 'unfair', 'sensible']],
  ['He gave a *lucid* explanation of the problem.', 'clear', ['long', 'confusing', 'boring']],
  ['The thief cast a *furtive* glance at the door.', 'secret', ['bold', 'angry', 'long']],
  ['Food was *scarce* during the war.', 'hard to find', ['cheap', 'plentiful', 'tasteless']],
  ['The old man is *affluent*.', 'wealthy', ['poor', 'sick', 'kind']],
  ['The meeting has been *postponed*.', 'put off', ['cancelled', 'brought forward', 'held']],
  ['The pupils in that class are *diligent*.', 'hardworking', ['lazy', 'brilliant', 'noisy']],
  ['He is *reticent* about his past.', 'reluctant to talk', ['proud', 'ashamed', 'boastful']],
  ['The *veracity* of his story was doubted.', 'truthfulness', ['length', 'origin', 'humour']],
  ['The crowd was *hostile* to the visitors.', 'unfriendly', ['large', 'excited', 'welcoming']],
  ['She *abhors* lying.', 'hates', ['practises', 'forgives', 'enjoys']],
  ['Climbing the hill was an *arduous* task.', 'difficult', ['simple', 'boring', 'urgent']],
  ['They tried to *placate* the angry customer.', 'calm', ['insult', 'ignore', 'arrest']],
  ['The *frugal* woman saved most of her salary.', 'thrifty', ['wasteful', 'rich', 'careless']],
  ['Those rules are now *obsolete*.', 'outdated', ['strict', 'new', 'unfair']],
  ['The minister *reiterated* his promise.', 'repeated', ['withdrew', 'forgot', 'broke']],
  ['The building was *dilapidated*.', 'falling apart', ['newly painted', 'very tall', 'crowded']],
  ['The girl is *meticulous* in her work.', 'very careful', ['careless', 'slow', 'fast']],
  ['Prices *escalated* last month.', 'rose', ['fell', 'stayed the same', 'were fixed']],
  ['The child is very *inquisitive*.', 'curious', ['stubborn', 'quiet', 'playful']],
  ['The judge remained *impartial*.', 'fair', ['biased', 'silent', 'angry']],
  ['The *incessant* noise kept us awake.', 'continuous', ['loud', 'occasional', 'soft']],
  ['The *novice* driver was nervous.', 'beginner', ['expert', 'careless', 'elderly']],
  ['His *benevolence* is known to all.', 'kindness', ['wealth', 'wickedness', 'wisdom']],
  ['The village was *serene* at dawn.', 'peaceful', ['noisy', 'dirty', 'empty']],
  ['The fans were *jubilant* after the match.', 'overjoyed', ['sad', 'angry', 'worried']],
  ['They *commenced* work at dawn.', 'began', ['ended', 'avoided', 'delayed']],
  ['The doctor gave a *gloomy* report.', 'depressing', ['cheerful', 'detailed', 'short']],
  ['His *hasty* decision cost him his job.', 'hurried', ['careful', 'wise', 'late']],
];

/** [sentence with *word*, opposite, wrong options] */
const ANTONYMS: [string, string, string[]][] = [
  ['He is a *generous* man.', 'mean', ['kind', 'rich', 'humble']],
  ['We visited an *ancient* palace.', 'modern', ['old', 'famous', 'royal']],
  ['She gave a *vague* answer.', 'precise', ['unclear', 'wrong', 'long']],
  ['The soldier was *courageous*.', 'cowardly', ['brave', 'strong', 'careless']],
  ['Water is *abundant* in the rainy season.', 'scarce', ['plentiful', 'clean', 'cheap']],
  ['He *rejected* the offer.', 'accepted', ['refused', 'considered', 'ignored']],
  ["The patient's condition *deteriorated*.", 'improved', ['worsened', 'stayed the same', 'changed']],
  ['The hall is *spacious*.', 'cramped', ['large', 'clean', 'bright']],
  ['She is *optimistic* about the exam.', 'pessimistic', ['hopeful', 'confident', 'nervous']],
  ['He got a *temporary* job.', 'permanent', ['short', 'part-time', 'easy']],
  ['His *humble* manner pleased everyone.', 'arrogant', ['modest', 'simple', 'polite']],
  ['The bottle is made of *transparent* glass.', 'opaque', ['clear', 'thin', 'broken']],
  ['She bought *artificial* flowers.', 'natural', ['fake', 'beautiful', 'plastic']],
  ['He was *present* at the meeting.', 'absent', ['late', 'early', 'active']],
  ["The minister's speech was *brief*.", 'lengthy', ['short', 'clear', 'boring']],
  ['Prices *increased* last year.', 'decreased', ['rose', 'doubled', 'settled']],
  ['The *wealthy* trader gave a donation.', 'poor', ['rich', 'honest', 'popular']],
  ['Attendance is *compulsory*.', 'optional', ['necessary', 'difficult', 'required']],
  ['That was the *major* problem.', 'minor', ['main', 'serious', 'first']],
  ['He *admitted* the offence.', 'denied', ['confessed', 'committed', 'forgot']],
  ['She *seldom* comes late.', 'often', ['rarely', 'never', 'hardly']],
  ['They crossed a *shallow* stream.', 'deep', ['wide', 'clear', 'calm']],
  ['The room had a *dim* light.', 'bright', ['weak', 'faint', 'yellow']],
  ['The task was *simple*.', 'complicated', ['easy', 'short', 'boring']],
  ['The *rough* road damaged the car.', 'smooth', ['bumpy', 'long', 'narrow']],
  ['The teacher *praised* the pupils.', 'criticised', ['commended', 'taught', 'thanked']],
  ['The market was *crowded*.', 'empty', ['busy', 'noisy', 'dirty']],
  ['Her room is always *tidy*.', 'untidy', ['neat', 'clean', 'small']],
];

const IDIOMS: [string, string][] = [
  ['to let the cat out of the bag', 'to reveal a secret'],
  ['to bury the hatchet', 'to make peace after a quarrel'],
  ['to burn the midnight oil', 'to work or study late into the night'],
  ['to beat about the bush', 'to avoid the main point'],
  ['to be in hot water', 'to be in trouble'],
  ['a storm in a teacup', 'a lot of fuss about something unimportant'],
  ['to hit the nail on the head', 'to say exactly the right thing'],
  ['to turn a deaf ear', 'to refuse to listen'],
  ["to pull someone's leg", 'to tease someone'],
  ['a wet blanket', "a person who spoils other people's fun"],
  ["to blow one's own trumpet", 'to boast about oneself'],
  ['once in a blue moon', 'very rarely'],
  ['to take the bull by the horns', 'to face a difficulty boldly'],
  ['to cry over spilt milk', 'to regret what cannot be changed'],
  ['at the eleventh hour', 'at the last moment'],
  ['to get cold feet', 'to become nervous about doing something planned'],
  ['to be on cloud nine', 'to be extremely happy'],
  ['to call a spade a spade', 'to speak plainly and honestly'],
  ['to kill two birds with one stone', 'to achieve two things with one action'],
  ['a white elephant', 'a costly possession that is of little use'],
  ['to throw in the towel', 'to give up'],
  ['to see eye to eye', 'to agree completely'],
  ['the lion’s share', 'the biggest part'],
  ['a red-letter day', 'a very important or happy day'],
  ['to face the music', 'to accept the consequences of one’s actions'],
  ['to break the ice', 'to ease the tension when people first meet'],
];

/** [statement, correct tag, wrong tags] */
const TAGS: [string, string, string[]][] = [
  ['Your brother is coming to the party', "isn't he", ['is he', "doesn't he", "wasn't he"]],
  ['The girls can swim', "can't they", ['can they', "couldn't they", "don't they"]],
  ['She hardly ever comes late', 'does she', ["doesn't she", 'is she', "isn't she"]],
  ["Let's go home now", 'shall we', ['will we', "shan't we", "don't we"]],
  ['I am your friend', "aren't I", ['am not I', "isn't it", "don't I"]],
  ['Nobody came to the meeting', 'did they', ["didn't they", 'did he', 'was it']],
  ['You have finished your homework', "haven't you", ['have you', "didn't you", "don't you"]],
  ['He used to live in Kano', "didn't he", ["wasn't he", "doesn't he", 'did he']],
  ['Everyone was at the wedding', "weren't they", ["wasn't he", "wasn't it", 'were they']],
  ['There is no water in the tank', 'is there', ["isn't there", "isn't it", 'is it']],
  ['They will travel tomorrow', "won't they", ['will they', "don't they", "shan't they"]],
  ['The man never tells lies', 'does he', ["doesn't he", 'is he', 'did he']],
  ['We should leave early', "shouldn't we", ['should we', "mustn't we", "won't we"]],
  ["You didn't see him", 'did you', ["didn't you", 'do you', 'have you']],
  ['Ada and Musa were late', "weren't they", ['were they', "wasn't she", "didn't they"]],
  ['This is your book', "isn't it", ['is it', "isn't this", "wasn't it"]],
  ['Nothing happened', 'did it', ["didn't it", 'did they', 'does it']],
  ['The children seldom play outside', 'do they', ["don't they", 'are they', 'did they']],
  ['Your mother cooked the rice', "didn't she", ['did she', "hasn't she", "wasn't she"]],
  ['You could help me', "couldn't you", ['could you', "can't you", "wouldn't you"]],
  ['It rained yesterday', "didn't it", ['did it', "wasn't it", "doesn't it"]],
  ["He doesn't like rice", 'does he', ["doesn't he", 'is he', 'did he']],
  ['Few people came to the party', 'did they', ["didn't they", 'were they', 'do they']],
  ['The bus has left', "hasn't it", ['has it', "didn't it", "isn't it"]],
];

/** [subject, plural?, base, past, past participle, rest of sentence] */
const VERBS: [string, boolean, string, string, string, string][] = [
  ['the pupils', true, 'go', 'went', 'gone', 'to the farm'],
  ['the teacher', false, 'begin', 'began', 'begun', 'the lesson'],
  ['Ada', false, 'write', 'wrote', 'written', 'a letter to her aunt'],
  ['the boys', true, 'break', 'broke', 'broken', 'the window'],
  ['the coach', false, 'choose', 'chose', 'chosen', 'the team'],
  ['the baby', false, 'drink', 'drank', 'drunk', 'all the milk'],
  ['the fishermen', true, 'swim', 'swam', 'swum', 'across the river'],
  ['the prefect', false, 'ring', 'rang', 'rung', 'the bell'],
  ['the choir', false, 'sing', 'sang', 'sung', 'the national anthem'],
  ['the principal', false, 'speak', 'spoke', 'spoken', 'to the parents'],
  ['the thief', false, 'steal', 'stole', 'stolen', 'the goat'],
  ['Musa', false, 'tear', 'tore', 'torn', 'his shirt'],
  ['the bride', false, 'wear', 'wore', 'worn', 'a white dress'],
  ['the jockey', false, 'ride', 'rode', 'ridden', 'the horse'],
  ['the visitors', true, 'shake', 'shook', 'shaken', 'hands with the chief'],
  ['my father', false, 'take', 'took', 'taken', 'the early bus'],
  ['Emeka', false, 'forget', 'forgot', 'forgotten', 'his keys'],
  ['the children', true, 'hide', 'hid', 'hidden', 'the ball'],
  ['the dog', false, 'bite', 'bit', 'bitten', 'the postman'],
  ['the birds', true, 'fly', 'flew', 'flown', 'away'],
  ['the farmer', false, 'grow', 'grew', 'grown', 'maize'],
  ['the players', true, 'throw', 'threw', 'thrown', 'the ball'],
  ['the artist', false, 'draw', 'drew', 'drawn', 'a map'],
  ['the ship', false, 'sink', 'sank', 'sunk', 'to the bottom'],
  ['the tailor', false, 'sew', 'sewed', 'sewn', 'the dress'],
  ['the girls', true, 'eat', 'ate', 'eaten', 'the rice'],
  ['the boy', false, 'fall', 'fell', 'fallen', 'from the tree'],
];

/** [singular, plural, wrong plurals] */
const PLURALS: [string, string, string[]][] = [
  ['crisis', 'crises', ['crisises', 'crisis', 'crisies']],
  ['criterion', 'criteria', ['criterions', 'criterias', 'criterium']],
  ['phenomenon', 'phenomena', ['phenomenons', 'phenomenas', 'phenomenon']],
  ['analysis', 'analyses', ['analysises', 'analysis', 'analysies']],
  ['ox', 'oxen', ['oxes', 'oxs', 'oxens']],
  ['louse', 'lice', ['louses', 'lices', 'louse']],
  ['mouse', 'mice', ['mouses', 'mices', 'mouse']],
  ['child', 'children', ['childs', 'childrens', 'childes']],
  ['sheep', 'sheep', ['sheeps', 'sheepes', 'sheepies']],
  ['foot', 'feet', ['foots', 'feets', 'footes']],
  ['tooth', 'teeth', ['tooths', 'teeths', 'toothes']],
  ['goose', 'geese', ['gooses', 'geeses', 'goosen']],
  ['bacterium', 'bacteria', ['bacteriums', 'bacterias', 'bacteriae']],
  ['mother-in-law', 'mothers-in-law', ['mother-in-laws', 'mothers-in-laws', 'mother-ins-law']],
  ['passer-by', 'passers-by', ['passer-bys', 'passers-bys', 'passer-byes']],
  ['knife', 'knives', ['knifes', 'knivs', 'knifies']],
  ['thief', 'thieves', ['thiefs', 'thieve', 'thiefes']],
  ['hero', 'heroes', ['heros', 'heroies', 'heroen']],
  ['potato', 'potatoes', ['potatos', 'potatoies', 'potatoe']],
  ['piano', 'pianos', ['pianoes', 'pianies', 'pianii']],
  ['woman', 'women', ['womans', 'womens', 'womanes']],
];

/** [sentence with ___, preposition] */
const PREPOSITIONS: [string, string][] = [
  ['We congratulated her ___ her success.', 'on'],
  ['I prefer rice ___ beans.', 'to'],
  ['This pen is different ___ that one.', 'from'],
  ['He was accused ___ stealing a goat.', 'of'],
  ['Everyone must comply ___ the rules.', 'with'],
  ['She insisted ___ paying the bill.', 'on'],
  ['We must abide ___ the decision.', 'by'],
  ['This cloth is superior ___ that one.', 'to'],
  ['He is conversant ___ the rules of the game.', 'with'],
  ['Let us dispense ___ the formalities.', 'with'],
  ['Ada is interested ___ music.', 'in'],
  ['The boy is capable ___ doing better.', 'of'],
  ['The manager is responsible ___ the loss.', 'for'],
  ['My father was angry ___ me.', 'with'],
  ['The children are fond ___ sweets.', 'of'],
  ['Nigeria became independent ___ Britain in 1960.', 'of'],
  ['Many students depend ___ their parents.', 'on'],
  ['He is averse ___ hard work.', 'to'],
  ['The committee consists ___ five members.', 'of'],
  ['She could not cope ___ the pressure.', 'with'],
  ['The prisoners were deprived ___ food.', 'of'],
  ['The hunter aimed ___ the bird.', 'at'],
  ['He apologised ___ coming late.', 'for'],
  ['We arrived ___ Lagos at noon.', 'in'],
  ['She was absorbed ___ her novel.', 'in'],
  ['He is addicted ___ his phone.', 'to'],
  ['They are jealous ___ her success.', 'of'],
  ['We should refrain ___ making noise.', 'from'],
  ['The principal presided ___ the meeting.', 'over'],
];
const PREP_SET = ['on', 'to', 'from', 'of', 'with', 'by', 'in', 'for', 'at', 'over', 'about', 'into'];

/** [correct spelling, common misspellings] */
const SPELLING: [string, string[]][] = [
  ['accommodate', ['acommodate', 'accomodate', 'acomodate']],
  ['embarrass', ['embarass', 'embarras', 'emberrass']],
  ['occurrence', ['occurence', 'ocurrence', 'occurrance']],
  ['necessary', ['neccessary', 'necesary', 'neccesary']],
  ['privilege', ['priviledge', 'privelege', 'privilage']],
  ['separate', ['seperate', 'separete', 'seperete']],
  ['millennium', ['millenium', 'milennium', 'millenum']],
  ['conscientious', ['conscientous', 'concientious', 'conscienscious']],
  ['committee', ['commitee', 'comittee', 'committe']],
  ['harass', ['harrass', 'haras', 'harras']],
  ['definitely', ['definately', 'definitly', 'defenitely']],
  ['receive', ['recieve', 'receeve', 'receve']],
  ['recommend', ['reccommend', 'recomend', 'reccomend']],
  ['rhythm', ['rythm', 'rhythym', 'rhytm']],
  ['questionnaire', ['questionaire', 'questionnair', 'questionnare']],
  ['entrepreneur', ['enterpreneur', 'entreprenuer', 'entrepeneur']],
  ['maintenance', ['maintainance', 'maintenence', 'maintenanse']],
  ['guarantee', ['guarrantee', 'garantee', 'guarentee']],
  ['parliament', ['parliment', 'parlament', 'parliamant']],
  ['pronunciation', ['pronounciation', 'pronunciasion', 'prononciation']],
  ['occasion', ['occassion', 'ocasion', 'occation']],
  ['achieve', ['acheive', 'achive', 'acheeve']],
  ['government', ['goverment', 'govermment', 'governmant']],
  ['knowledge', ['knowlege', 'knowledgde', 'knoweledge']],
];

/** Vowel sounds (RP): each entry is [word, the letters that make the sound]. */
const VOWELS: Record<string, [string, string][]> = {
  'iː': [['seat', 'ea'], ['key', 'ey'], ['people', 'eo'], ['receive', 'ei'], ['machine', 'i'], ['police', 'i'], ['field', 'ie']],
  'ɪ': [['sit', 'i'], ['women', 'o'], ['busy', 'u'], ['build', 'ui'], ['pretty', 'e']],
  e: [['bed', 'e'], ['said', 'ai'], ['friend', 'ie'], ['bury', 'u'], ['leopard', 'eo'], ['many', 'a'], ['head', 'ea']],
  'æ': [['cat', 'a'], ['plait', 'ai'], ['have', 'a'], ['salmon', 'a']],
  'ɑː': [['car', 'ar'], ['heart', 'ear'], ['laugh', 'au'], ['clerk', 'er'], ['aunt', 'au'], ['calm', 'al'], ['father', 'a']],
  'ɒ': [['pot', 'o'], ['what', 'a'], ['cough', 'ou'], ['knowledge', 'o'], ['sausage', 'au'], ['yacht', 'a'], ['want', 'a']],
  'ɔː': [['law', 'aw'], ['caught', 'au'], ['board', 'oa'], ['door', 'oo'], ['water', 'a'], ['walk', 'a'], ['warm', 'ar']],
  'ʊ': [['put', 'u'], ['book', 'oo'], ['woman', 'o'], ['could', 'ou'], ['wolf', 'o'], ['full', 'u']],
  'uː': [['food', 'oo'], ['shoe', 'oe'], ['blue', 'ue'], ['through', 'ough'], ['fruit', 'ui'], ['move', 'o']],
  'ʌ': [['cup', 'u'], ['love', 'o'], ['blood', 'oo'], ['rough', 'ou'], ['son', 'o'], ['does', 'oe'], ['country', 'ou']],
  'ɜː': [['bird', 'ir'], ['word', 'or'], ['learn', 'ear'], ['journey', 'our'], ['nurse', 'ur'], ['work', 'or']],
  'eɪ': [['day', 'ay'], ['great', 'ea'], ['eight', 'eigh'], ['rain', 'ai'], ['steak', 'ea'], ['they', 'ey']],
  'aɪ': [['buy', 'uy'], ['height', 'eigh'], ['island', 'i'], ['sky', 'y'], ['guide', 'ui']],
  'ɔɪ': [['boy', 'oy'], ['oil', 'oi'], ['coin', 'oi'], ['toy', 'oy']],
  'əʊ': [['go', 'o'], ['sew', 'ew'], ['though', 'ough'], ['soul', 'ou'], ['coat', 'oa'], ['toe', 'oe']],
  'aʊ': [['cow', 'ow'], ['bough', 'ough'], ['drought', 'ough'], ['house', 'ou'], ['now', 'ow']],
};

/** Consonant sounds: [word, the letters that make the sound]. */
const CONSONANTS: Record<string, [string, string][]> = {
  'ʃ': [['machine', 'ch'], ['sugar', 's'], ['nation', 't'], ['ocean', 'c'], ['chef', 'ch'], ['mission', 'ss']],
  'tʃ': [['church', 'ch'], ['catch', 'tch'], ['nature', 't'], ['question', 't'], ['cello', 'c']],
  'dʒ': [['judge', 'j'], ['soldier', 'd'], ['gem', 'g'], ['giant', 'g'], ['bridge', 'dge']],
  'ʒ': [['measure', 's'], ['pleasure', 's'], ['vision', 's'], ['beige', 'g'], ['usual', 's']],
  'θ': [['think', 'th'], ['thought', 'th'], ['bath', 'th'], ['author', 'th'], ['method', 'th']],
  'ð': [['this', 'th'], ['though', 'th'], ['father', 'th'], ['breathe', 'th'], ['weather', 'th']],
  k: [['chemistry', 'ch'], ['choir', 'ch'], ['school', 'ch'], ['character', 'ch'], ['ache', 'ch']],
  f: [['laugh', 'gh'], ['phone', 'ph'], ['rough', 'gh'], ['cough', 'gh'], ['graph', 'ph']],
  z: [['was', 's'], ['busy', 's'], ['xylophone', 'x'], ['scissors', 'ss'], ['rise', 's']],
};

/** Stressed syllable (RP). */
const STRESS: Record<1 | 2 | 3, string[]> = {
  1: ['table', 'water', 'promise', 'capital', 'orange', 'mountain', 'comfortable', 'interest', 'character', 'photograph', 'cinema', 'yesterday', 'government', 'beautiful', 'family', 'quality'],
  2: ['begin', 'police', 'again', 'develop', 'important', 'committee', 'examine', 'potato', 'banana', 'mosquito', 'career', 'hotel', 'photographer', 'agenda', 'tomato', 'ability'],
  3: ['understand', 'entertain', 'recommend', 'afternoon', 'introduce', 'engineer', 'volunteer', 'kangaroo', 'education', 'information', 'Japanese', 'disappear', 'personality', 'opportunity'],
};

const RHYMES: string[][] = [
  ['weight', 'late', 'straight', 'eight', 'great', 'bait'],
  ['blood', 'mud', 'flood', 'bud'],
  ['through', 'shoe', 'blue', 'flew', 'two', 'true'],
  ['laugh', 'staff', 'half', 'calf'],
  ['hair', 'there', 'pear', 'care', 'wear', 'bear'],
  ['cough', 'off', 'scoff', 'trough'],
  ['bough', 'cow', 'now', 'plough', 'how'],
  ['though', 'sew', 'go', 'low', 'toe', 'dough'],
  ['word', 'bird', 'heard', 'third'],
  ['height', 'kite', 'bite', 'white', 'might'],
  ['said', 'bed', 'head', 'red', 'fled'],
  ['love', 'glove', 'above', 'shove'],
];

/** Extra notes for the tags that break the usual pattern. */
const TAG_NOTES: Record<string, [RegExp, string]> = {
  "aren't I": [/^I am/, '"Am I not" is formal; the everyday tag for "I am" is "aren\'t I".'],
  'shall we': [/^Let's/, '"Let\'s" (let us) always takes "shall we".'],
  "didn't he": [/used to/, '"Used to" has no helping verb, so the tag uses "did".'],
  "weren't they": [/^Everyone/, '"Everyone" takes "they" in the tag.'],
  'did they': [/^(Nobody|Few)/, 'This subject takes "they" in the tag.'],
};

const ORDINAL = { 1: 'first', 2: 'second', 3: 'third' } as const;
const at = (w: string, letters: string) => `the '${letters}' in *${w}*`;

/** One entry from the given group and one each from three other groups. */
function sameSound(r: Rng, groups: Record<string, [string, string][]>, kind: 'vowel' | 'consonant') {
  const keys = Object.keys(groups);
  const key = r.pick(keys);
  const [anchor, match] = r.shuffle(groups[key]).slice(0, 2);
  const others = r.shuffle(keys.filter((k) => k !== key)).slice(0, 4).map((k) => r.pick(groups[k]));
  return {
    stem: `Which of these has the same ${kind} sound as ${at(...anchor)}?`,
    answer: at(...match),
    wrong: others.map((o) => at(...o)),
    explanation: `${cap(at(...anchor))} and ${at(...match)} both have the sound /${key}/.\nThe others: ${others
      .slice(0, 3)
      .map((o) => `${at(...o)} is /${keys.find((k) => groups[k].includes(o))}/`)
      .join('; ')}.`,
  };
}

/** Verb agreement: [subject, singular?] */
const SING = ['the teacher', 'the principal', 'my brother', 'the captain', 'his mother'];
const PLUR = ['the pupils', 'his friends', 'the parents', 'the boys', 'the players'];
const FORMS = {
  is: { sing: 'is', plur: 'are', rest: 'in the hall', all: ['is', 'are', 'were', 'be'] },
  was: { sing: 'was', plur: 'were', rest: 'at the meeting yesterday', all: ['was', 'were', 'is', 'being'] },
  has: { sing: 'has', plur: 'have', rest: 'finished the work', all: ['has', 'have', 'having', 'is'] },
};

/** Nouns that look plural but aren't (or the reverse), with a natural ending for each verb form. */
const UNCOUNTABLE: [string, boolean, Record<keyof typeof FORMS, string>][] = [
  ['The news', false, { is: 'good today', was: 'on the radio yesterday', has: 'spread quickly' }],
  ['Mathematics', false, { is: 'my favourite subject', was: 'difficult last term', has: 'always been my best subject' }],
  ['Economics', false, { is: 'a social science', was: 'well taught last year', has: 'become popular' }],
  ['The police', true, { is: 'at the gate', was: 'here yesterday', has: 'arrested the thief' }],
  ['The cattle', true, { is: 'in the field', was: 'grazing yesterday', has: 'drunk all the water' }],
  ['My trousers', true, { is: 'too long', was: 'dirty yesterday', has: 'been washed' }],
];

export const english: Template[] = [
  {
    key: 'english/synonyms',
    topic: [LEX, 'Synonyms'],
    difficulty: 2,
    variety: 30,
    make: (r) => {
      const [sentence, ans, wrong] = r.pick(SYNONYMS);
      const word = sentence.match(/\*(.+?)\*/)![1];
      return {
        stem: `Choose the option nearest in meaning to the word in italics.\n${sentence}`,
        answer: ans,
        wrong,
        explanation: `*${cap(word)}* means ${ans}.`,
      };
    },
  },
  {
    key: 'english/antonyms',
    topic: [LEX, 'Antonyms'],
    difficulty: 2,
    variety: 28,
    make: (r) => {
      const [sentence, ans, wrong] = r.pick(ANTONYMS);
      const word = sentence.match(/\*(.+?)\*/)![1];
      return {
        stem: `Choose the option opposite in meaning to the word in italics.\n${sentence}`,
        answer: ans,
        wrong,
        explanation: `The opposite of *${word}* is *${ans}*.`,
      };
    },
  },
  {
    key: 'english/idioms',
    topic: [LEX, 'Idioms and figurative expressions'],
    difficulty: 2,
    variety: 26,
    make: (r) => {
      const row = r.pick(IDIOMS);
      return {
        stem: `What does the expression *${row[0]}* mean?`,
        answer: row[1],
        wrong: otherValues(r, IDIOMS, row, (x) => x[1]),
        explanation: `*${cap(row[0])}* means ${row[1]}.`,
      };
    },
  },
  {
    key: 'english/concord',
    topic: [LEX, 'Concord'],
    difficulty: 3,
    make: (r) => {
      const form = r.pick(Object.keys(FORMS) as (keyof typeof FORMS)[]);
      const F = FORMS[form];
      const s = r.pick(SING);
      const p = r.pick(PLUR);
      const kind = r.pick(['neither', 'either', 'each', 'together', 'uncountable', 'number', 'everyone'] as const);
      let sentence: string;
      let plural: boolean;
      let why: string;
      switch (kind) {
        case 'neither':
        case 'either': {
          const pluralLast = r.chance(0.5);
          const [a, b] = pluralLast ? [s, p] : [p, s];
          plural = pluralLast;
          sentence = `${kind === 'neither' ? 'Neither' : 'Either'} ${a} ${kind === 'neither' ? 'nor' : 'or'} ${b} ___ ${F.rest}.`;
          why = `With "${kind} … ${kind === 'neither' ? 'nor' : 'or'}", the verb agrees with the nearer subject, "${b}", which is ${plural ? 'plural' : 'singular'}.`;
          break;
        }
        case 'each':
          plural = false;
          sentence = `Each of ${p} ___ ${F.rest}.`;
          why = `The subject is "each", which is singular; "of ${p}" doesn't change that.`;
          break;
        case 'together': {
          const joiner = r.pick(['together with', 'as well as', 'along with']);
          plural = false;
          sentence = `${cap(s)}, ${joiner} ${p}, ___ ${F.rest}.`;
          why = `The subject is "${s}". A phrase with "${joiner}" is extra information and doesn't make the subject plural.`;
          break;
        }
        case 'uncountable': {
          const [noun, pl, rests] = r.pick(UNCOUNTABLE);
          plural = pl;
          sentence = `${noun} ___ ${rests[form]}.`;
          why = pl ? `"${noun.replace(/^(The|My) /, '')}" is always plural, so it takes a plural verb.` : `"${noun.replace(/^The /, '')}" looks plural but is singular, so it takes a singular verb.`;
          break;
        }
        case 'number': {
          const a = r.chance(0.5);
          plural = a;
          sentence = `${a ? 'A' : 'The'} number of ${p.replace(/^the |^his /, '')} ___ ${a ? { is: 'absent today', was: 'absent yesterday', has: 'left early' }[form] : { is: 'growing every year', was: 'small last term', has: 'increased' }[form]}.`;
          why = a ? `"A number of" means "many", so the verb is plural.` : `"The number" is a single figure, so the verb is singular.`;
          break;
        }
        default: {
          const pron = r.pick(['Everyone', 'Everybody', 'Nobody', 'Each one']);
          plural = false;
          sentence = `${pron} ___ ${F.rest}.`;
          why = `"${pron}" is singular, so it takes a singular verb.`;
        }
      }
      const ans = plural ? F.plur : F.sing;
      return {
        stem: `Choose the option that best completes the sentence.\n${sentence}`,
        answer: ans,
        wrong: F.all.filter((x) => x !== ans),
        explanation: `${why} So: "${sentence.replace('___', ans)}"`,
      };
    },
  },
  {
    key: 'english/question-tags',
    topic: [LEX, 'Question tags'],
    difficulty: 3,
    variety: 24,
    make: (r) => {
      const [statement, tag, wrong] = r.pick(TAGS);
      const negative = /n't|never|hardly|seldom|Nobody|Nothing|Few|no /.test(statement);
      return {
        stem: `Choose the correct question tag.\n${statement}, ___?`,
        answer: tag,
        wrong,
        explanation: `${negative ? 'The statement is negative in meaning, so the tag is positive' : 'The statement is positive, so the tag is negative'}, using the same helping verb and a pronoun for the subject.${TAG_NOTES[tag] && statement.match(TAG_NOTES[tag][0]) ? ` ${TAG_NOTES[tag][1]}` : ''}\n"${statement}, ${tag}?"`,
      };
    },
  },
  {
    key: 'english/verb-forms',
    topic: [LEX, 'Tenses and verb forms'],
    difficulty: 2,
    variety: 30,
    make: (r) => {
      const [subj, plural, base, past, pp, rest] = r.pick(VERBS);
      const wrongForms = [base, `${base}ed`.replace(/eed$/, 'ed'), past, pp, `${base}s`];
      if (r.chance(0.5)) {
        const s = `Yesterday, ${subj} ___ ${rest}.`;
        return {
          stem: `Choose the correct form of the verb "${base}".\n${s}`,
          answer: past,
          wrong: wrongForms.filter((w) => w !== past),
          explanation: `"Yesterday" calls for the simple past tense: "${s.replace('___', past)}"`,
        };
      }
      const s = `${cap(subj)} ${plural ? 'have' : 'has'} already ___ ${rest}.`;
      return {
        stem: `Choose the correct form of the verb "${base}".\n${s}`,
        answer: pp,
        wrong: wrongForms.filter((w) => w !== pp),
        explanation: `After "${plural ? 'have' : 'has'}" we use the past participle (${base} – ${past} – ${pp}): "${s.replace('___', pp)}"`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'english/plurals',
    topic: [LEX, 'Nouns and plurals'],
    difficulty: 2,
    variety: 21,
    make: (r) => {
      const [one, many, wrong] = r.pick(PLURALS);
      return {
        stem: `What is the plural of "${one}"?`,
        answer: many,
        wrong,
        explanation: one === many ? `"${cap(one)}" is the same in the singular and the plural.` : `The plural of "${one}" is "${many}".${/-/.test(one) ? ' In compound nouns, the main noun takes the plural.' : ''}`,
      };
    },
  },
  {
    key: 'english/prepositions',
    topic: [LEX, 'Prepositions and phrasal verbs'],
    difficulty: 2,
    variety: 29,
    make: (r) => {
      const [sentence, prep] = r.pick(PREPOSITIONS);
      return {
        stem: `Choose the option that best completes the sentence.\n${sentence}`,
        answer: prep,
        wrong: r.shuffle(PREP_SET.filter((x) => x !== prep)),
        explanation: `The correct expression is: "${sentence.replace('___', prep)}"`,
      };
    },
  },
  {
    key: 'english/spelling',
    topic: [LEX, 'Spelling'],
    difficulty: 2,
    variety: 24,
    make: (r) => {
      const row = r.pick(SPELLING);
      const [word, bad] = row;
      if (r.chance(0.5)) {
        return { stem: 'Which of these words is correctly spelt?', answer: word, wrong: bad, explanation: `The correct spelling is "${word}".` };
      }
      const others = r.shuffle(SPELLING.filter((x) => x !== row)).slice(0, 3);
      return {
        stem: 'Which of these words is correctly spelt?',
        answer: word,
        wrong: others.map(([, b]) => r.pick(b)),
        explanation: `"${cap(word)}" is correct. The others should be ${others.map(([w]) => `"${w}"`).join(', ')}.`,
      };
    },
  },
  {
    key: 'english/vowels',
    topic: [ORAL, 'Vowels'],
    difficulty: 3,
    make: (r) => sameSound(r, VOWELS, 'vowel'),
  },
  {
    key: 'english/consonants',
    topic: [ORAL, 'Consonants'],
    difficulty: 3,
    make: (r) => sameSound(r, CONSONANTS, 'consonant'),
  },
  {
    key: 'english/word-stress',
    topic: [ORAL, 'Word stress'],
    difficulty: 3,
    make: (r) => {
      const n = r.pick([1, 2, 3] as const);
      const ans = r.pick(STRESS[n]);
      const wrong = r.shuffle(([1, 2, 3] as const).filter((k) => k !== n).flatMap((k) => STRESS[k])).slice(0, 3);
      return {
        stem: `Which of these words is stressed on the ${ORDINAL[n]} syllable?`,
        answer: ans,
        wrong,
        explanation: `${cap(ans)} is stressed on the ${ORDINAL[n]} syllable. ${wrong.map((w) => `${cap(w)}: ${ORDINAL[([1, 2, 3] as const).find((k) => STRESS[k].includes(w))!]}`).join('; ')}.`,
      };
    },
  },
  {
    key: 'english/rhymes',
    topic: [ORAL, 'Rhymes'],
    difficulty: 2,
    make: (r) => {
      const set = r.pick(RHYMES);
      const [word, rhyme] = r.shuffle(set).slice(0, 2);
      const others = r.shuffle(RHYMES.filter((x) => x !== set)).slice(0, 4).map((x) => r.pick(x));
      return {
        stem: `Which word rhymes with "${word}"?`,
        answer: rhyme,
        wrong: others,
        explanation: `"${cap(word)}" and "${rhyme}" end with the same sound. Spelling can mislead: words that look alike don't always rhyme.`,
      };
    },
  },
];

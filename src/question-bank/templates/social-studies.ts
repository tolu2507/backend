import { itemSet, otherValues, type Template } from './engine.js';

/** Common Entrance Social Studies: Nigeria's states and capitals, government and national symbols. */

const NIGERIA = 'Nigeria';
const GOV = 'Government';

const STATES: [state: string, capital: string][] = [
  ['Abia', 'Umuahia'],
  ['Adamawa', 'Yola'],
  ['Akwa Ibom', 'Uyo'],
  ['Anambra', 'Awka'],
  ['Bauchi', 'Bauchi'],
  ['Bayelsa', 'Yenagoa'],
  ['Benue', 'Makurdi'],
  ['Borno', 'Maiduguri'],
  ['Cross River', 'Calabar'],
  ['Delta', 'Asaba'],
  ['Ebonyi', 'Abakaliki'],
  ['Edo', 'Benin City'],
  ['Ekiti', 'Ado-Ekiti'],
  ['Enugu', 'Enugu'],
  ['Gombe', 'Gombe'],
  ['Imo', 'Owerri'],
  ['Jigawa', 'Dutse'],
  ['Kaduna', 'Kaduna'],
  ['Kano', 'Kano'],
  ['Katsina', 'Katsina'],
  ['Kebbi', 'Birnin Kebbi'],
  ['Kogi', 'Lokoja'],
  ['Kwara', 'Ilorin'],
  ['Lagos', 'Ikeja'],
  ['Nasarawa', 'Lafia'],
  ['Niger', 'Minna'],
  ['Ogun', 'Abeokuta'],
  ['Ondo', 'Akure'],
  ['Osun', 'Osogbo'],
  ['Oyo', 'Ibadan'],
  ['Plateau', 'Jos'],
  ['Rivers', 'Port Harcourt'],
  ['Sokoto', 'Sokoto'],
  ['Taraba', 'Jalingo'],
  ['Yobe', 'Damaturu'],
  ['Zamfara', 'Gusau'],
];

export const socialStudies: Template[] = [
  {
    key: 'social/states-capitals',
    topic: [NIGERIA, 'States and capitals'],
    difficulty: 1,
    variety: 60,
    make: (r) => {
      const row = r.pick(STATES);
      const [state, capital] = row;
      // Asking "Kano is the capital of which state?" gives the answer away, so only ask it backwards when the names differ.
      if (state !== capital && r.chance(0.4)) {
        return { stem: `${capital} is the capital of which state?`, answer: `${state} State`, wrong: otherValues(r, STATES, row, (x) => `${x[0]} State`), explanation: `${capital} is the capital of ${state} State.` };
      }
      return { stem: `What is the capital of ${state} State?`, answer: capital, wrong: otherValues(r, STATES, row, (x) => x[1]), explanation: `The capital of ${state} State is ${capital}. (Nigeria has 36 states and the Federal Capital Territory, Abuja.)` };
    },
  },
  itemSet('social/arms-of-government', [GOV, 'Arms of government'], 1, [
    { stem: 'Which arm of government makes laws?', answer: 'The legislature', wrong: ['The executive', 'The judiciary', 'The police'], explanation: 'The legislature (in Nigeria, the National Assembly and the State Houses of Assembly) makes laws.' },
    { stem: 'Which arm of government carries out (implements) the laws?', answer: 'The executive', wrong: ['The legislature', 'The judiciary', 'The civil defence'], explanation: 'The executive, led by the President or Governor, carries out the laws.' },
    { stem: 'Which arm of government interprets the laws and settles disputes?', answer: 'The judiciary', wrong: ['The legislature', 'The executive', 'The army'], explanation: 'The judiciary (the courts) interprets the laws and settles disputes.' },
    { stem: 'Who heads the executive arm of the Federal Government of Nigeria?', answer: 'The President', wrong: ['The Chief Justice', 'The Senate President', 'The Speaker'], explanation: 'The President heads the executive arm.' },
    { stem: 'The National Assembly of Nigeria is made up of', answer: 'the Senate and the House of Representatives', wrong: ['the President and the ministers', 'the Supreme Court and the High Courts', 'the governors of the 36 states'], explanation: 'The National Assembly has two houses: the Senate and the House of Representatives.' },
    { stem: 'What is the highest court in Nigeria?', answer: 'The Supreme Court', wrong: ['The Court of Appeal', 'The Federal High Court', 'The Customary Court'], explanation: 'The Supreme Court is the highest court in Nigeria.' },
    { stem: 'Who heads the executive arm of a state government?', answer: 'The Governor', wrong: ['The Speaker', 'The Chief Judge', 'The local government chairman'], explanation: 'The Governor heads the executive arm of a state.' },
  ]),
  itemSet('social/national-symbols', [NIGERIA, 'National symbols'], 1, [
    { stem: 'What does the green colour on the Nigerian flag stand for?', answer: 'Agriculture and the natural wealth of the land', wrong: ['Peace and unity', 'The blood of heroes', 'The rivers Niger and Benue'], explanation: 'Green stands for agriculture and the natural wealth of Nigeria.' },
    { stem: 'What does the white colour on the Nigerian flag stand for?', answer: 'Peace and unity', wrong: ['Agriculture', 'Wealth', 'Strength'], explanation: 'White stands for peace and unity.' },
    { stem: 'Who designed the Nigerian flag?', answer: 'Taiwo Akinkunmi', wrong: ['Herbert Macaulay', 'Nnamdi Azikiwe', 'Obafemi Awolowo'], explanation: 'The flag was designed by Michael Taiwo Akinkunmi in 1959.' },
    { stem: 'On the Nigerian coat of arms, what does the eagle stand for?', answer: 'Strength', wrong: ['Peace', 'Agriculture', 'The rivers'], explanation: 'The red eagle stands for strength.' },
    { stem: 'On the Nigerian coat of arms, what does the white "Y" shape on the black shield stand for?', answer: 'The rivers Niger and Benue', wrong: ['Unity of the people', 'The two arms of government', 'The roads of Nigeria'], explanation: 'The white wavy "Y" stands for the meeting of the rivers Niger and Benue.' },
    { stem: 'On the Nigerian coat of arms, what do the two horses stand for?', answer: 'Dignity', wrong: ['Strength', 'Wealth', 'Peace'], explanation: 'The two white horses stand for dignity.' },
    { stem: 'What is the motto on the Nigerian coat of arms?', answer: 'Unity and Faith, Peace and Progress', wrong: ['Unity and Strength', 'Peace, Justice and Progress', 'One Nation, One Destiny'], explanation: 'The motto is "Unity and Faith, Peace and Progress".' },
    { stem: 'In which year did Nigeria become independent?', answer: '1960', wrong: ['1963', '1914', '1999'], explanation: 'Nigeria became independent on 1 October 1960, and a republic in 1963.' },
    { stem: 'What is the capital of Nigeria?', answer: 'Abuja', wrong: ['Lagos', 'Kaduna', 'Ibadan'], explanation: 'Abuja has been the capital since 1991; before that it was Lagos.' },
  ]),
];

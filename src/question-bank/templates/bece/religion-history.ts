import { factPairs, itemSet, type Template } from '../engine.js';

/** BECE Christian Religious Studies, Islamic Studies, History and National Values: checked facts only. */

export const crs: Template[] = [
  itemSet('crs/old-testament', ['The Old Testament', 'Creation and the patriarchs'], 1, [
    { stem: 'On which day of creation did God create man?', answer: 'the sixth day', wrong: ['the first day', 'the fourth day', 'the seventh day'], explanation: 'Genesis 1 says God made man on the sixth day and rested on the seventh.' },
    { stem: 'Who built the ark to save his family from the flood?', answer: 'Noah', wrong: ['Abraham', 'Moses', 'Jacob'], explanation: 'God told Noah to build the ark (Genesis 6).' },
    { stem: 'Who was the son God promised to Abraham and Sarah?', answer: 'Isaac', wrong: ['Ishmael', 'Jacob', 'Esau'], explanation: 'Isaac was the son of the promise, born when Abraham was 100 years old.' },
    { stem: 'Who was sold into Egypt by his brothers?', answer: 'Joseph', wrong: ['Benjamin', 'Reuben', 'Judah'], explanation: 'Joseph’s jealous brothers sold him to traders going to Egypt (Genesis 37).' },
    { stem: 'Jacob was later given the name', answer: 'Israel', wrong: ['Abraham', 'Judah', 'Esau'], explanation: 'After wrestling with God, Jacob was renamed Israel (Genesis 32).' },
    { stem: 'Who is called the father of faith?', answer: 'Abraham', wrong: ['Moses', 'Noah', 'David'], explanation: 'Abraham obeyed God’s call and trusted His promises.' },
  ]),
  itemSet('crs/exodus-kings', ['The Old Testament', 'Moses and the Exodus'], 2, [
    { stem: 'Who led the Israelites out of Egypt?', answer: 'Moses', wrong: ['Joshua', 'Aaron', 'Joseph'], explanation: 'God called Moses at the burning bush to lead His people out of Egypt.' },
    { stem: 'On which mountain did Moses receive the Ten Commandments?', answer: 'Mount Sinai', wrong: ['Mount Carmel', 'Mount Zion', 'Mount of Olives'], explanation: 'God gave the Law to Moses on Mount Sinai (Exodus 19–20).' },
    { stem: 'Who led the Israelites into the Promised Land after Moses?', answer: 'Joshua', wrong: ['Aaron', 'Caleb', 'Samuel'], explanation: 'Joshua took over after Moses died and led the people into Canaan.' },
    { stem: 'Who was the first king of Israel?', answer: 'Saul', wrong: ['David', 'Solomon', 'Samuel'], explanation: 'Samuel anointed Saul as Israel’s first king.' },
    { stem: 'How did David kill Goliath?', answer: 'with a sling and a stone', wrong: ['with a sword', 'with a spear', 'with a bow and arrow'], explanation: 'David struck Goliath with a stone from his sling (1 Samuel 17).' },
    { stem: 'What did King Solomon ask God for?', answer: 'wisdom', wrong: ['riches', 'long life', 'victory over his enemies'], explanation: 'Solomon asked for wisdom to rule God’s people, and God gave him riches too.' },
    { stem: 'Which prophet challenged the prophets of Baal on Mount Carmel?', answer: 'Elijah', wrong: ['Elisha', 'Isaiah', 'Jeremiah'], explanation: 'Elijah called down fire from God on Mount Carmel (1 Kings 18).' },
  ]),
  itemSet('crs/life-of-jesus', ['The Life of Jesus', 'Birth and ministry'], 1, [
    { stem: 'In which town was Jesus born?', answer: 'Bethlehem', wrong: ['Nazareth', 'Jerusalem', 'Capernaum'], explanation: 'Jesus was born in Bethlehem of Judea and grew up in Nazareth.' },
    { stem: 'Who baptised Jesus?', answer: 'John the Baptist', wrong: ['Peter', 'Andrew', 'James'], explanation: 'John baptised Jesus in the River Jordan.' },
    { stem: 'In which river was Jesus baptised?', answer: 'River Jordan', wrong: ['River Nile', 'River Euphrates', 'River Tigris'], explanation: 'Jesus was baptised by John in the Jordan.' },
    { stem: 'How many disciples did Jesus choose to be His apostles?', answer: '12', wrong: ['7', '10', '70'], explanation: 'Jesus chose twelve apostles.' },
    { stem: 'Which disciple betrayed Jesus?', answer: 'Judas Iscariot', wrong: ['Peter', 'Thomas', 'John'], explanation: 'Judas betrayed Jesus for thirty pieces of silver.' },
    { stem: 'Which disciple denied Jesus three times?', answer: 'Peter', wrong: ['Judas Iscariot', 'Thomas', 'James'], explanation: 'Peter denied knowing Jesus three times before the cock crowed.' },
    { stem: 'Which tax collector climbed a sycamore tree to see Jesus?', answer: 'Zacchaeus', wrong: ['Matthew', 'Nicodemus', 'Lazarus'], explanation: 'Zacchaeus was short, so he climbed a tree (Luke 19).' },
  ]),
  itemSet('crs/miracles-parables', ['The Life of Jesus', 'Miracles and parables'], 2, [
    { stem: 'What was the first miracle of Jesus?', answer: 'turning water into wine', wrong: ['feeding the five thousand', 'raising Lazarus', 'walking on water'], explanation: 'At a wedding in Cana, Jesus turned water into wine (John 2).' },
    { stem: 'With how many loaves and fish did Jesus feed five thousand men?', answer: 'five loaves and two fish', wrong: ['seven loaves and a few fish', 'two loaves and five fish', 'twelve loaves and two fish'], explanation: 'Jesus blessed five loaves and two fish, and twelve baskets of leftovers were gathered.' },
    { stem: 'Whom did Jesus raise from the dead after four days in the tomb?', answer: 'Lazarus', wrong: ['Jairus', 'Bartimaeus', 'Zacchaeus'], explanation: 'Jesus raised Lazarus, the brother of Mary and Martha (John 11).' },
    { stem: 'The parable of the Good Samaritan teaches us to', answer: 'love our neighbours, whoever they are', wrong: ['give money to the church', 'pray every day', 'obey our parents'], explanation: 'The Samaritan helped a stranger in need; Jesus said, “Go and do likewise.”' },
    { stem: 'The parable of the Prodigal Son teaches about', answer: 'God’s forgiveness of those who repent', wrong: ['the importance of hard work', 'sharing property fairly', 'the dangers of travel'], explanation: 'The father welcomed his repentant son back, just as God forgives.' },
    { stem: 'In the parable of the sower, the seed stands for', answer: 'the word of God', wrong: ['money', 'good deeds', 'the church'], explanation: 'Jesus explained that the seed is the word of God (Luke 8:11).' },
  ]),
  itemSet('crs/early-church', ['The Early Church', 'Pentecost and the apostles'], 2, [
    { stem: 'On which day did the Holy Spirit come upon the apostles?', answer: 'the day of Pentecost', wrong: ['Easter Sunday', 'the Passover', 'the Sabbath'], explanation: 'The Holy Spirit came at Pentecost (Acts 2).' },
    { stem: 'Who was the first Christian martyr?', answer: 'Stephen', wrong: ['Peter', 'James', 'Paul'], explanation: 'Stephen was stoned to death for his faith (Acts 7).' },
    { stem: 'Where was Saul (Paul) converted?', answer: 'on the road to Damascus', wrong: ['in Jerusalem', 'in Antioch', 'on the island of Cyprus'], explanation: 'A light from heaven met Saul on the road to Damascus (Acts 9).' },
    { stem: 'Where were the disciples first called Christians?', answer: 'Antioch', wrong: ['Jerusalem', 'Rome', 'Corinth'], explanation: 'Acts 11:26: the disciples were first called Christians in Antioch.' },
  ]),
];

export const irs: Template[] = [
  itemSet('irs/quran', ["Qur'an and Hadith", "The Qur'an"], 1, [
    { stem: 'Through which angel was the Qur’an revealed to Prophet Muhammad (SAW)?', answer: 'Jibril', wrong: ['Mika’il', 'Israfil', 'Izra’il'], explanation: 'Angel Jibril (Gabriel) brought the revelation.' },
    { stem: 'In which cave did the first revelation come to Prophet Muhammad (SAW)?', answer: 'Cave Hira', wrong: ['Cave Thawr', 'Cave Uhud', 'Cave Safa'], explanation: 'The first revelation came in Cave Hira, on Jabal an-Nur near Makkah.' },
    { stem: 'What was the first word revealed to Prophet Muhammad (SAW)?', answer: 'Iqra (Read)', wrong: ['Bismillah', 'Alhamdulillah', 'Allahu Akbar'], explanation: 'The first revelation began “Iqra” (Surah Al-‘Alaq 96:1).' },
    { stem: 'How many surahs are in the Qur’an?', answer: '114', wrong: ['99', '110', '124'], explanation: 'The Qur’an has 114 surahs.' },
    { stem: 'Which is the first surah of the Qur’an?', answer: 'Al-Fatihah', wrong: ['Al-Baqarah', 'An-Nas', 'Al-Ikhlas'], explanation: 'Al-Fatihah (The Opening) is the first surah.' },
    { stem: 'Which is the longest surah of the Qur’an?', answer: 'Al-Baqarah', wrong: ['Al-Fatihah', 'Yasin', 'Al-Imran'], explanation: 'Al-Baqarah (The Cow), with 286 verses, is the longest.' },
    { stem: 'Which is the last surah of the Qur’an?', answer: 'An-Nas', wrong: ['Al-Falaq', 'Al-Ikhlas', 'Al-Fatihah'], explanation: 'An-Nas (Mankind) is the 114th and last surah.' },
  ]),
  factPairs(
    'irs/pillars',
    ['Tawhid and Fiqh', 'Pillars of Islam'],
    1,
    [
      ['Shahadah', 'declaring faith in one God and in Muhammad as His Messenger'],
      ['Salat', 'praying five times a day'],
      ['Zakat', 'giving obligatory charity'],
      ['Sawm', 'fasting in the month of Ramadan'],
      ['Hajj', 'pilgrimage to Makkah for those who are able'],
    ],
    { forward: (a) => `What does the pillar called ${a} involve?`, backward: (b) => `Which pillar of Islam is ${b}?`, why: (a, b) => `${a} is ${b}. It is one of the five pillars of Islam.` },
  ),
  itemSet('irs/salat', ['Tawhid and Fiqh', 'Salat'], 2, [
    { stem: 'How many obligatory daily prayers are there in Islam?', answer: '5', wrong: ['3', '4', '7'], explanation: 'The five daily prayers are Fajr, Zuhr, Asr, Maghrib and Isha.' },
    { stem: 'How many rak’ahs are in the obligatory Fajr prayer?', answer: '2', wrong: ['3', '4', '1'], explanation: 'Fajr, the dawn prayer, has 2 rak’ahs.' },
    { stem: 'How many rak’ahs are in the obligatory Maghrib prayer?', answer: '3', wrong: ['2', '4', '5'], explanation: 'Maghrib, at sunset, has 3 rak’ahs.' },
    { stem: 'How many rak’ahs are in the obligatory Zuhr prayer?', answer: '4', wrong: ['2', '3', '5'], explanation: 'Zuhr, Asr and Isha each have 4 rak’ahs.' },
    { stem: 'Which prayer is said at sunset?', answer: 'Maghrib', wrong: ['Fajr', 'Zuhr', 'Isha'], explanation: 'Maghrib is the sunset prayer.' },
    { stem: 'Which prayer is said at dawn?', answer: 'Fajr', wrong: ['Asr', 'Maghrib', 'Isha'], explanation: 'Fajr is the dawn prayer.' },
    { stem: 'What must a Muslim do before Salat to be clean?', answer: 'perform ablution (wudu)', wrong: ['give zakat', 'fast for a day', 'visit Makkah'], explanation: 'Wudu (ablution) is required before prayer.' },
  ]),
  itemSet('irs/sirah', ['Sirah', 'Life of the Prophet'], 2, [
    { stem: 'In which city was Prophet Muhammad (SAW) born?', answer: 'Makkah', wrong: ['Madinah', 'Ta’if', 'Jerusalem'], explanation: 'The Prophet was born in Makkah, in the Year of the Elephant (about 570 CE).' },
    { stem: 'What was the name of the Prophet’s mother?', answer: 'Aminah', wrong: ['Khadijah', 'Halimah', 'Fatimah'], explanation: 'His mother was Aminah bint Wahb; Halimah was his foster mother.' },
    { stem: 'Who was the first wife of Prophet Muhammad (SAW)?', answer: 'Khadijah', wrong: ['Aishah', 'Fatimah', 'Hafsah'], explanation: 'Khadijah was his first wife and the first person to accept Islam.' },
    { stem: 'The migration of the Prophet from Makkah to Madinah is called the', answer: 'Hijrah', wrong: ['Hajj', 'Umrah', 'Isra'], explanation: 'The Hijrah in 622 CE marks the start of the Islamic calendar.' },
    { stem: 'Who was the first muezzin (caller to prayer) in Islam?', answer: 'Bilal', wrong: ['Abu Bakr', 'Umar', 'Ali'], explanation: 'Bilal ibn Rabah was chosen for his beautiful voice.' },
    { stem: 'Who was the first of the Rightly Guided Caliphs?', answer: 'Abu Bakr', wrong: ['Umar', 'Uthman', 'Ali'], explanation: 'The four were Abu Bakr, Umar, Uthman and Ali, in that order.' },
  ]),
  itemSet('irs/festivals', ['Festivals', 'Islamic festivals'], 1, [
    { stem: 'In which month do Muslims fast?', answer: 'Ramadan', wrong: ['Shawwal', 'Muharram', 'Dhul-Hijjah'], explanation: 'Fasting in Ramadan is one of the five pillars.' },
    { stem: 'Which festival marks the end of the Ramadan fast?', answer: 'Eid-ul-Fitr', wrong: ['Eid-ul-Adha', 'Maulud', 'Hijrah'], explanation: 'Eid-ul-Fitr is celebrated on the first day of Shawwal.' },
    { stem: 'Which festival is celebrated during the Hajj season with the sacrifice of an animal?', answer: 'Eid-ul-Adha', wrong: ['Eid-ul-Fitr', 'Maulud', 'Laylatul-Qadr'], explanation: 'Eid-ul-Adha remembers Prophet Ibrahim’s readiness to sacrifice his son.' },
    { stem: 'Where is the Ka’bah?', answer: 'Makkah', wrong: ['Madinah', 'Jerusalem', 'Cairo'], explanation: 'The Ka’bah is in the Sacred Mosque in Makkah; Muslims face it in prayer.' },
  ]),
];

export const history: Template[] = [
  itemSet('history/kingdoms', ['Pre-colonial Nigeria', 'Ancient kingdoms and empires'], 2, [
    { stem: 'What was the title of the ruler of the Oyo Empire?', answer: 'Alaafin', wrong: ['Oba', 'Mai', 'Emir'], explanation: 'The Alaafin ruled the Oyo Empire.' },
    { stem: 'What was the title of the ruler of Kanem-Bornu?', answer: 'Mai', wrong: ['Alaafin', 'Oba', 'Obi'], explanation: 'Kanem-Bornu was ruled by the Mai (later the Shehu).' },
    { stem: 'Who led the jihad that founded the Sokoto Caliphate in 1804?', answer: 'Usman dan Fodio', wrong: ['Muhammadu Bello', 'Abdullahi Fodio', 'Ahmadu Bello'], explanation: 'Usman dan Fodio led the jihad; his son Muhammadu Bello became the first Sultan.' },
    { stem: 'Which famous queen ruled Zazzau (Zaria)?', answer: 'Queen Amina', wrong: ['Queen Idia', 'Moremi', 'Emotan'], explanation: 'Queen Amina was a warrior queen of Zazzau.' },
    { stem: 'The ancient Nok culture is best known for its', answer: 'terracotta (baked clay) sculptures', wrong: ['bronze heads', 'ivory masks', 'stone walls'], explanation: 'The Nok culture of central Nigeria made terracotta figures over 2,000 years ago.' },
    { stem: 'Which ancient kingdom is famous for its bronze works and is ruled by an Oba?', answer: 'Benin', wrong: ['Oyo', 'Kanem-Bornu', 'Nupe'], explanation: 'Benin bronzes are world-famous; the kingdom is ruled by the Oba of Benin.' },
  ]),
  itemSet('history/colonial', ['Colonial Nigeria', 'Colonial rule'], 2, [
    { stem: 'In which year were the Northern and Southern Protectorates amalgamated?', answer: '1914', wrong: ['1900', '1960', '1922'], explanation: 'Lord Lugard amalgamated them in 1914 to form Nigeria.' },
    { stem: 'Who amalgamated Northern and Southern Nigeria?', answer: 'Lord Frederick Lugard', wrong: ['Hugh Clifford', 'Arthur Richards', 'John Macpherson'], explanation: 'Lugard became the first Governor-General of Nigeria in 1914.' },
    { stem: 'Who suggested the name “Nigeria”?', answer: 'Flora Shaw', wrong: ['Lord Lugard', 'Mungo Park', 'Herbert Macaulay'], explanation: 'Flora Shaw, later Lugard’s wife, suggested the name in 1897, after the River Niger.' },
    { stem: 'The British system of ruling through traditional rulers is called', answer: 'indirect rule', wrong: ['direct rule', 'assimilation', 'federalism'], explanation: 'Lugard used indirect rule, governing through emirs and chiefs.' },
    { stem: 'Who is called the father of Nigerian nationalism?', answer: 'Herbert Macaulay', wrong: ['Nnamdi Azikiwe', 'Obafemi Awolowo', 'Ahmadu Bello'], explanation: 'Herbert Macaulay founded the Nigerian National Democratic Party (NNDP) in 1923.' },
  ]),
  itemSet('history/independence', ['Independent Nigeria', 'Independence and the republics'], 2, [
    { stem: 'On what date did Nigeria become independent?', answer: '1 October 1960', wrong: ['1 October 1963', '12 June 1960', '29 May 1960'], explanation: 'Nigeria gained independence from Britain on 1 October 1960.' },
    { stem: 'Who was Nigeria’s first Prime Minister?', answer: 'Abubakar Tafawa Balewa', wrong: ['Nnamdi Azikiwe', 'Obafemi Awolowo', 'Ahmadu Bello'], explanation: 'Sir Abubakar Tafawa Balewa was Prime Minister from 1960 to 1966.' },
    { stem: 'Who was Nigeria’s first President?', answer: 'Nnamdi Azikiwe', wrong: ['Tafawa Balewa', 'Olusegun Obasanjo', 'Shehu Shagari'], explanation: 'Nnamdi Azikiwe became President when Nigeria became a republic in 1963.' },
    { stem: 'In which year did Nigeria become a republic?', answer: '1963', wrong: ['1960', '1966', '1979'], explanation: 'Nigeria became a republic on 1 October 1963.' },
    { stem: 'The Nigerian Civil War lasted from', answer: '1967 to 1970', wrong: ['1960 to 1963', '1966 to 1969', '1970 to 1975'], explanation: 'The civil war began in July 1967 and ended in January 1970.' },
    { stem: 'In which year did Nigeria return to civilian rule with the Fourth Republic?', answer: '1999', wrong: ['1979', '1993', '2003'], explanation: 'The Fourth Republic began on 29 May 1999, with Olusegun Obasanjo as President.' },
    { stem: 'In which year did the Federal Government officially move the capital to Abuja?', answer: '1991', wrong: ['1976', '1985', '1999'], explanation: 'The capital moved from Lagos to Abuja in December 1991.' },
  ]),
];

export const civic: Template[] = [
  factPairs(
    'nve/values',
    ['Values', 'National values'],
    1,
    [
      ['honesty', 'telling the truth and not cheating'],
      ['integrity', 'doing what is right even when nobody is watching'],
      ['discipline', 'self-control and obeying rules'],
      ['patriotism', 'love and loyalty to one’s country'],
      ['tolerance', 'accepting people whose beliefs or ways are different'],
      ['cooperation', 'working together for a common goal'],
    ],
    { forward: (a) => `What does ${a} mean?`, backward: (b) => `Which value means ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} means ${b}.` },
  ),
  factPairs(
    'nve/agencies',
    ['Security and Safety', 'Security agencies'],
    2,
    [
      ['FRSC', 'road safety'],
      ['NDLEA', 'fighting illegal drugs'],
      ['NAPTIP', 'fighting human trafficking'],
      ['EFCC', 'fighting economic and financial crimes'],
      ['INEC', 'conducting elections'],
      ['NAFDAC', 'controlling the quality of food and drugs'],
      ['NEMA', 'managing emergencies and disasters'],
    ],
    { forward: (a) => `What is the main job of ${a}?`, backward: (b) => `Which agency is responsible for ${b}?`, why: (a, b) => `${a} is responsible for ${b}.` },
  ),
  itemSet('nve/citizenship', ['Citizenship', 'Citizenship, rights and duties'], 1, [
    { stem: 'Which of these is a way of becoming a Nigerian citizen?', answer: 'by naturalisation', wrong: ['by paying tax', 'by visiting Nigeria', 'by learning a Nigerian language'], explanation: 'The constitution allows citizenship by birth, by registration and by naturalisation.' },
    { stem: 'Which of these is a duty of a citizen?', answer: 'paying taxes', wrong: ['freedom of speech', 'the right to life', 'freedom of movement'], explanation: 'Paying taxes, obeying the law and voting are duties; the others are rights.' },
    { stem: 'Which of these is a right of every citizen?', answer: 'freedom of religion', wrong: ['paying taxes', 'obeying the law', 'defending the country'], explanation: 'Freedom of religion is a fundamental right; the others are duties.' },
    { stem: 'What is the highest law in Nigeria?', answer: 'the Constitution', wrong: ['a state law', 'a bye-law', 'a court judgement'], explanation: 'The Constitution is supreme; any law against it is void.' },
    { stem: 'At what age can a Nigerian citizen vote?', answer: '18 years', wrong: ['16 years', '21 years', '25 years'], explanation: 'Citizens aged 18 and above can register and vote.' },
  ]),
  itemSet('nve/safety', ['Security and Safety', 'Safety and emergencies'], 1, [
    { stem: 'What is the toll-free emergency number in Nigeria?', answer: '112', wrong: ['911', '999', '123'], explanation: '112 is Nigeria’s national emergency number.' },
    { stem: 'If you see a stranger trying to lure a child away, the best thing to do is', answer: 'tell a trusted adult or the police at once', wrong: ['follow them quietly', 'keep it to yourself', 'post it online first'], explanation: 'Report it quickly to an adult or the police so they can act.' },
    { stem: 'What should you do first if your clothes catch fire?', answer: 'stop, drop and roll', wrong: ['run for help', 'fan the flames', 'pour oil on it'], explanation: 'Running fans the flames; stopping, dropping and rolling puts them out.' },
  ]),
];

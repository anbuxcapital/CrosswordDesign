/* Crosscut admin console prototype — demo seed data.
   Loaded before app.js. Everything is illustrative demo content; the shell
   carries the DEMO label so individual rows do not have to.

   OWNERSHIP: each area builder may ADD to this file only inside its own
   section, marked with:  // === SECTION: <name> (owner: <builder>) ===
   Never edit another builder's section. Never reorder the sections.
*/
window.Console = window.Console || {};

Console.data = (function () {
  'use strict';

  // ---------------------------------------------------------------------
  // === SECTION: shared (owner: foundation) ===
  // ---------------------------------------------------------------------

  var TODAY_ISO = '2026-09-08';
  var TODAY_LABEL = 'Tuesday, September 8, 2026';

  var ROLES = {
    content_editor: { id: 'content_editor', label: 'Content editor' },
    publisher: { id: 'publisher', label: 'Publisher' },
    support: { id: 'support', label: 'Support agent' },
    integrity: { id: 'integrity', label: 'Integrity reviewer' },
    economy: { id: 'economy', label: 'Economy admin' },
    ads: { id: 'ads', label: 'Ads manager' },
    operations: { id: 'operations', label: 'Operations engineer' },
    console_admin: { id: 'console_admin', label: 'Console admin' }
  };

  var operators = [
    {
      id: 'op_molsen', handle: 'm.olsen', email: 'm.olsen@crosscut.app', name: 'Mia Olsen',
      roles: ['content_editor', 'publisher', 'support', 'integrity', 'economy', 'ads', 'operations', 'console_admin'],
      note: 'Full access. Use this operator to walk every area.'
    },
    {
      id: 'op_areid', handle: 'a.reid', email: 'a.reid@crosscut.app', name: 'Alex Reid',
      roles: ['content_editor', 'publisher'],
      note: 'Editorial and publishing only. No player data.'
    },
    {
      id: 'op_snovak', handle: 's.novak', email: 's.novak@crosscut.app', name: 'Sofia Novak',
      roles: ['support', 'integrity'],
      note: 'Player support and flagged-solve decisions.'
    },
    {
      id: 'op_tbaros', handle: 't.baros', email: 't.baros@crosscut.app', name: 'Tomas Baros',
      roles: ['operations', 'ads', 'economy'],
      note: 'Operations, ad placements and ledger inspection.'
    }
  ];

  /* Authentication. Better Auth owns operator accounts, roles and sessions; the
     console only reads them. These values drive the sign-in screen copy. */
  var auth = {
    provider: 'Better Auth',
    emailDomain: 'crosscut.app',
    sessionExpiry: 'in 7 days',
    socials: [
      { id: 'google', label: 'Google' },
      { id: 'apple', label: 'Apple' }
    ],
    providerLabels: { password: 'password', google: 'Google', apple: 'Apple', passkey: 'passkey' }
  };

  var environments = [
    { id: 'demo', label: 'Demo', note: 'Illustrative data. Nothing leaves the browser.' },
    { id: 'staging', label: 'Staging', note: 'Pre-production content. Safe to experiment.' },
    { id: 'production', label: 'Production', note: 'Live players. Every mutation is audited.' }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: editorial — puzzles and collections (owner: editorial builder) ===
  // ---------------------------------------------------------------------

  /* Two valid 5x5 word squares; rows and columns are both real words, so the
     across and down answer sets are identical. A grid cell is '' (open and
     empty), '#' (a block) or one letter; these two grids carry no blocks. */
  var GRID_A = ['HEART', 'EMBER', 'ABUSE', 'RESIN', 'TREND'];
  var GRID_B = ['BASIC', 'ARENA', 'SEDAN', 'INANE', 'CANES'];

  var CLUES_A = [
    'Where affection is said to live',
    'Glowing remnant of a fire',
    'Mistreat',
    'Tree sap used in varnish',
    'Direction things are moving'
  ];
  var CLUES_B = [
    'Bare-bones, or a beginner language',
    'Stadium bowl',
    'Four-door car',
    'Empty of meaning',
    'Walking sticks'
  ];

  /* Slots, numbers and the (row, col) each clue is bound to are read off the
     grid, never typed: in a 5 x 5 with no blocks the across slots start at
     column 0 of every row and the down slots at row 0 of every column, so the
     numbers run 1…5 along the top row and 1, 6, 7, 8, 9 down the first column.
     `par` is the target solve time in seconds: 300 for a 5 x 5 Mini, 600 for a
     9 x 9 Weekend grid. */
  function cwContent(which) {
    var rows = which === 'b' ? GRID_B : GRID_A;
    var text = which === 'b' ? CLUES_B : CLUES_A;
    var grid = rows.map(function (row) { return row.split(''); });
    var across = rows.map(function (word, r) {
      return { n: r === 0 ? 1 : r + 5, row: r, col: 0, answer: word, clue: text[r] };
    });
    var down = rows.map(function (word, c) {
      return {
        n: c + 1, row: 0, col: c,
        answer: grid.map(function (row) { return row[c]; }).join(''),
        clue: text[c]
      };
    });
    return { size: 5, par: 300, grid: grid, clues: { across: across, down: down } };
  }

  /* A Guessword is one word. Its whole content is that answer, upper-cased in
     the game's own locale. */
  function guesswordContent(answer) {
    return { answer: answer };
  }

  /* The demo word bank, two lists per language.

     `answers` is the small curated bank a Guessword answer must come from;
     each entry carries a rarity band `score`, 1 for the most common word and 5
     for the rarest, which feeds the difficulty estimate. `accepted` is the far
     larger list of words a player is allowed to type — every answer plus the
     rest of the playable dictionary. The size gap between the two lists is the
     point: the answer is curated, the guesses are not. */
  var BANK = {
    en: {
      answers: [
        ['CRANE', 1], ['SLATE', 1], ['HOUSE', 1], ['TRAIN', 1], ['PLANT', 1],
        ['LIGHT', 1], ['MONEY', 1], ['WATER', 1], ['MUSIC', 1], ['PAPER', 1],
        ['BREAD', 2], ['CLOUD', 2], ['DRIVE', 2], ['FROST', 2], ['GRAPE', 2],
        ['HONEY', 2], ['NURSE', 2], ['OLIVE', 2], ['PIANO', 2], ['RIVER', 1],
        ['STONE', 1], ['QUILT', 3], ['TIGER', 2], ['WHALE', 2], ['AMBER', 3],
        ['BLOOM', 2], ['CHORD', 3], ['DRIFT', 3], ['GLOVE', 2], ['IVORY', 3],
        ['JOKER', 3], ['KNEEL', 3], ['LEMON', 2], ['MOTOR', 2], ['NOBLE', 3],
        ['MARSH', 3], ['VIOLA', 4], ['FLINT', 4], ['OZONE', 4], ['ETUDE', 5],
        ['ARENA', 2], ['TREND', 2]
      ],
      accepted: [
        'ABBEY', 'ADOPT', 'BLAZE', 'BRICK', 'CHALK', 'CHASE', 'CLASP', 'CRISP',
        'DOUSE', 'DWELL', 'FABLE', 'FLUTE', 'GLIDE', 'GRASP', 'HATCH', 'INLET',
        'JOUST', 'KNACK', 'LAPSE', 'MIRTH', 'NUDGE', 'ORBIT', 'PLANK', 'PRISM',
        'QUERY', 'ROAST', 'SHARD', 'SMIRK', 'SPINE', 'STOUT', 'SWIFT', 'THORN',
        'TONIC', 'TRUCE', 'USHER', 'VAULT', 'WEAVE', 'WRIST', 'YIELD', 'ZEBRA'
      ]
    },
    uk: {
      answers: [
        ['ВІКНО', 1], ['ЗЕМЛЯ', 1], ['ХМАРА', 2], ['ВІТЕР', 1], ['ПОТІК', 2],
        ['МІСТО', 1], ['РІЧКА', 1], ['ЛІТАК', 2], ['КНИГА', 1], ['СТІНА', 2],
        ['ВЕСНА', 1], ['ОСІНЬ', 2], ['КАЗКА', 2], ['СОНЦЕ', 1], ['ГОЛОС', 2],
        ['ТРАВА', 1], ['ЗІРКА', 2], ['РУЧКА', 2], ['ШКОЛА', 1], ['ПІСНЯ', 2],
        ['КУХНЯ', 2], ['ВЕЧІР', 2], ['РАНОК', 2], ['СЛОВО', 1], ['ДОЩИК', 3],
        ['ЯГОДА', 2], ['САДОК', 3], ['ЧЕРГА', 3], ['КОЛІР', 2], ['ПАПІР', 2],
        ['ГРОШІ', 2], ['ПОРІГ', 3], ['ЖИТТЯ', 1], ['БІГТИ', 2], ['СПАТИ', 2],
        ['ДУМКА', 2], ['ЛАМПА', 2], ['КАВУН', 3], ['ОЗЕРО', 2], ['ГІЛКА', 3],
        ['ХАТКА', 3], ['ҐАНОК', 4], ['ЯСЕНЬ', 4]
      ],
      accepted: [
        'АГЕНТ', 'БАНКА', 'ВАГОН', 'ГІЛЛЯ', 'ДОШКА', 'ЖУРБА', 'ЗАПАХ', 'ІМЕНА',
        'ЇЖАКИ', 'КАЗАН', 'ЛОЖКА', 'МОРОЗ', 'НОЖИК', 'ОКЕАН', 'ПАРУС', 'РУКАВ',
        'СОКІЛ', 'ТАБІР', 'УРОКИ', 'ФАРБА', 'ХОЛОД', 'ЦЕГЛА', 'ЧАЙКА', 'ШАПКА',
        'ЮНАКИ', 'БЕРЕГ', 'ВІНОК', 'ГОРОД', 'ДРУГИ', 'ЄНОТИ', 'ЖАБКА', 'ЗІЛЛЯ',
        'КОЛОС', 'ЛІКАР', 'МАЛЮК', 'НАПІЙ', 'ОСЕЛЯ', 'ПОДІЯ', 'РОДИЧ', 'СВІЧА'
      ]
    },
    ru: {
      answers: [
        ['ВЕТЕР', 1], ['ГОРОД', 1], ['КНИГА', 1], ['ЗЕМЛЯ', 1], ['ТУЧКА', 3],
        ['ПОЕЗД', 1], ['СТЕНА', 2], ['ВЕСНА', 1], ['ОСЕНЬ', 2], ['ГОЛОС', 2],
        ['ТРАВА', 1], ['РУЧКА', 2], ['ШКОЛА', 1], ['ПЕСНЯ', 2], ['КУХНЯ', 2],
        ['ВЕЧЕР', 2], ['СЛОВО', 1], ['ДОЖДЬ', 1], ['ЯГОДА', 2], ['САДИК', 3],
        ['ПОРОГ', 3], ['ЖИЗНЬ', 1], ['СПАТЬ', 2], ['ЛАМПА', 2], ['АРБУЗ', 3],
        ['ОЗЕРО', 2], ['ВЕТКА', 2], ['ДОМИК', 3], ['ЯСЕНЬ', 4], ['ЛЕСОК', 4],
        ['ГОРКА', 3], ['ПОЧТА', 2], ['ПАРУС', 3], ['КРЫША', 2], ['МЫШКА', 3],
        ['ЗАМОК', 2], ['РЫНОК', 2], ['ЮНОША', 4], ['ЯКОРЬ', 4], ['ЦИФРА', 3],
        ['ЩЕНОК', 4], ['ХОЛОД', 2], ['ПЕСОК', 2]
      ],
      accepted: [
        'АГЕНТ', 'БАНКА', 'ВАГОН', 'ГРУША', 'ДОСКА', 'ЖАБКА', 'ЗАПАХ', 'ИМЕНА',
        'КАЗАН', 'ЛОЖКА', 'МОРОЗ', 'НОЖИК', 'ОКЕАН', 'ПАРТА', 'РУКАВ', 'СОКОЛ',
        'ТАБОР', 'УРОКИ', 'ФЛАГИ', 'ХОЛСТ', 'ЦАПЛЯ', 'ЧАЙКА', 'ШАПКА', 'ЩЕТКА',
        'ЭТАЖИ', 'ЮРИСТ', 'ЯЗЫКИ', 'БЕРЕГ', 'ВЕНОК', 'ГОРОХ', 'ДРУГИ', 'ЕНОТЫ',
        'ЖИЛЕТ', 'ЗЕРНО', 'КОЛОС', 'ЛИМОН', 'МАЛЫШ', 'НОМЕР', 'ОЛЕНЬ', 'ПОЛКА'
      ]
    }
  };

  /* Every answer is playable, so the accepted-guess list is the bank plus the
     uncurated rest. */
  var wordBank = {};
  Object.keys(BANK).forEach(function (lang) {
    var answers = BANK[lang].answers.map(function (a) { return { word: a[0], score: a[1] }; });
    var words = answers.map(function (a) { return a.word; });
    wordBank[lang] = {
      answers: answers,
      accepted: words.concat(BANK[lang].accepted)
    };
  });

  /* Seeded Guesswords take their answer from the front of their language's
     bank, in seed order, so no two of them share a word and the reuse check
     has real history to name. */
  var bankCursor = { en: 0, uk: 0, ru: 0 };
  function nextBankAnswer(lang) {
    var list = (wordBank[lang] || wordBank.en).answers;
    var w = list[bankCursor[lang] % list.length].word;
    bankCursor[lang] += 1;
    return w;
  }

  var puzzleSeed = [
    // id, title, kind, lang, difficulty, status, validation, author, topics, updatedAt
    ['CW-2254', 'First light', 'cw', 'en', 'Easy', 'published', 'passed', 'a.reid', ['Nature'], 'Sep 1 08:00'],
    ['GW-0905', 'Open door', 'guessword', 'en', 'Easy', 'published', 'passed', 'a.reid', ['Everyday'], 'Sep 1 08:00'],
    ['CW-2255', 'Side street', 'cw', 'en', 'Medium', 'published', 'passed', 'a.reid', ['City'], 'Sep 2 08:00'],
    ['GW-0906', 'Tall order', 'guessword', 'en', 'Medium', 'published', 'passed', 'a.reid', ['Food'], 'Sep 2 08:00'],
    ['CW-2256', 'Quiet hours', 'cw', 'en', 'Medium', 'published', 'passed', 'm.olsen', ['Home'], 'Sep 3 08:00'],
    ['GW-0907', 'Blue note', 'guessword', 'en', 'Easy', 'published', 'passed', 'm.olsen', ['Music'], 'Sep 3 08:00'],
    ['CW-2257', 'Open book', 'cw', 'en', 'Easy', 'published', 'passed', 'a.reid', ['Literature'], 'Sep 4 08:00'],
    ['GW-0908', 'Short fuse', 'guessword', 'en', 'Tricky', 'published', 'passed', 'a.reid', ['Science'], 'Sep 4 08:00'],
    ['CW-2258', 'Night market', 'cw', 'en', 'Medium', 'published', 'passed', 'm.olsen', ['Travel', 'Food'], 'Sep 5 08:00'],
    ['GW-0909', 'Fair play', 'guessword', 'en', 'Medium', 'published', 'passed', 'm.olsen', ['Sport'], 'Sep 5 08:00'],
    ['CW-2259', 'Weekend edition', 'cw', 'en', 'Hard', 'published', 'passed', 'a.reid', ['News'], 'Sep 6 08:00'],
    ['GW-0910', 'Slow burn', 'guessword', 'en', 'Medium', 'published', 'passed', 'a.reid', ['Film'], 'Sep 6 08:00'],
    ['CW-2261', 'Moon walk', 'cw', 'en', 'Medium', 'published', 'passed', 'm.olsen', ['Science', 'History'], 'Sep 7 08:00'],
    ['GW-0912', 'Fresh start', 'guessword', 'en', 'Easy', 'published', 'passed', 'm.olsen', ['Everyday'], 'Sep 7 08:00'],
    ['CW-2262', 'Campus life', 'cw', 'en', 'Easy', 'live', 'passed', 'a.reid', ['Education'], 'Sep 8 08:14'],
    ['GW-0913', 'In the loop', 'guessword', 'en', 'Easy', 'live', 'passed', 'a.reid', ['Everyday'], 'Sep 8 08:14'],
    ['CW-2269', 'Late edition', 'cw', 'en', 'Hard', 'approved', 'passed', 'm.olsen', ['News'], 'Sep 8 08:14'],
    ['CW-2263', 'Good news', 'cw', 'en', 'Medium', 'scheduled', 'passed', 'a.reid', ['News'], 'Sep 7 09:12'],
    ['GW-0914', 'Brain boost', 'guessword', 'en', 'Medium', 'scheduled', 'passed', 'a.reid', ['Science'], 'Sep 7 09:12'],
    ['CW-2264', 'On the map', 'cw', 'en', 'Medium', 'review', 'failed', 'm.olsen', ['Travel'], 'Sep 8 07:44'],
    ['GW-0915', 'True or false', 'guessword', 'en', 'Easy', 'review', 'passed', 'm.olsen', ['Trivia'], 'Sep 8 07:44'],
    ['CW-2265', 'Back to work', 'cw', 'en', 'Medium', 'approved', 'passed', 'm.olsen', ['Work'], 'Sep 8 08:02'],
    ['CW-2266', 'Weekend vibes', 'cw', 'en', 'Easy', 'scheduled', 'passed', 'a.reid', ['Leisure'], 'Sep 6 15:10'],
    ['CW-2271', 'Long weekend', 'cw', 'en', 'Medium', 'approved', 'passed', 'a.reid', ['Travel'], 'Sep 6 15:10'],
    ['GW-0916', 'Culture club', 'guessword', 'en', 'Medium', 'scheduled', 'passed', 'a.reid', ['Art'], 'Sep 6 15:10'],
    ['GW-0920', 'Encore', 'guessword', 'en', 'Tricky', 'approved', 'passed', 'a.reid', ['Music'], 'Sep 6 15:10'],
    ['CW-2267', 'Full circle', 'cw', 'en', 'Medium', 'scheduled', 'passed', 'm.olsen', ['Everyday'], 'Sep 6 15:10'],
    ['GW-0917', 'End zone', 'guessword', 'en', 'Medium', 'scheduled', 'passed', 'm.olsen', ['Sport'], 'Sep 6 15:10'],
    ['CW-2268', 'Night shift', 'cw', 'en', 'Hard', 'draft', 'not_run', 'a.reid', ['Work'], 'Sep 8 10:20'],
    ['GW-0918', 'Split ends', 'guessword', 'en', 'Medium', 'approved', 'passed', 'a.reid', ['Everyday'], 'Sep 7 16:30'],
    ['GW-0919', 'Cold snap', 'guessword', 'en', 'Medium', 'approved', 'passed', 'm.olsen', ['Weather'], 'Sep 8 09:05'],
    ['GW-0921', 'Side quest', 'guessword', 'en', 'Easy', 'approved', 'passed', 'm.olsen', ['Games'], 'Sep 8 09:05'],
    ['CW-2272', 'Cold open', 'cw', 'en', 'Easy', 'approved', 'passed', 'a.reid', ['Film'], 'Sep 8 09:40'],
    ['CW-2270', 'Paper trail', 'cw', 'uk', 'Medium', 'draft', 'failed', 'i.koval', ['Work'], 'Sep 6 12:00'],
    ['GW-0923', 'Hard water', 'guessword', 'uk', 'Tricky', 'draft', 'failed', 'i.koval', ['Nature'], 'Sep 6 12:00'],
    ['CW-2273', 'Winter light', 'cw', 'uk', 'Easy', 'approved', 'passed', 'i.koval', ['Nature'], 'Sep 7 14:20'],
    ['GW-0924', 'Kyiv morning', 'guessword', 'uk', 'Medium', 'approved', 'passed', 'i.koval', ['City'], 'Sep 7 14:20']
  ];

  var VALIDATION_ISSUES = {
    'CW-2264': [
      { code: 'clue_missing', where: '7-across', message: 'No clue for 7-across' },
      { code: 'topic_missing', where: 'metadata', message: 'At least one topic is required before approval' }
    ],
    'CW-2270': [
      { code: 'grid_answer_mismatch', where: 'row 3, column 2', message: 'Grid letter V does not match the answer for 3-down' },
      { code: 'invalid_entry', where: '9-across', message: 'ЙЙЙЙЙ is not in the Ukrainian dictionary' }
    ],
    'GW-0923': [
      { code: 'answer_length', where: 'answer', message: 'ВОДА is four letters. The answer must be exactly five letters' },
      { code: 'answer_bank', where: 'answer', message: 'ВОДА is not in the Ukrainian answer bank' },
      { code: 'answer_accepted', where: 'answer', message: 'ВОДА is not in the Ukrainian accepted-guess list, so a player who types it would be rejected' }
    ]
  };

  var puzzles = puzzleSeed.map(function (p, i) {
    var kind = p[2];
    return {
      id: p[0],
      title: p[1],
      kind: kind,
      lang: p[3],
      difficulty: p[4],
      status: p[5],
      validation: p[6],
      validationIssues: (VALIDATION_ISSUES[p[0]] || []).slice(),
      version: p[5] === 'published' || p[5] === 'live' ? 2 : 1,
      author: p[7],
      topics: p[8].slice(),
      updatedAt: p[9],
      content: kind === 'cw'
        ? cwContent(i % 2 ? 'b' : 'a')
        : guesswordContent(nextBankAnswer(p[3]))
    };
  });

  var collections = [
    {
      id: 'col_starter', name: 'Starter pack', shelf: 'Featured', emoji: '🌱',
      blurb: 'Five gentle minis for a first week.',
      unlockRule: 'Free for everyone', reward: '+50 coins on completion',
      visibility: 'published', order: 1,
      members: ['CW-2254', 'GW-0905', 'CW-2257', 'GW-0912', 'CW-2262']
    },
    {
      id: 'col_night', name: 'Night shift', shelf: 'Themes', emoji: '🌙',
      blurb: 'Harder games for late solvers.',
      unlockRule: 'Unlocks after a 7-day streak', reward: '+120 coins on completion',
      visibility: 'draft', order: 2,
      members: ['CW-2259', 'CW-2269', 'GW-0908', 'GW-0920']
    },
    {
      id: 'col_uk', name: 'Ukrainian starter', shelf: 'Languages', emoji: '🇺🇦',
      blurb: 'The first Ukrainian shelf, still in preparation.',
      unlockRule: 'Free for everyone', reward: 'None',
      visibility: 'hidden', order: 3,
      members: ['CW-2273', 'GW-0924']
    }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: publishing — days and Daily games (owner: publishing builder) ===
  // ---------------------------------------------------------------------

  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Sep 1 2026 is a Tuesday, so index 0 sits in the second column of a Monday-first grid.
  // [crosswordId, guesswordId] per day of month; a missing entry is an empty slot.
  var DAY_GAMES = {
    1: ['CW-2254', 'GW-0905'],
    2: ['CW-2255', 'GW-0906'],
    3: ['CW-2256', 'GW-0907'],
    4: ['CW-2257', 'GW-0908'],
    5: ['CW-2258', 'GW-0909'],
    6: ['CW-2259', 'GW-0910'],
    7: ['CW-2261', 'GW-0912'],
    8: ['CW-2262', 'GW-0913'],
    9: ['CW-2263', 'GW-0914'],
    10: ['CW-2264', 'GW-0915'],
    11: ['CW-2265', null],
    12: ['CW-2266', 'GW-0916'],
    13: ['CW-2267', 'GW-0917'],
    14: ['CW-2268', 'GW-0918']
  };

  var DAY_AUDIT = {
    8: [
      ['12:00 UTC', 'system', 'Daily game published — crossword + Guessword'],
      ['Sep 7 09:12', 'm.olsen', 'Schedule confirmed'],
      ['Sep 5 16:40', 'a.reid', 'Both games approved']
    ],
    11: [
      ['Sep 8 08:02', 'm.olsen', 'Crossword CW-2265 approved'],
      ['Sep 6 11:20', 'system', 'Guessword candidate rejected — answer reuse'],
      ['Sep 4 10:05', 'm.olsen', 'Date opened for scheduling']
    ]
  };

  var DAY_AUDIT_DEFAULT = [
    ['Sep 8 07:44', 'm.olsen', 'Pair created'],
    ['Sep 6 15:10', 'system', 'Crossword imported from batch 2026-36'],
    ['Sep 6 15:10', 'system', 'Guessword imported from batch 2026-36']
  ];

  // 30 materialised days, Sep 1 – Sep 30 2026.
  var days = [];
  for (var dn = 1; dn <= 30; dn++) {
    var iso = '2026-09-' + (dn < 10 ? '0' + dn : dn);
    var dowIndex = dn % 7; // Sep 1 2026 = Tuesday = DOW index 1
    days.push({
      index: dn - 1,
      iso: iso,
      dayOfMonth: dn,
      dow: DOW[dowIndex],
      label: 'Sep ' + dn,
      longLabel: DOW[dowIndex] + ' Sep ' + dn,
      today: iso === TODAY_ISO,
      past: dn < 8,
      crosswordId: (DAY_GAMES[dn] || [])[0] || null,
      guesswordId: (DAY_GAMES[dn] || [])[1] || null,
      scheduled: false,
      publishTime: '12:00',
      publishMode: 'utc',
      audit: (DAY_AUDIT[dn] || DAY_AUDIT_DEFAULT).map(function (a) {
        return { time: a[0], operator: a[1], text: a[2] };
      })
    });
  }

  // ---------------------------------------------------------------------
  // === SECTION: support — players (owner: support builder) ===
  // ---------------------------------------------------------------------

  var players = [
    {
      id: 'pl_8f2c41', name: 'Dana Whitfield', signIn: 'dana.w@…mail.com · Apple',
      lang: 'en', joined: 'Mar 2026', streak: 34, solved: 212, tokens: 1480, stars: 2330,
      status: 'active',
      profile: [
        ['Display name', 'Dana Whitfield', true],
        ['Sign-in', 'dana.w@…mail.com · Apple', false],
        ['Player ID', 'pl_8f2c41', false],
        ['Language', 'English', true],
        ['Difficulty', 'Medium', true],
        ['Topics', 'Music, Travel, Science', true],
        ['Notifications', 'Daily game · 12:00 local', true]
      ],
      timeline: [
        ['Today 12:06', 'solve', 'Guessword "In the loop" solved in 3 guesses', '+40'],
        ['Today 12:04', 'session', 'Session opened · iOS 18.2', ''],
        ['Sep 7 12:11', 'ledger', 'Streak reward credited', '+40'],
        ['Sep 6 12:09', 'ledger', 'Hint purchased', '−15'],
        ['Sep 5 12:02', 'solve', 'Mini crossword "Moon walk" solved', '+60']
      ],
      devices: [
        ['iPhone 15 Pro', 'iOS 18.2 · app 1.4.2', 'Today 12:04'],
        ['iPad Air', 'iPadOS 18.1 · app 1.4.0', 'Sep 2']
      ],
      ads: [
        ['Ad-free', 'Star pack, expires Nov 4', 'ok'],
        ['Consent', 'ATT authorized · GDPR n/a', 'mute'],
        ['Rewarded views', '0 today · cap 3', 'mute']
      ],
      notes: [
        { id: 'n1', author: 'a.reid', when: 'Sep 3', text: 'Asked to change display name; done.', status: 'closed' }
      ]
    },
    {
      id: 'pl_2a90bd', name: 'Ihor Melnyk', signIn: 'Google · ihor.m@…',
      lang: 'uk', joined: 'Aug 2026', streak: 3, solved: 19, tokens: 120, stars: 210,
      status: 'active',
      profile: [
        ['Display name', 'Ihor Melnyk', true],
        ['Sign-in', 'Google · ihor.m@…', false],
        ['Player ID', 'pl_2a90bd', false],
        ['Language', 'Ukrainian', true],
        ['Difficulty', 'Easy', true],
        ['Topics', 'Sport, Film', true],
        ['Notifications', 'Off', true]
      ],
      timeline: [
        ['Today 09:41', 'flag', 'Solve time 11s flagged for review', ''],
        ['Today 09:41', 'solve', 'Mini crossword "Campus life" solved', '+60'],
        ['Sep 6 19:22', 'session', 'Session opened · Android 15', ''],
        ['Sep 5 19:20', 'ledger', 'Welcome grant', '+100']
      ],
      devices: [['Pixel 8', 'Android 15 · app 1.4.2', 'Today 09:41']],
      ads: [
        ['Ad-free', 'No', 'bad'],
        ['Consent', 'GDPR accepted Sep 5', 'mute'],
        ['Rewarded views', '2 today · cap 3', 'mute']
      ],
      notes: [
        { id: 'n2', author: 'system', when: 'Today', text: 'Solve time flagged; awaiting leaderboard decision.', status: 'open' }
      ]
    },
    {
      id: 'pl_71e0aa', name: 'Rosa Iglesias', signIn: 'Email · rosa.i@…',
      lang: 'en', joined: 'Jan 2026', streak: 0, solved: 88, tokens: 0, stars: 500,
      status: 'active',
      profile: [
        ['Display name', 'Rosa Iglesias', true],
        ['Sign-in', 'Email · rosa.i@…', false],
        ['Player ID', 'pl_71e0aa', false],
        ['Language', 'English', true],
        ['Difficulty', 'Hard', true],
        ['Topics', 'Literature, History', true],
        ['Notifications', 'Daily game · 08:00 local', true]
      ],
      timeline: [
        ['Today 08:15', 'session', 'Support contact · lost streak after travel', ''],
        ['Sep 6 23:58', 'solve', 'Guessword missed — streak reset', ''],
        ['Sep 4 12:30', 'ledger', 'Star pack purchase', '+500']
      ],
      devices: [
        ['iPhone 13', 'iOS 17.6 · app 1.3.9', 'Sep 6'],
        ['Web', 'Safari 18', 'Aug 30']
      ],
      ads: [
        ['Ad-free', 'No', 'bad'],
        ['Consent', 'ATT denied', 'mute'],
        ['Rewarded views', '0 today · cap 3', 'mute']
      ],
      notes: [
        { id: 'n3', author: 'm.olsen', when: 'Today 08:15', text: 'Lost a 61-day streak while travelling across time zones. Restore requested.', status: 'open' },
        { id: 'n4', author: 'support', when: 'Aug 12', text: 'Purchase receipt verified manually.', status: 'closed' }
      ]
    }
  ];

  // Five more searchable records, so player search has something to filter.
  // [id, name, signIn, lang, joined, streak, solved, tokens, stars, status, adFree]
  var EXTRA_PLAYERS = [
    ['pl_5c3d02', 'Marek Dvorak', 'Apple · marek.d@…', 'en', 'Feb 2026', 12, 140, 620, 1540, 'active', false],
    ['pl_9b71fe', 'Amelia Frost', 'Email · amelia.f@…', 'en', 'Jun 2026', 61, 301, 2210, 3310, 'active', true],
    ['pl_3d88c7', 'Oleh Tkachuk', 'Google · oleh.t@…', 'uk', 'Jul 2026', 0, 7, 40, 80, 'suspended', false],
    ['pl_6e12ab', 'Priya Nair', 'Apple · priya.n@…', 'en', 'Apr 2026', 22, 176, 980, 1930, 'active', false],
    ['pl_a40f19', 'anon_44b1', 'Guest device', 'en', 'Sep 2026', 1, 4, 100, 45, 'active', false]
  ];

  EXTRA_PLAYERS.forEach(function (p) {
    players.push({
      id: p[0], name: p[1], signIn: p[2], lang: p[3], joined: p[4],
      streak: p[5], solved: p[6], tokens: p[7], stars: p[8], status: p[9],
      profile: [
        ['Display name', p[1], true],
        ['Sign-in', p[2], false],
        ['Player ID', p[0], false],
        ['Language', p[3] === 'uk' ? 'Ukrainian' : 'English', true],
        ['Difficulty', 'Medium', true],
        ['Topics', 'Everyday', true],
        ['Notifications', 'Daily game · 09:00 local', true]
      ],
      timeline: [
        ['Today 07:30', 'session', 'Session opened · app 1.4.2', ''],
        ['Sep 7 07:32', 'solve', 'Mini crossword "Moon walk" solved', '+60'],
        ['Sep 5 07:30', 'ledger', 'Streak reward credited', '+40']
      ],
      devices: [['Handset', 'app 1.4.2', 'Today 07:30']],
      ads: [
        ['Ad-free', p[10] ? 'Star pack, expires Dec 1' : 'No', p[10] ? 'ok' : 'bad'],
        ['Consent', 'ATT authorized', 'mute'],
        ['Rewarded views', '1 today · cap 3', 'mute']
      ],
      notes: []
    });
  });

  var SUPPORT_ACTIONS = [
    { id: 'restore_streak', label: 'Restore streak', params: [{ key: 'days', label: 'Days to restore', type: 'number', value: 1 }], ledger: false },
    { id: 'grant_tokens', label: 'Grant coins', params: [{ key: 'amount', label: 'Coins', type: 'number', value: 100 }], ledger: true },
    { id: 'reset_session', label: 'Reset session', params: [], ledger: false }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: integrity — flags and boards (owner: integrity/economy builder) ===
  // ---------------------------------------------------------------------

  var flags = [
    {
      id: 'fl_1001', playerId: 'pl_2a90bd', playerName: 'Ihor Melnyk',
      puzzleId: 'CW-2262', puzzleTitle: 'Campus life', scope: 'Sep 8 · weekly',
      reason: 'Solve time 11s, 6σ below cohort', decision: null,
      evidence: [
        ['Solve time', '11s (cohort median 3m 42s)'],
        ['Signal S1', 'Impossible pace for grid size'],
        ['Signal S3', 'No intermediate keystrokes recorded'],
        ['Device change', 'Same device as previous 4 solves'],
        ['Prior decisions', 'None']
      ]
    },
    {
      id: 'fl_1002', playerId: 'pl_a40f19', playerName: 'anon_44b1',
      puzzleId: 'CW-2261', puzzleTitle: 'Moon walk', scope: 'Sep 7 · crossword',
      reason: 'Answer sequence matches a known leak', decision: null,
      evidence: [
        ['Solve time', '48s (cohort median 4m 05s)'],
        ['Signal S2', 'Answer order identical to a leaked solution post'],
        ['Signal S4', 'Account created 3 minutes before the solve'],
        ['Device change', 'First session on this device'],
        ['Prior decisions', 'None']
      ]
    },
    {
      id: 'fl_1003', playerId: 'pl_8f2c41', playerName: 'Dana Whitfield',
      puzzleId: 'CW-2263', puzzleTitle: 'Good news', scope: 'Sep 6 · weekly',
      reason: 'Device change mid-solve', decision: 'cleared',
      evidence: [
        ['Solve time', '3m 12s (cohort median 3m 42s)'],
        ['Signal S1', 'Not raised'],
        ['Device change', 'iPhone to iPad, same iCloud account'],
        ['Prior decisions', 'Cleared Sep 6 by s.novak']
      ]
    }
  ];

  var boards = [
    {
      id: 'bd_week_36_en', scope: 'week', label: 'Week 36 · English', lang: 'en',
      entries: [
        { rank: 1, playerId: 'pl_9b71fe', playerName: 'Amelia Frost', score: '6/6 · 14m 02s', eligible: true, note: '' },
        { rank: 2, playerId: 'pl_8f2c41', playerName: 'Dana Whitfield', score: '6/6 · 15m 41s', eligible: true, note: '' },
        { rank: 3, playerId: 'pl_2a90bd', playerName: 'Ihor Melnyk', score: '5/6 · 09m 58s', eligible: false, note: 'Held pending flag fl_1001' },
        { rank: 4, playerId: 'pl_6e12ab', playerName: 'Priya Nair', score: '5/6 · 18m 20s', eligible: true, note: '' },
        { rank: 5, playerId: 'pl_5c3d02', playerName: 'Marek Dvorak', score: '4/6 · 12m 11s', eligible: true, note: '' }
      ]
    },
    {
      id: 'bd_puz_cw2262', scope: 'puzzle', label: 'Campus life · CW-2262', lang: 'en',
      entries: [
        { rank: 1, playerId: 'pl_2a90bd', playerName: 'Ihor Melnyk', score: '11s', eligible: false, note: 'Held pending flag fl_1001' },
        { rank: 2, playerId: 'pl_9b71fe', playerName: 'Amelia Frost', score: '1m 44s', eligible: true, note: '' },
        { rank: 3, playerId: 'pl_8f2c41', playerName: 'Dana Whitfield', score: '2m 02s', eligible: true, note: '' },
        { rank: 4, playerId: 'pl_a40f19', playerName: 'anon_44b1', score: '2m 51s', eligible: true, note: '' }
      ]
    }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: economy — ledger and purchases (owner: integrity/economy builder) ===
  // ---------------------------------------------------------------------

  var LEDGER_SEED = [
    ['le_0001', 'Today 12:06', 'pl_8f2c41', 'tokens', 40, 'Streak reward', 'system', 'idem_8f2c41_20260908_streak', 1480],
    ['le_0002', 'Sep 7 12:11', 'pl_8f2c41', 'tokens', 40, 'Streak reward', 'system', 'idem_8f2c41_20260907_streak', 1440],
    ['le_0003', 'Sep 6 12:09', 'pl_8f2c41', 'tokens', -15, 'Hint purchase', 'system', 'idem_8f2c41_20260906_hint', 1400],
    ['le_0004', 'Sep 4 12:30', 'pl_71e0aa', 'stars', 500, 'Star pack purchase · receipt verified', 'system', 'idem_71e0aa_rcpt_44821', 500],
    ['le_0005', 'Sep 5 19:20', 'pl_2a90bd', 'tokens', 100, 'Welcome grant', 'system', 'idem_2a90bd_welcome', 100],
    ['le_0006', 'Today 09:41', 'pl_2a90bd', 'tokens', 60, 'Solve reward · CW-2262', 'system', 'idem_2a90bd_cw2262', 160],
    ['le_0007', 'Today 09:55', 'pl_2a90bd', 'tokens', -40, 'Reward held pending flag fl_1001', 's.novak', 'idem_2a90bd_hold_1001', 120],
    ['le_0008', 'Sep 3 08:20', 'pl_9b71fe', 'tokens', 200, 'Collection reward · Starter pack', 'system', 'idem_9b71fe_col_starter', 2210],
    ['le_0009', 'Sep 2 18:02', 'pl_9b71fe', 'stars', 200, 'Star pack purchase · receipt verified', 'system', 'idem_9b71fe_rcpt_44712', 3310],
    ['le_0010', 'Sep 1 09:14', 'pl_6e12ab', 'tokens', 100, 'Welcome grant', 'system', 'idem_6e12ab_welcome', 980],
    ['le_0011', 'Sep 6 20:41', 'pl_5c3d02', 'tokens', 25, 'Rewarded ad grant', 'system', 'idem_5c3d02_rw_0906', 620],
    ['le_0012', 'Sep 5 11:03', 'pl_3d88c7', 'tokens', 40, 'Welcome grant', 'system', 'idem_3d88c7_welcome', 40],
    ['le_0013', 'Sep 7 07:32', 'pl_a40f19', 'tokens', 60, 'Solve reward · CW-2261', 'system', 'idem_a40f19_cw2261', 100],
    ['le_0014', 'Sep 2 10:12', 'pl_71e0aa', 'tokens', -60, 'Hint bundle purchase', 'system', 'idem_71e0aa_hintpack', 0],
    ['le_0015', 'Aug 30 16:44', 'pl_8f2c41', 'tokens', 300, 'Compensating entry · outage Aug 30', 'm.olsen', 'idem_8f2c41_comp_0830', 1375]
  ];

  var ledger = LEDGER_SEED.map(function (l) {
    return {
      id: l[0], when: l[1], playerId: l[2], currency: l[3], amount: l[4],
      reason: l[5], source: l[6], idempotencyKey: l[7], balanceAfter: l[8]
    };
  });

  var purchases = [
    { id: 'pu_44821', when: 'Sep 4 12:30', playerId: 'pl_71e0aa', pack: 'Star pack 500', plan: 'One-off', receipt: 'rcpt_44821', idempotencyKey: 'idem_71e0aa_rcpt_44821', amount: '€4.99', status: 'verified' },
    { id: 'pu_44712', when: 'Sep 2 18:02', playerId: 'pl_9b71fe', pack: 'Star pack 200', plan: 'One-off', receipt: 'rcpt_44712', idempotencyKey: 'idem_9b71fe_rcpt_44712', amount: '€2.49', status: 'verified' },
    { id: 'pu_44690', when: 'Sep 1 08:11', playerId: 'pl_8f2c41', pack: 'Ad-free month', plan: 'Subscription', receipt: 'rcpt_44690', idempotencyKey: 'idem_8f2c41_adfree_sep', amount: '€3.99', status: 'verified' },
    { id: 'pu_44655', when: 'Aug 29 21:40', playerId: 'pl_6e12ab', pack: 'Star pack 200', plan: 'One-off', receipt: 'rcpt_44655', idempotencyKey: 'idem_6e12ab_rcpt_44655', amount: '€2.49', status: 'refunded' },
    { id: 'pu_44601', when: 'Aug 24 13:05', playerId: 'pl_5c3d02', pack: 'Hint bundle', plan: 'One-off', receipt: 'rcpt_44601', idempotencyKey: 'idem_5c3d02_rcpt_44601', amount: '€0.99', status: 'verified' },
    { id: 'pu_44590', when: 'Aug 22 09:18', playerId: 'pl_3d88c7', pack: 'Star pack 500', plan: 'One-off', receipt: 'rcpt_44590', idempotencyKey: 'idem_3d88c7_rcpt_44590', amount: '€4.99', status: 'pending' }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: ads (owner: ads/operations builder) ===
  // ---------------------------------------------------------------------

  var placements = [
    { id: 'feed_interstitial', name: 'Feed interstitial', rule: 'After every 3rd solved card, never in first session', cap: 4, reward: '—', fill: '91%', platforms: 'iOS · Android', enabled: true },
    { id: 'post_solve_rewarded', name: 'Post-solve rewarded', rule: 'Optional after any solve; grants coins', cap: 3, reward: '+25 coins', fill: '86%', platforms: 'iOS · Android', enabled: true },
    { id: 'hint_rewarded', name: 'Hint for a view', rule: 'Offered when a player opens Hints with 0 coins', cap: 2, reward: '1 hint', fill: '88%', platforms: 'iOS · Android', enabled: true },
    { id: 'archive_banner', name: 'Archive banner', rule: 'Bottom of Browse and archive lists', cap: null, reward: '—', fill: '64%', platforms: 'Android', enabled: false }
  ];

  var adRules = [
    { id: 'grace', label: 'First-session grace', value: 'No ads for 24 h', note: 'New players see no interstitials until their second day.' },
    { id: 'cap', label: 'Rewarded cap', value: '3 views / day', note: 'Grants beyond the cap are refused and logged, not queued.' },
    { id: 'grant_health', label: 'Reward-grant failures 7d', value: '0.4%', note: 'Below the 1% alert floor. Failures surface in Operations with a retry.' }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: operations (owner: ads/operations builder) ===
  // ---------------------------------------------------------------------

  var signals = [
    {
      id: 'sig_drop_gen', name: 'Daily game generation', level: 'failed',
      detail: 'Failed for Sep 11 — no Guessword assigned', lastRun: '08:00 UTC',
      job: 'drop.generate', object: 'day 2026-09-11',
      error: 'DropInvalid: a Daily game needs exactly one crossword and one Guessword',
      runs: [['08:00 UTC', 'failed'], ['Sep 7 08:00 UTC', 'failed'], ['Sep 6 08:00 UTC', 'ok']],
      items: [
        { label: 'Sep 11 crossword CW-2265', outcome: 'ok', detail: 'Ready' },
        { label: 'Sep 11 Guessword', outcome: 'failed', detail: 'No Guessword assigned' }
      ]
    },
    {
      id: 'sig_pool_depth', name: 'Content pool depth', level: 'ok',
      detail: 'Crossword 21 days · Guessword 6 days', lastRun: '08:00 UTC',
      job: 'pool.measure', object: 'pool', error: '',
      runs: [['08:00 UTC', 'ok']],
      depth: [
        { lang: 'en', kind: 'cw', days: 21, floor: 10 },
        { lang: 'en', kind: 'guessword', days: 6, floor: 10 },
        { lang: 'uk', kind: 'cw', days: 2, floor: 10 },
        { lang: 'uk', kind: 'guessword', days: 1, floor: 10 }
      ]
    },
    {
      id: 'sig_pool_warn', name: 'Guessword pool warning', level: 'warn',
      detail: 'Below the 10-day floor for English', lastRun: '08:00 UTC',
      job: 'pool.measure', object: 'pool en/guessword', error: '',
      runs: [['08:00 UTC', 'warn']], items: []
    },
    {
      id: 'sig_board_fresh', name: 'Leaderboard freshness', level: 'ok',
      detail: 'Weekly board rebuilt 4 minutes ago', lastRun: '12:04 UTC',
      job: 'board.rebuild', object: 'bd_week_36_en', error: '',
      runs: [['12:04 UTC', 'ok']], items: []
    },
    {
      id: 'sig_batch_2036', name: 'Import batch 2026-36', level: 'ok',
      detail: '34 games imported, 2 rejected', lastRun: 'Sep 6 15:10',
      job: 'content.import', object: 'batch_2026_36', error: '',
      runs: [['Sep 6 15:10', 'ok']], items: []
    }
  ];

  var importBatches = [
    {
      id: 'batch_2026_36', when: 'Sep 6 15:10', operator: 'a.reid', source: '2026-36.json',
      accepted: 34, rejected: 2,
      items: [
        { label: 'CW-2266 Weekend vibes', outcome: 'ok', detail: 'Draft created' },
        { label: 'CW-2267 Full circle', outcome: 'ok', detail: 'Draft created' },
        { label: 'CW-2270 Paper trail', outcome: 'failed', detail: 'Grid letter does not match 3-down' },
        { label: 'GW-0923 Hard water', outcome: 'failed', detail: 'The answer ВОДА is four letters' }
      ]
    },
    {
      id: 'batch_2026_35', when: 'Aug 30 11:02', operator: 'a.reid', source: '2026-35.json',
      accepted: 28, rejected: 0,
      items: [
        { label: '28 games', outcome: 'ok', detail: 'All drafts created' }
      ]
    }
  ];

  // ---------------------------------------------------------------------
  // === SECTION: access — audit seed (owner: access builder) ===
  // ---------------------------------------------------------------------

  var audit = [
    { time: 'Sep 8 09:41', operator: 's.novak', action: 'Hold solve reward', object: 'pl_2a90bd', reason: 'Flag fl_1001 open, reward held pending review', result: 'Held' },
    { time: 'Sep 8 08:02', operator: 'm.olsen', action: 'Approve crossword', object: 'CW-2265', reason: '', result: 'Approved' },
    { time: 'Sep 7 16:30', operator: 'a.reid', action: 'Approve Guessword', object: 'GW-0918', reason: '', result: 'Approved' },
    { time: 'Sep 7 09:12', operator: 'm.olsen', action: 'Confirm schedule', object: 'day 2026-09-09', reason: 'Standard weekday Daily game', result: 'Scheduled at 12:00 UTC' },
    { time: 'Sep 6 15:10', operator: 'a.reid', action: 'Import batch', object: 'batch_2026_36', reason: 'Weekly batch from the editorial pipeline', result: '34 accepted, 2 rejected' },
    { time: 'Sep 6 11:20', operator: 'system', action: 'Reject import item', object: 'GW-0923', reason: 'Answer reuse inside the window', result: 'Rejected' },
    { time: 'Sep 5 16:40', operator: 'a.reid', action: 'Approve crossword', object: 'CW-2262', reason: '', result: 'Approved' },
    { time: 'Aug 30 16:44', operator: 'm.olsen', action: 'Append compensating entry', object: 'pl_8f2c41', reason: 'Outage on Aug 30 lost a streak reward', result: '+300 coins, balance 1,375' }
  ];

  return {
    todayIso: TODAY_ISO,
    todayLabel: TODAY_LABEL,
    roles: ROLES,
    auth: auth,
    operators: operators,
    environments: environments,
    puzzles: puzzles,
    wordBank: wordBank,
    collections: collections,
    days: days,
    players: players,
    supportActions: SUPPORT_ACTIONS,
    flags: flags,
    boards: boards,
    ledger: ledger,
    purchases: purchases,
    placements: placements,
    adRules: adRules,
    signals: signals,
    importBatches: importBatches,
    audit: audit
  };
})();

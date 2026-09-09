/* Editorial demo-data extension.
   OWNER: editorial builder. Runs after js/data.js and before the store is seeded.

   Three things live here: the crossword word bank the live checks read, one
   Weekend 9 x 9 draft, and the deliberate breakage behind the seeded failures.

   js/data.js lists validation issues for three games but their `content` is a
   clean copy of a valid grid, so the issues would disappear the first time the
   editor re-ran validation. This file makes those records genuinely broken, so
   E4 (validate, click the issue, fix it, re-run, Passed) is a real loop.

   Only editorial-owned fields on editorial-owned records are touched: `content`,
   `topics` and `validationIssues`. No ids, statuses, kinds or languages change,
   so the Daily game desk and collections see exactly the same records as before. */
(function (C) {
  'use strict';

  function puzzle(id) {
    return C.data.puzzles.filter(function (p) { return p.id === id; })[0] || null;
  }

  function detach(p) {
    p.content = JSON.parse(JSON.stringify(p.content));
    return p;
  }

  function acrossClue(p, n) {
    return p.content.clues.across.filter(function (c) { return c.n === n; })[0];
  }

  // -- CW-2264 “On the map” · Needs review · validation failed -------------
  // Seeded issues: no clue for 7-Across, no topic. Make both true.
  var cw2264 = puzzle('CW-2264');
  if (cw2264) {
    detach(cw2264);
    acrossClue(cw2264, 7).clue = '';
    cw2264.topics = [];
    cw2264.validationIssues = [
      { code: 'topic_missing', where: 'metadata', message: 'At least one topic is required before approval' },
      { code: 'clue_missing', where: '7-across', message: 'No clue for 7-Across' }
    ];
  }

  // -- CW-2270 “Paper trail” · Ukrainian · Draft · validation failed -------
  // One letter typed over the grid without the answer following it, and one
  // missing clue. The grid keeps its word-square shape, so the crossing
  // conflict is the only thing the cell is flagged for.
  var cw2270 = puzzle('CW-2270');
  if (cw2270) {
    detach(cw2270);
    cw2270.content.grid[2][1] = 'V';            // row 3, column 2
    acrossClue(cw2270, 9).clue = '';
    cw2270.validationIssues = [
      {
        code: 'grid_answer_mismatch', where: 'row 3, column 2',
        message: 'Row 3, column 2 holds V, and 2-Down is stored as ARENA, 7-Across is stored as SEDAN'
      },
      { code: 'clue_missing', where: '9-across', message: 'No clue for 9-Across' }
    ];
  }

  // -- CW-2268 “Night shift” · Draft · validation not run -----------------
  /* The Weekend grid: 9 x 9, eight blocks, 28 slots and nothing shorter than
     three. Six across entries are in and the rest of the fill is still to come,
     which is what a weekend draft looks like halfway through. Blocks are placed
     freely; there is no mirroring rule at either size. */
  var cw2268 = puzzle('CW-2268');
  if (cw2268) {
    cw2268.content = {
      size: 9,
      par: 600,
      grid: [
        ['D', 'U', 'S', 'K', '#', 'L', 'A', 'M', 'P'],
        ['', '', '', '', '#', '', '', '', ''],
        ['T', 'I', 'M', 'E', 'T', 'A', 'B', 'L', 'E'],
        ['', '', '', '#', '', '', '', '', ''],
        ['#', '', '', '', '', '', '', '', '#'],
        ['', '', '', '', '', '#', '', '', ''],
        ['O', 'V', 'E', 'R', 'N', 'I', 'G', 'H', 'T'],
        ['', '', '', '', '#', '', '', '', ''],
        ['D', 'A', 'W', 'N', '#', 'R', 'E', 'S', 'T']
      ],
      clues: {
        across: [
          { n: 1, row: 0, col: 0, answer: 'DUSK', clue: 'When the light goes' },
          { n: 5, row: 0, col: 5, answer: 'LAMP', clue: 'Bedside light' },
          { n: 9, row: 1, col: 0, answer: '', clue: '' },
          { n: 10, row: 1, col: 5, answer: '', clue: '' },
          { n: 11, row: 2, col: 0, answer: 'TIMETABLE', clue: 'Grid of departures' },
          { n: 13, row: 3, col: 0, answer: '', clue: '' },
          { n: 14, row: 3, col: 4, answer: '', clue: '' },
          { n: 15, row: 4, col: 1, answer: '', clue: '' },
          { n: 17, row: 5, col: 0, answer: '', clue: '' },
          { n: 18, row: 5, col: 6, answer: '', clue: '' },
          { n: 20, row: 6, col: 0, answer: 'OVERNIGHT', clue: 'Lasting until morning' },
          { n: 22, row: 7, col: 0, answer: '', clue: '' },
          { n: 23, row: 7, col: 5, answer: '', clue: '' },
          { n: 24, row: 8, col: 0, answer: 'DAWN', clue: 'First light of day' },
          { n: 25, row: 8, col: 5, answer: 'REST', clue: 'What a shift ends with' }
        ],
        down: [
          { n: 1, row: 0, col: 0, answer: '', clue: '' },
          { n: 2, row: 0, col: 1, answer: '', clue: '' },
          { n: 3, row: 0, col: 2, answer: '', clue: '' },
          { n: 4, row: 0, col: 3, answer: '', clue: '' },
          { n: 5, row: 0, col: 5, answer: '', clue: '' },
          { n: 6, row: 0, col: 6, answer: '', clue: '' },
          { n: 7, row: 0, col: 7, answer: '', clue: '' },
          { n: 8, row: 0, col: 8, answer: '', clue: '' },
          { n: 12, row: 2, col: 4, answer: '', clue: '' },
          { n: 16, row: 4, col: 3, answer: '', clue: '' },
          { n: 17, row: 5, col: 0, answer: '', clue: '' },
          { n: 19, row: 5, col: 8, answer: '', clue: '' },
          { n: 21, row: 6, col: 5, answer: '', clue: '' }
        ]
      }
    };
  }

  // -- GW-0923 “Hard water” · Ukrainian · Draft · validation failed --------
  // The answer is four letters, and it is in neither Ukrainian list.
  var gw0923 = puzzle('GW-0923');
  if (gw0923) {
    detach(gw0923);
    gw0923.content = { answer: 'ВОДА' };
    gw0923.validationIssues = [
      { code: 'answer_length', where: 'answer', message: 'ВОДА is four letters. The answer must be exactly five letters' },
      { code: 'answer_bank', where: 'answer', message: 'ВОДА is not in the Ukrainian answer bank' },
      { code: 'answer_accepted', where: 'answer', message: 'ВОДА is not in the Ukrainian accepted-guess list, so a player who types it would be rejected' }
    ];
  }

  /* The demo crossword word bank, one list per language. An answer outside its
     language's list is a warning, never a block: this is a short demo list, not
     a dictionary. A Guessword answer is checked against the two word bank
     lists in js/data.js instead. */
  var EN = ('HEART EMBER ABUSE RESIN TREND BASIC ARENA SEDAN INANE CANES ' +
    'DUSK LAMP DAWN REST TIMETABLE OVERNIGHT ' +
    'ACE AGE AIR ARC ARM ART BAR BAY BED BIT BOX BUS CAB CAP CAR COT CUP CUT ' +
    'DAY DEN DOT EAR EGG END EYE FAN FAR FIG FIT FOG GAP GAS GEM HAT HUB ICE ' +
    'INK JAM JAR JET KEY KIT LAB LAP LID LOG MAP MUD NET NUT OAK OAR OIL OWL ' +
    'PAN PEN PIE PIN POT RAG RIB RIM ROW RUG SEA SKY SUN TAG TAP TIE TIN TOP ' +
    'VAN WAX WEB WIN ZIP ' +
    'ABLE ACID AREA BAND BARN BEAM BELL BIRD BLUE BOAT BOLT BOOK CALM CARD ' +
    'CAVE CITY COAL COIN CORD DARK DECK DESK DIAL DOOR DOVE DRUM DUNE EAST ' +
    'ECHO EDGE FARM FERN FILM FIRE FISH FLAG FOAM FOLD FORK GATE GIFT GLOW ' +
    'GOLD GRIP HALL HARP HAWK HERB HILL HIVE HOME HOPE IRON IVY JADE KEEL ' +
    'KILN KNOT LACE LAKE LANE LEAF LENS LIME LINE LOOM MAST MILL MINT MOON ' +
    'MOSS NEST NOTE OPAL OVEN PARK PATH PEAK PIER PINE PLUM POND POST RAIL ' +
    'RAIN REED REEF RICE RING ROAD ROCK ROOF ROSE SAIL SALT SAND SEAL SHIP ' +
    'SHOP SILK SNOW SOIL STAR STEM SWAN TIDE TILE TRAM TREE TUNE VASE VEIL ' +
    'VINE WAVE WELL WIND WING WOOD WOOL YARD ZONE ' +
    'AMBER ANGLE BEACH BENCH BLADE BLOOM BRAID BRASS BREAD BRICK BRIDGE ' +
    'CABIN CHAIR CHALK CHART CLOUD CLOVE COAST CRANE CRATE CREEK CROWN DELTA ' +
    'DRIFT EAGLE EARTH FENCE FIELD FLAME FLASK FLEET FLINT FLOUR FOREST ' +
    'FROST GLASS GLOVE GRAIN GRAPE GRASS GROVE HARBOUR HAZEL HEDGE HONEY ' +
    'HOUSE IVORY LEMON LIGHT LINEN MAPLE MARSH MEDAL MOTOR MOUNT NIGHT NOBLE ' +
    'NURSE OCEAN OLIVE ONION ORBIT ORGAN PAPER PEARL PIANO PLANK PLANT PLAZA ' +
    'PORCH PRISM QUILT RIVER ROBIN SHELF SHORE SLATE SPINE STAGE STEAM STONE ' +
    'STORM SUGAR TABLE THORN TIGER TOWER TRAIL TRAIN VALVE VAULT WATER WHALE ' +
    'WHEAT WHEEL WILLOW WINDOW WINTER ' +
    'ANCHOR BARLEY CANDLE CANYON CASTLE CELLAR CIRCLE COTTON GARDEN HARVEST ' +
    'LANTERN MARKET MEADOW MORNING ORCHARD PEBBLE PLATEAU QUARRY RIBBON ' +
    'SEASON SHADOW SILVER STATION SUNRISE THUNDER TUNNEL VILLAGE WEATHER').split(/\s+/);

  var UK = ('ДІМ ЛІС МАК РІК ВІК КІТ САД СИН СУП СІК СИР ЛІД ЛОБ ОКО ОСА ЧАС ЯМА ' +
    'РАК ДУБ ЗУБ ЛЕВ МИР МЕД НІС НІЖ РІГ РІВ РОТ РУХ ГАЙ ГРА ДАР ЖАР ЖУК ЦАР ' +
    'ВОДА ЛІТО ЗИМА РУКА НОГА МОРЕ НЕБО ПОЛЕ ГОРА РІКА ДУША КАВА СІЛЬ КІНЬ ' +
    'ТІНЬ МІСТ СЕЛО ЗНАК БРАТ КОЛО СОВА ХАТА ВОЛЯ ДОЛЯ КОЗА СИЛА КРАЙ СВІТ ' +
    'СНІГ ДЕНЬ ХЛІБ КІНО СІНО ЖИТО ВУХО РОСА ДУГА НОТА ПОРА МУХА КАША ЛАПА ' +
    'ЛИПА ВІРА МІРА НОРА КОРА ПАРА ДІТИ МАМА ТАТО ' +
    'ВІКНО ЗЕМЛЯ ХМАРА ВІТЕР ПОТІК МІСТО РІЧКА ЛІТАК КНИГА СТІНА ВЕСНА ОСІНЬ ' +
    'КАЗКА СОНЦЕ ГОЛОС ТРАВА ЗІРКА РУЧКА ШКОЛА ПІСНЯ КУХНЯ ВЕЧІР РАНОК СЛОВО ' +
    'ЯГОДА САДОК ЧЕРГА КОЛІР ПАПІР ГРОШІ ПОРІГ ЖИТТЯ ДУМКА ЛАМПА КАВУН ОЗЕРО ' +
    'ГІЛКА ХАТКА ЯСЕНЬ СОСНА ПІСОК ЛІКАР ГОРОД ШАПКА ЛОЖКА ГОЛКА ЧАЙКА ' +
    'БЕРЕГ ВІНОК КОЛОС МОРОЗ ОКЕАН ПАРУС РУКАВ СОКІЛ ФАРБА ХОЛОД ЦЕГЛА').split(/\s+/);

  var RU = ('ДОМ ЛЕС МАК ГОД ВЕК КОТ САД СЫН СУП СОК СЫР ЛЕД ЛОБ ОКО ОСА ЧАС ЯМА ' +
    'РАК ДУБ ЗУБ ЛЕВ МИР МЕД НОС НОЖ РОГ РОВ РОТ ДАР ЖАР ЖУК ЦАРЬ ' +
    'ВОДА ЛЕТО ЗИМА РУКА НОГА МОРЕ НЕБО ПОЛЕ ГОРА РЕКА ДУША КОФЕ СОЛЬ КОНЬ ' +
    'ТЕНЬ МОСТ СЕЛО ЗНАК БРАТ КРУГ СОВА ХАТА ВОЛЯ ДОЛЯ КОЗА СИЛА КРАЙ СВЕТ ' +
    'СНЕГ ДЕНЬ ХЛЕБ КИНО СЕНО ЖИТО УХО РОСА ДУГА НОТА ПОРА МУХА КАША ЛАПА ' +
    'ЛИПА ВЕРА МЕРА НОРА КОРА ПАРА ДЕТИ МАМА ПАПА ' +
    'ВЕТЕР ГОРОД КНИГА ЗЕМЛЯ ТУЧКА ПОЕЗД СТЕНА ВЕСНА ОСЕНЬ ГОЛОС ТРАВА РУЧКА ' +
    'ШКОЛА ПЕСНЯ КУХНЯ ВЕЧЕР СЛОВО ДОЖДЬ ЯГОДА САДИК ПОРОГ ЖИЗНЬ ЛАМПА АРБУЗ ' +
    'ОЗЕРО ВЕТКА ДОМИК ЯСЕНЬ ЛЕСОК ГОРКА ПОЧТА ПАРУС КРЫША МЫШКА ЗАМОК РЫНОК ' +
    'БЕРЕГ ВЕНОК КОЛОС МОРОЗ ОКЕАН РУКАВ СОКОЛ ХОЛСТ ЦАПЛЯ ЧАЙКА ШАПКА').split(/\s+/);

  C.data.editorial = {
    crosswordBank: { en: EN, uk: UK, ru: RU }
  };
})(window.Console);

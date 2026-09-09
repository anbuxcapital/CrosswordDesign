/* Game library — the content editor's default screen.
   OWNER: editorial builder.
   Routes: #/library
   Use cases: E1 import a batch, E2 create or duplicate, entry point for E3–E7.

   This file also defines Console.editorial — the small set of helpers the
   editor screen shares with the library (id minting, blank content, validation,
   correction bookkeeping). editor.js loads after this file and calls them at
   click time, so the definition order below is the only coupling. */
(function (C) {
  'use strict';

  var el = C.ui.el;

  // =====================================================================
  // shared editorial helpers (Console.editorial)
  // =====================================================================

  var ED = {};

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  ED.clone = clone;

  /* Kind words come from Console.KIND_LABEL, defined once in app.js. These are
     thin aliases so this file reads the same as before. */
  ED.LANG_LABEL = { en: 'English', uk: 'Ukrainian', ru: 'Russian' };
  ED.LANGS = [['en', 'English'], ['uk', 'Ukrainian'], ['ru', 'Russian']];
  ED.LOCALE = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' };

  ED.kindLabel = C.kindLabel;
  ED.kindWord = C.kindWord;
  ED.langLabel = function (l) { return ED.LANG_LABEL[l] || l; };

  /* One difficulty enum per game. A crossword's hardest band is Hard; a
     Guessword's is Tricky, the word its difficulty estimate reports. */
  ED.DIFFICULTIES = {
    cw: [['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']],
    guessword: [['Easy', 'Easy'], ['Medium', 'Medium'], ['Tricky', 'Tricky']]
  };
  ED.difficulties = function (kind) { return ED.DIFFICULTIES[kind] || ED.DIFFICULTIES.cw; };

  /* Grid sizes a crossword can be built at, each with the par time it carries.
     The first entry is the default. */
  ED.GRID_SIZES = [
    { size: 5, par: 300, name: 'Mini' },
    { size: 9, par: 600, name: 'Weekend' }
  ];
  ED.parLabel = function (seconds) {
    var total = seconds || 0;
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  };
  ED.gridSizeOf = function (size) {
    return ED.GRID_SIZES.filter(function (g) { return g.size === size; })[0] || ED.GRID_SIZES[0];
  };
  ED.gridSizeLabel = function (g) {
    return g.name + ' ' + g.size + ' × ' + g.size + ' · par ' + ED.parLabel(g.par);
  };

  /* Mint the next free id for a kind. `taken` collects ids minted earlier in
     the same batch but not yet pushed into the store. */
  ED.nextId = function (kind, taken) {
    var prefix = C.kindIdPrefix(kind);
    var max = 0;
    C.store.puzzles.forEach(function (p) {
      if (p.id.indexOf(prefix) !== 0) return;
      var n = parseInt(p.id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    (taken || []).forEach(function (id) {
      if (id.indexOf(prefix) !== 0) return;
      var n = parseInt(id.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return prefix + String(max + 1).padStart(4, '0');
  };

  /* Empty content for a brand-new game. A crossword gets a blank square grid of
     the chosen size and its par time; its slots, numbers and clue rows are read
     off that grid rather than typed. A Guessword is one blank answer. */
  ED.blankContent = function (kind, size) {
    if (kind === 'guessword') return { answer: '' };
    var chosen = ED.gridSizeOf(size || ED.GRID_SIZES[0].size);
    var content = {
      size: chosen.size,
      par: chosen.par,
      grid: ED.emptyGrid(chosen.size),
      clues: { across: [], down: [] }
    };
    ED.cwSync(content);
    return content;
  };

  /* The side of a crossword grid, for content that predates the size field. */
  ED.gridSize = function (content) {
    return (content && (content.size || (content.grid || []).length)) || 5;
  };

  // ---------------------------------------------------------------------
  // the crossword grid — blocks, derived slots and numbering, and the live
  // checks the Content tab, the Validation tab and Approve all read. The grid
  // is the only thing an operator types letters into; everything else here is
  // derived from it, so a block toggle renumbers rather than renames.
  // ---------------------------------------------------------------------

  ED.BLOCK = '#';

  ED.emptyGrid = function (n) {
    var grid = [], r, c;
    for (r = 0; r < n; r++) {
      var row = [];
      for (c = 0; c < n; c++) row.push('');
      grid.push(row);
    }
    return grid;
  };

  /* ED.derive(content) → {size, grid, numbers, across, down, slots, slotAt, slotsAt}
     A cell starts an across slot when it is open, the cell to its left is a
     block or off the grid, and at least one open cell follows; the mirrored
     rule gives down slots. Numbers run in reading order, one per starting cell
     and shared by both directions. `across` then `down` is the canonical order
     the format stores and the Play screen walks. */
  ED.derive = function (content) {
    var size = ED.gridSize(content);
    var grid = (content && content.grid) || [];
    function open(r, c) {
      return r >= 0 && c >= 0 && r < size && c < size && (grid[r] || [])[c] !== ED.BLOCK;
    }
    var numbers = [], across = [], down = [], slots = [], n = 0, r, c;

    function walk(dir, num, r0, c0) {
      var cells = [], rr = r0, cc = c0;
      while (open(rr, cc)) {
        cells.push([rr, cc]);
        if (dir === 'across') cc += 1; else rr += 1;
      }
      var slot = { dir: dir, n: num, row: r0, col: c0, len: cells.length, cells: cells };
      slots.push(slot);
      (dir === 'across' ? across : down).push(slot);
    }

    for (r = 0; r < size; r++) {
      numbers.push([]);
      for (c = 0; c < size; c++) {
        numbers[r].push(null);
        if (!open(r, c)) continue;
        var startsAcross = !open(r, c - 1) && open(r, c + 1);
        var startsDown = !open(r - 1, c) && open(r + 1, c);
        if (!startsAcross && !startsDown) continue;
        n += 1;
        numbers[r][c] = n;
        if (startsAcross) walk('across', n, r, c);
        if (startsDown) walk('down', n, r, c);
      }
    }

    var index = {};
    slots.forEach(function (s) {
      s.cells.forEach(function (rc) {
        var k = rc[0] + ':' + rc[1];
        index[k] = index[k] || {};
        index[k][s.dir] = s;
      });
    });

    return {
      size: size, grid: grid, numbers: numbers,
      across: across, down: down, slots: slots,
      open: open,
      slotAt: function (rr, cc, dir) { return (index[rr + ':' + cc] || {})[dir] || null; },
      slotsAt: function (rr, cc) { return index[rr + ':' + cc] || {}; }
    };
  };

  ED.slotLetters = function (grid, slot) {
    return slot.cells.map(function (rc) {
      var ch = (grid[rc[0]] || [])[rc[1]];
      return ch === ED.BLOCK ? '' : (ch || '');
    });
  };

  /* The word a slot spells, or '' while any of its cells is still empty. */
  ED.slotWord = function (grid, slot) {
    var l = ED.slotLetters(grid, slot);
    return l.some(function (ch) { return !ch; }) ? '' : l.join('');
  };

  ED.slotName = function (slot) {
    return slot.n + '-' + (slot.dir === 'across' ? 'Across' : 'Down');
  };
  ED.cellName = function (r, c) { return 'Row ' + (r + 1) + ', column ' + (c + 1); };

  /* Clue text is bound to (row, col, direction), never to a number, so a block
     toggle that renumbers the grid never scrambles the clues. cwSync rebuilds
     the clue arrays from the derived slots, carrying each slot's own text and
     answer across, and is idempotent on content that is already canonical. */
  ED.cwSync = function (content) {
    var g = ED.derive(content);
    var old = content.clues || { across: [], down: [] };
    function bind(dir) {
      var prev = old[dir] || [];
      return (dir === 'across' ? g.across : g.down).map(function (s) {
        var was = prev.filter(function (cl) {
          return cl.row === s.row && cl.col === s.col;
        })[0];
        /* Content written before the (row, col) binding is matched by number. */
        if (!was) was = prev.filter(function (cl) { return cl.row == null && cl.n === s.n; })[0];
        return {
          n: s.n, row: s.row, col: s.col,
          answer: (was && was.answer) || '',
          clue: (was && was.clue) || ''
        };
      });
    }
    var next = { across: bind('across'), down: bind('down') };
    content.size = g.size;
    content.clues = next;
    return g;
  };

  ED.clueOf = function (content, slot) {
    return ((content.clues || {})[slot.dir] || []).filter(function (cl) {
      return cl.row === slot.row && cl.col === slot.col;
    })[0] || null;
  };

  /* The shape of a Mini: a 5 × 5 with no blocks, where across slot i and down
     slot i are the twins a word square makes identical. The pairing is read off
     the shape, so the same answer in a twinned pair is never counted as a
     duplicate even while the letters are still being typed. */
  ED.cwPairs = function (content) {
    var g = ED.derive(content);
    if (g.size !== 5 || g.across.length !== 5 || g.down.length !== 5) return null;
    var full = g.slots.every(function (s) { return s.len === 5; });
    if (!full) return null;
    var twin = {};
    g.down.forEach(function (s, i) { twin['down:' + s.n] = g.across[i] || null; });
    g.across.forEach(function (s, i) { twin['across:' + s.n] = g.down[i] || null; });
    return twin;
  };

  /* A word square reads the same across and down, so its across and down answer
     sets are identical. Each down slot then carries its across twin's clue
     until the editor rewrites it — a warning, not a block: the same sentence
     twice in the banner reads badly but is not invalid. */
  ED.wordSquare = function (content) {
    var twin = ED.cwPairs(content);
    if (!twin) return null;
    var grid = content.grid || [];
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < 5; c++) {
        var a = (grid[r] || [])[c] || '', b = (grid[c] || [])[r] || '';
        if (!a || a === ED.BLOCK || a !== b) return null;
      }
    }
    return twin;
  };

  /* Every down clue a completed word square can take from its across twin. */
  ED.prefillWordSquare = function (content) {
    var twin = ED.wordSquare(content);
    if (!twin) return 0;
    var filled = 0;
    (content.clues.down || []).forEach(function (cl) {
      if ((cl.clue || '').trim()) return;
      var pair = twin['down:' + cl.n];
      var src = pair && ED.clueOf(content, pair);
      if (!src || !(src.clue || '').trim()) return;
      cl.clue = src.clue;
      filled += 1;
    });
    return filled;
  };

  /* The crossword word bank, one list per language, in js/data/editorial.js. An
     answer outside it is a warning: the bank is a demo list, not a dictionary. */
  ED.cwBank = function (lang) {
    var banks = (C.data.editorial && C.data.editorial.crosswordBank) || {};
    return banks[lang] || banks.en || [];
  };
  ED.inCwBank = function (word, lang) { return ED.cwBank(lang).indexOf(word) >= 0; };

  ED.CLUE_MAX = 90;
  ED.CLUE_COUNT = 10;

  /* ED.cwChecks(puzzle) → [{code, label, ok:false, warn, message, target}]
     One line per failing occurrence, errors before warnings, each carrying the
     cell or the clue it opens. A clean grid returns an empty list. Nothing here
     ever blocks Save; the lines that are not warnings are what hold Approve. */
  ED.cwChecks = function (p) {
    var content = p.content || {};
    var grid = content.grid || [];
    var lang = p.lang;
    var langName = ED.langLabel(lang);
    var g = ED.derive(content);
    var errors = [], warnings = [];

    /* `quiet` lines are about the grid as a whole. They still walk to a cell,
       but they do not paint it: one red square out of twenty empty ones would
       read as a problem with that square. */
    function line(code, label, warn, message, target, quiet) {
      (warn ? warnings : errors).push({
        code: code, label: label, ok: false, warn: !!warn,
        message: message, target: target || null, quiet: !!quiet
      });
    }
    function cellAt(r, c, dir) { return { kind: 'cell', r: r, c: c, dir: dir || 'across' }; }
    function clueAt(slot) {
      return { kind: 'clue', dir: slot.dir, n: slot.n, r: slot.row, c: slot.col };
    }
    function letterAt(r, c) {
      var ch = (grid[r] || [])[c];
      return ch === ED.BLOCK ? '' : (ch || '');
    }

    var r, c;

    // 1 — unchecked letters, and cells no word runs through at all
    var uncheckedWarns = g.size >= 9;
    for (r = 0; r < g.size; r++) {
      for (c = 0; c < g.size; c++) {
        if (!g.open(r, c)) continue;
        var at = g.slotsAt(r, c);
        var only = at.across || at.down;
        if (at.across && at.down) continue;
        line('unchecked_letter', 'Unchecked letter', uncheckedWarns,
          ED.cellName(r, c) + (only
            ? ' is only in ' + ED.slotName(only) + ', so nothing crosses it'
            : ' is in no word at all'),
          cellAt(r, c, only ? only.dir : 'across'));
      }
    }

    // 2 — one connected region
    var openList = [];
    for (r = 0; r < g.size; r++) {
      for (c = 0; c < g.size; c++) if (g.open(r, c)) openList.push([r, c]);
    }
    if (openList.length) {
      var seen = {}, stack = [openList[0]], reached = 0;
      seen[openList[0][0] + ':' + openList[0][1]] = true;
      while (stack.length) {
        var cur = stack.pop();
        reached += 1;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (step) {
          var nr = cur[0] + step[0], nc = cur[1] + step[1], k = nr + ':' + nc;
          if (!g.open(nr, nc) || seen[k]) return;
          seen[k] = true;
          stack.push([nr, nc]);
        });
      }
      if (reached < openList.length) {
        var cut = openList.filter(function (rc) { return !seen[rc[0] + ':' + rc[1]]; });
        line('disconnected_region', 'Disconnected region', false,
          cut.length + ' open ' + (cut.length === 1 ? 'cell is' : 'cells are') +
          ' cut off from the rest of the grid, starting at ' + ED.cellName(cut[0][0], cut[0][1]),
          cellAt(cut[0][0], cut[0][1]));
      }
    }

    // 3 — no word shorter than three
    g.slots.forEach(function (s) {
      if (s.len >= 3) return;
      line('slot_short', 'Word too short', false,
        ED.slotName(s) + ' is ' + s.len + ' cells long. The shortest word is three',
        clueAt(s));
    });

    // 4 — cells still waiting for a letter, counted once
    var empties = [];
    for (r = 0; r < g.size; r++) {
      for (c = 0; c < g.size; c++) if (g.open(r, c) && !letterAt(r, c)) empties.push([r, c]);
    }
    if (empties.length) {
      line('grid_empty', 'Empty cells', false,
        empties.length + ' open ' + (empties.length === 1 ? 'cell is' : 'cells are') + ' still empty',
        cellAt(empties[0][0], empties[0][1]), true);
    }

    // 5 — the alphabet, and one script throughout. Counted once for the grid,
    // naming the first offending cell, so a wrong-alphabet import reads as one
    // problem rather than one per letter.
    var latin = [], cyrillic = [], strays = [];
    var alphabet = ED.ALPHABET[lang] || ED.ALPHABET.en;
    for (r = 0; r < g.size; r++) {
      for (c = 0; c < g.size; c++) {
        var ch = letterAt(r, c);
        if (!ch) continue;
        if (/[A-Za-z]/.test(ch)) latin.push([r, c, ch]);
        if (/[Ѐ-ӿ]/.test(ch)) cyrillic.push([r, c, ch]);
        if (alphabet.indexOf(ch) < 0) strays.push([r, c, ch]);
      }
    }
    var mixed = latin.length > 0 && cyrillic.length > 0;
    var lettersIn = latin.length + cyrillic.length;
    var wholeGrid = !mixed && lettersIn > 0 && strays.length === lettersIn;
    if (wholeGrid) {
      /* A grid written end to end in another alphabet is a language field to
         correct, not a run of typos, so it names the language and holds nothing
         back. */
      line('letter_alphabet', 'Alphabet', true,
        'Every letter is ' + (latin.length ? 'Latin' : 'Cyrillic') + ' and ' + p.id +
        ' is filed as ' + langName + '. Retype the grid or change the language',
        cellAt(strays[0][0], strays[0][1]), true);
    } else if (strays.length) {
      line('letter_alphabet', 'Alphabet', false,
        strays.length + ' ' + (strays.length === 1 ? 'cell holds a letter' : 'cells hold letters') +
        ' outside the ' + langName + ' alphabet, starting with ' + strays[0][2] + ' at ' +
        ED.cellName(strays[0][0], strays[0][1]),
        cellAt(strays[0][0], strays[0][1]));
    }
    if (mixed) {
      var odd = latin.length <= cyrillic.length ? latin : cyrillic;
      var oddName = latin.length <= cyrillic.length ? 'Latin' : 'Cyrillic';
      line('letter_script', 'Script', false,
        'The grid mixes Latin and Cyrillic. ' + odd.length + ' ' +
        (odd.length === 1 ? 'cell is' : 'cells are') + ' ' + oddName +
        ', starting at ' + ED.cellName(odd[0][0], odd[0][1]),
        cellAt(odd[0][0], odd[0][1]));
    }

    // 6 — the stored answer against the grid, per disagreeing cell
    var conflict = {};
    g.slots.forEach(function (s) {
      var cl = ED.clueOf(content, s);
      var stored = (cl && cl.answer) || '';
      if (!stored) return;
      var chars = ED.chars(stored);
      if (chars.length !== s.len) {
        line('answer_length', 'Answer length', false,
          ED.slotName(s) + ' is ' + s.len + ' cells and its answer ' + stored + ' is ' +
          chars.length + ' letters', clueAt(s));
        return;
      }
      var letters = ED.slotLetters(grid, s);
      chars.forEach(function (want, i) {
        if (!letters[i] || letters[i] === want) return;
        var rc = s.cells[i], k = rc[0] + ':' + rc[1];
        conflict[k] = conflict[k] || { r: rc[0], c: rc[1], has: letters[i], slots: [] };
        conflict[k].slots.push(ED.slotName(s) + ' is stored as ' + stored);
      });
    });
    Object.keys(conflict).forEach(function (k) {
      var x = conflict[k];
      line('grid_answer_mismatch', 'Crossing conflict', false,
        ED.cellName(x.r, x.c) + ' holds ' + x.has + ', and ' + x.slots.join(', '),
        cellAt(x.r, x.c));
    });

    // 7 — one clue per slot, counted per occurrence
    var sq = ED.wordSquare(content);
    var pairs = ED.cwPairs(content);
    var words = {};
    g.slots.forEach(function (s) {
      var cl = ED.clueOf(content, s);
      var text = ((cl && cl.clue) || '').trim();
      var word = ED.slotWord(grid, s);
      if (word) (words[word] = words[word] || []).push(s);

      if (!text) {
        line('clue_missing', 'Missing clue', false, 'No clue for ' + ED.slotName(s), clueAt(s));
      } else {
        // the clue must not give its own answer away
        if (word) {
          var hay = ED.normalizeAnswer(text, lang);
          var stems = [word];
          if (word.length - 1 >= 4) stems.push(word.slice(0, word.length - 1));
          if (word.length - 2 >= 4) stems.push(word.slice(0, word.length - 2));
          var hit = stems.filter(function (stem) { return hay.indexOf(stem) >= 0; })[0];
          if (hit) {
            line('clue_answer', 'Clue names its answer', false,
              'The clue for ' + ED.slotName(s) + ' contains ' + hit, clueAt(s));
          }
        }
        if (text.length > ED.CLUE_MAX) {
          line('clue_long', 'Clue length', true,
            'The clue for ' + ED.slotName(s) + ' is ' + text.length + ' characters. Over ' +
            ED.CLUE_MAX + ' the banner wraps past three lines', clueAt(s));
        }
        if (sq && s.dir === 'down') {
          var twin = sq['down:' + s.n];
          var twinClue = twin && ED.clueOf(content, twin);
          if (twinClue && (twinClue.clue || '').trim() === text) {
            line('word_square_clue', 'Repeated clue', true,
              ED.slotName(s) + ' still reads the same as ' + ED.slotName(twin), clueAt(s));
          }
        }
      }

      /* The bank is the language's own list, so it says nothing useful about a
         grid written in another alphabet. */
      if (word && !strays.length && !ED.inCwBank(word, lang)) {
        line('not_in_bank', 'Word bank', true,
          word + ' is not in the ' + langName + ' word bank', clueAt(s));
      }
    });

    // 8 — the same answer twice, unless the two slots are a word square's twins
    Object.keys(words).forEach(function (word) {
      var list = words[word];
      if (list.length < 2) return;
      if (pairs && list.length === 2) {
        var a = list.filter(function (s) { return s.dir === 'across'; })[0];
        var dn = list.filter(function (s) { return s.dir === 'down'; })[0];
        var pair = dn && pairs['down:' + dn.n];
        if (a && pair && pair.row === a.row && pair.col === a.col) return;
      }
      line('duplicate_answer', 'Duplicate answer', false,
        word + ' is the answer to ' + list.map(ED.slotName).join(' and '),
        clueAt(list[1]));
    });

    // 9 — the Play screen counts ten questions
    if (g.slots.length !== ED.CLUE_COUNT) {
      line('clue_count', 'Clue count', true,
        'The Play screen counts ten questions and this grid has ' + g.slots.length, null);
    }

    return errors.concat(warnings);
  };

  /* The one-line grid summary under the grid. */
  ED.cwStats = function (content, checks) {
    var g = ED.derive(content);
    var open = 0, filled = 0, r, c;
    for (r = 0; r < g.size; r++) {
      for (c = 0; c < g.size; c++) {
        if (!g.open(r, c)) continue;
        open += 1;
        if ((g.grid[r] || [])[c]) filled += 1;
      }
    }
    return {
      open: open,
      slots: g.slots.length,
      filled: filled,
      percent: open ? Math.round((filled / open) * 100) : 0,
      failing: (checks || []).length
    };
  };

  /* The `where` column of a validation issue, and the string the editor parses
     back into a selection when the issue is clicked. */
  ED.whereOf = function (target) {
    if (!target) return 'grid';
    if (target.kind === 'cell') return 'row ' + (target.r + 1) + ', column ' + (target.c + 1);
    return target.n + '-' + target.dir;
  };

  /* A known-good content block of the given kind, so imported drafts are real,
     previewable games rather than empty shells. A crossword is copied from one
     that already passes validation; a Guessword takes the first bank answer no
     game has claimed, so the import never mints a reuse. */
  ED.sampleContent = function (kind, lang, taken) {
    if (kind === 'guessword') return { answer: ED.freeAnswer(lang || 'en', taken) };
    /* A grid is only a sample for its own language: copying an English fill
       into a Ukrainian draft would import the wrong alphabet with it. */
    var src = C.store.puzzles.filter(function (p) {
      return p.kind === kind && p.validation === 'passed' && p.lang === lang;
    })[0];
    return src ? clone(src.content) : ED.blankContent(kind);
  };

  ED.newPuzzle = function (spec) {
    return {
      id: spec.id,
      title: spec.title,
      kind: spec.kind,
      lang: spec.lang,
      difficulty: spec.difficulty,
      status: 'draft',
      validation: 'not_run',
      validationIssues: [],
      version: spec.version || 1,
      author: spec.author || ((C.store.session.operator && C.store.session.operator.handle) || 'unknown'),
      topics: (spec.topics || []).slice(),
      updatedAt: nowStamp(),
      content: spec.content,
      correctionOf: spec.correctionOf || null,
      note: spec.note || ''
    };
  };

  function nowStamp() {
    var newest = C.store.audit[0];
    return newest ? newest.time : 'Sep 8 12:08';
  }
  ED.nowStamp = nowStamp;

  // ---------------------------------------------------------------------
  // the Guessword answer — normalization, the two word bank lists, the live
  // checks, the difficulty estimate and the board preview. The editor screen
  // reads all of these through Console.editorial.
  // ---------------------------------------------------------------------

  ED.ANSWER_LENGTH = 5;

  /* One alphabet per language. Russian folds Ё to Е before the check, so its
     33 letters are tested as 32. */
  ED.ALPHABET = {
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    uk: 'АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ',
    ru: 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
  };

  /* The player's three-row keyboard, for the board preview. */
  ED.KEYBOARD = {
    en: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    uk: ['ЙЦУКЕНГШЩЗХЇ', 'ФІВАПРОЛДЖЄ', 'ЯЧСМИТЬБЮҐ'],
    ru: ['ЙЦУКЕНГШЩЗХЪ', 'ФЫВАПРОЛДЖЭ', 'ЯЧСМИТЬБЮ']
  };

  ED.chars = function (w) { return Array.from(String(w == null ? '' : w)); };

  /* NFC first, then upper-case in the game's own locale, then fold Ё to Е. */
  ED.normalizeAnswer = function (raw, lang) {
    var s = String(raw == null ? '' : raw).trim();
    if (s.normalize) s = s.normalize('NFC');
    s = s.toLocaleUpperCase(ED.LOCALE[lang] || 'en-US');
    if (lang === 'ru') s = s.replace(/Ё/g, 'Е');
    return s;
  };
  ED.normalizeLetter = function (lang, ch) {
    return ED.chars(ED.normalizeAnswer(ch, lang))[0] || '';
  };

  /* The two lists for a language: `answers` is the curated answer bank, each
     entry {word, score}; `accepted` is the far larger list a player may type. */
  ED.bank = function (lang) {
    var banks = C.data.wordBank || {};
    return banks[lang] || banks.en || { answers: [], accepted: [] };
  };
  ED.bankEntry = function (word, lang) {
    return ED.bank(lang).answers.filter(function (a) { return a.word === word; })[0] || null;
  };
  ED.inAccepted = function (word, lang) {
    return ED.bank(lang).accepted.indexOf(word) >= 0;
  };

  /* The first bank answer no game in the library has claimed. */
  ED.freeAnswer = function (lang, taken) {
    var used = {};
    C.store.puzzles.forEach(function (p) {
      if (p.kind !== 'guessword' || p.lang !== lang) return;
      var w = ED.normalizeAnswer((p.content || {}).answer, p.lang);
      if (w) used[w] = true;
    });
    (taken || []).forEach(function (w) { used[w] = true; });
    var hit = ED.bank(lang).answers.filter(function (a) { return !used[a.word]; })[0];
    return hit ? hit.word : '';
  };

  /* The day a game drops on, or null while it is unplanned. */
  ED.dropLabel = function (id) {
    var day = C.store.days.filter(function (d) {
      return d.guesswordId === id || d.crosswordId === id;
    })[0];
    return day ? day.label : null;
  };

  /* Every answer a published, live or scheduled Guessword has already used,
     keyed by the word. Reuse is checked for ever rather than inside a window: a
     bank of thousands of words against ~365 answers a year affords that. */
  var USED_STATES = ['published', 'live', 'scheduled'];
  ED.usedAnswers = function (lang, exceptId) {
    var used = {};
    C.store.puzzles.forEach(function (p) {
      if (p.kind !== 'guessword' || p.id === exceptId) return;
      if (lang && p.lang !== lang) return;
      if (USED_STATES.indexOf(p.status) < 0) return;
      var w = ED.normalizeAnswer((p.content || {}).answer, p.lang);
      if (!w || used[w]) return;
      used[w] = { id: p.id, title: p.title, drop: ED.dropLabel(p.id) };
    });
    return used;
  };

  /* A crossword already planned in the same language whose grid answers this
     word. A warning, never a block. */
  ED.crosswordClash = function (word, lang) {
    var hit = null;
    C.store.days.forEach(function (day) {
      if (hit || !day.crosswordId) return;
      var cw = C.find.puzzle(day.crosswordId);
      if (!cw || cw.lang !== lang) return;
      var clues = (cw.content && cw.content.clues) || {};
      var found = ['across', 'down'].some(function (dir) {
        return (clues[dir] || []).some(function (cl) {
          return ED.normalizeAnswer(cl.answer, lang) === word;
        });
      });
      if (found) hit = { id: cw.id, title: cw.title, day: day.longLabel || day.label };
    });
    return hit;
  };

  var NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  function countWord(n, one, many) {
    return (NUMBER_WORD[n] || n) + ' ' + (n === 1 ? one : many);
  }

  /* ED.answerChecks(answer, lang, exceptId) → [{code, label, ok, warn, message, goTo}]
     One line per check, in the order the research lists them, each naming its
     own failure so every problem is visible at once. A line with `ok:false`
     blocks Approve; a `warn` line blocks nothing. No check ever blocks Save. */
  ED.answerChecks = function (raw, lang, exceptId) {
    var w = ED.normalizeAnswer(raw, lang);
    var letters = ED.chars(w);
    var langName = ED.langLabel(lang);
    var out = [];
    function line(code, label, ok, message, goTo) {
      out.push({ code: code, label: label, ok: ok, warn: false, message: message, goTo: goTo || null });
    }

    if (!letters.length) {
      return [{
        code: 'answer_missing', label: 'Answer', ok: false, warn: false,
        message: 'The ' + C.kindWord('guessword') + ' has no answer yet', goTo: null
      }];
    }

    // 1 — length
    line('answer_length', 'Length', letters.length === ED.ANSWER_LENGTH,
      letters.length === ED.ANSWER_LENGTH
        ? 'Five letters'
        : w + ' is ' + countWord(letters.length, 'letter', 'letters') +
          '. The answer must be exactly five letters');

    // 2 — alphabet
    var alphabet = ED.ALPHABET[lang] || ED.ALPHABET.en;
    var strays = [];
    letters.forEach(function (ch, i) {
      if (alphabet.indexOf(ch) < 0) strays.push(ch + ' in position ' + (i + 1));
    });
    var named = strays.slice(0, 3).join(' · ') +
      (strays.length > 3 ? ' and ' + (strays.length - 3) + ' more' : '');
    line('answer_alphabet', 'Alphabet', !strays.length,
      strays.length
        ? named + (strays.length === 1 ? ' is' : ' are') + ' not in the ' + langName + ' alphabet'
        : 'Every letter is in the ' + langName + ' alphabet');

    // 3 — script
    var latin = letters.filter(function (ch) { return /[A-Za-z]/.test(ch); });
    var cyrillic = letters.filter(function (ch) { return /[Ѐ-ӿ]/.test(ch); });
    var mixed = latin.length > 0 && cyrillic.length > 0;
    var odd = latin.length <= cyrillic.length ? latin : cyrillic;
    var oddScript = latin.length <= cyrillic.length ? 'Latin' : 'Cyrillic';
    line('answer_script', 'Script', !mixed,
      mixed
        ? w + ' mixes Latin and Cyrillic letters: ' + odd.join(', ') + ' ' +
          (odd.length === 1 ? 'is' : 'are') + ' ' + oddScript
        : 'One script throughout');

    // 4 — answer bank
    var entry = ED.bankEntry(w, lang);
    line('answer_bank', 'Answer bank', !!entry,
      entry ? 'In the ' + langName + ' answer bank'
        : w + ' is not in the ' + langName + ' answer bank');

    // 5 — accepted guesses
    var typeable = ED.inAccepted(w, lang);
    line('answer_accepted', 'Accepted guesses', typeable,
      typeable ? 'In the ' + langName + ' accepted-guess list'
        : w + ' is not in the ' + langName + ' accepted-guess list, so a player who types it would be rejected');

    // 6 — reuse
    var prior = ED.usedAnswers(lang, exceptId)[w];
    line('answer_reuse', 'Reuse', !prior,
      prior
        ? w + ' was the answer to ' + prior.id + ' “' + prior.title + '”' +
          (prior.drop ? ' on ' + prior.drop : '')
        : 'Never used as an answer before',
      prior ? prior.id : null);

    // 7 — same-day clash with a planned crossword (a warning)
    var clash = ED.crosswordClash(w, lang);
    out.push({
      code: 'answer_clash', label: 'Crossword clash', ok: !clash, warn: true,
      message: clash
        ? w + ' is also an answer in ' + clash.id + ', the ' + C.kindWord('cw') +
          ' planned for ' + clash.day
        : 'No planned ' + C.kindWord('cw') + ' answers this word',
      goTo: clash ? clash.id : null
    });

    return out;
  };

  /* The checks that hold Approve back: everything failing that is not a warning. */
  ED.blockingChecks = function (checks) {
    return checks.filter(function (c) { return !c.ok && !c.warn; });
  };

  // -- difficulty estimate ----------------------------------------------

  ED.DIFFICULTY_THRESHOLDS = {
    rarity: 'band 1–2 → 0 · 3 → 1 · 4–5 → 2',
    neighbours: '0–2 → 0 · 3–5 → 1 · 6 or more → 2',
    repeated: 'none → 0 · a repeated letter → 1',
    rare: '0 → 0 · 1 → 1 · 2 or more → 2',
    band: 'Easy 0–1 · Medium 2–4 · Tricky 5 or more'
  };

  /* The ten most frequent letters in a language's answer bank. */
  var commonCache = {};
  ED.commonLetters = function (lang) {
    if (commonCache[lang]) return commonCache[lang];
    var freq = {};
    ED.bank(lang).answers.forEach(function (a) {
      ED.chars(a.word).forEach(function (ch) { freq[ch] = (freq[ch] || 0) + 1; });
    });
    var top = Object.keys(freq).sort(function (a, b) {
      return freq[b] - freq[a] || (a < b ? -1 : 1);
    }).slice(0, 10);
    commonCache[lang] = top;
    return top;
  };

  /* ED.difficultyOf(answer, lang) → {band, points, counts:[{label,value,points,threshold}]}
     Four counts an operator can reconcile, each mapped to points by a published
     threshold, never a hidden composite score. */
  ED.difficultyOf = function (raw, lang) {
    var w = ED.normalizeAnswer(raw, lang);
    var letters = ED.chars(w);
    var entry = ED.bankEntry(w, lang);
    var score = entry ? entry.score : null;

    var neighbours = 0;
    if (letters.length === ED.ANSWER_LENGTH) {
      ED.bank(lang).answers.forEach(function (a) {
        if (a.word === w) return;
        var other = ED.chars(a.word);
        if (other.length !== letters.length) return;
        var diff = 0;
        for (var i = 0; i < letters.length; i++) if (other[i] !== letters[i]) diff++;
        if (diff === 1) neighbours++;
      });
    }

    var seen = {}, repeated = false;
    letters.forEach(function (ch) {
      if (seen[ch]) repeated = true;
      seen[ch] = true;
    });

    var common = ED.commonLetters(lang);
    var rare = letters.filter(function (ch) { return common.indexOf(ch) < 0; }).length;

    var rarityPoints = score == null ? 0 : score >= 4 ? 2 : score === 3 ? 1 : 0;
    var neighbourPoints = neighbours >= 6 ? 2 : neighbours >= 3 ? 1 : 0;
    var repeatedPoints = repeated ? 1 : 0;
    var rarePoints = rare >= 2 ? 2 : rare === 1 ? 1 : 0;
    var points = rarityPoints + neighbourPoints + repeatedPoints + rarePoints;

    return {
      band: points <= 1 ? 'Easy' : points <= 4 ? 'Medium' : 'Tricky',
      points: points,
      counts: [
        {
          label: 'Rarity band in the ' + ED.langLabel(lang) + ' bank',
          value: score == null ? 'Not in the bank' : score + ' of 5',
          points: rarityPoints, threshold: ED.DIFFICULTY_THRESHOLDS.rarity
        },
        {
          label: 'Bank answers one letter away',
          value: String(neighbours),
          points: neighbourPoints, threshold: ED.DIFFICULTY_THRESHOLDS.neighbours
        },
        {
          label: 'Repeated letter',
          value: repeated ? 'Yes' : 'No',
          points: repeatedPoints, threshold: ED.DIFFICULTY_THRESHOLDS.repeated
        },
        {
          label: 'Letters outside the ten most frequent',
          value: String(rare),
          points: rarePoints, threshold: ED.DIFFICULTY_THRESHOLDS.rare
        }
      ]
    };
  };

  // -- board preview ----------------------------------------------------

  /* ED.markGuess(guess, answer) → ['exact'|'present'|'absent' × 5]. An exact
     match claims its letter before any present match can. */
  ED.markGuess = function (guess, answer) {
    var g = ED.chars(guess), a = ED.chars(answer);
    var marks = g.map(function () { return 'absent'; });
    var pool = {};
    a.forEach(function (ch, i) { if (g[i] !== ch) pool[ch] = (pool[ch] || 0) + 1; });
    g.forEach(function (ch, i) { if (a[i] === ch) marks[i] = 'exact'; });
    g.forEach(function (ch, i) {
      if (marks[i] === 'exact') return;
      if (pool[ch] > 0) { marks[i] = 'present'; pool[ch] -= 1; }
    });
    return marks;
  };

  /* One worked guess for the preview: the first accepted word that shows exact,
     present and absent at once. */
  ED.workedGuess = function (answer, lang) {
    var a = ED.normalizeAnswer(answer, lang);
    if (ED.chars(a).length !== ED.ANSWER_LENGTH) return null;
    var best = null, fallback = null;
    ED.bank(lang).accepted.forEach(function (word) {
      if (best || word === a || ED.chars(word).length !== ED.ANSWER_LENGTH) return;
      var marks = ED.markGuess(word, a);
      function count(state) { return marks.filter(function (m) { return m === state; }).length; }
      if (!fallback) fallback = { word: word, marks: marks };
      if (count('exact') && count('present') && count('absent')) best = { word: word, marks: marks };
    });
    return best || fallback;
  };

  // ---------------------------------------------------------------------
  // validation (E4). Deterministic, runs against whatever content is on
  // screen, so filling a missing clue really does clear its issue.
  // ---------------------------------------------------------------------

  var MAX_ISSUES = 12;

  /* ED.validate(puzzle) → [{code, where, message}] */
  ED.validate = function (p) {
    var issues = [];
    var c = p.content || {};

    if (!(p.title || '').trim()) {
      issues.push({ code: 'title_missing', where: 'metadata', message: 'The game needs a title before it can be approved' });
    }
    if (!(p.topics || []).length) {
      issues.push({ code: 'topic_missing', where: 'metadata', message: 'At least one topic is required before approval' });
    }

    if (p.kind === 'cw') {
      /* The grid, the slots and the clues run the same live checks the Content
         tab paints, so a rule is written once. Warnings are not issues: they
         never block Approve. */
      ED.cwChecks(p).forEach(function (chk) {
        if (chk.warn) return;
        issues.push({ code: chk.code, where: ED.whereOf(chk.target), message: chk.message });
      });
    } else {
      /* One answer, and the same live checks the constructor and the Content
         tab run. Warnings are not issues: they never block Approve. */
      ED.blockingChecks(ED.answerChecks(c.answer, p.lang, p.id)).forEach(function (chk) {
        issues.push({ code: chk.code, where: 'answer', message: chk.message });
      });
    }

    if (issues.length > MAX_ISSUES) {
      var extra = issues.length - MAX_ISSUES;
      issues = issues.slice(0, MAX_ISSUES);
      issues.push({
        code: 'more', where: 'grid',
        message: extra + ' further ' + (extra === 1 ? 'issue is' : 'issues are') + ' hidden. Fix these first and run validation again'
      });
    }
    return issues;
  };

  ED.summary = function (issues) {
    if (!issues.length) return 'Validation passed';
    return 'Validation failed · ' + issues.length + (issues.length === 1 ? ' issue' : ' issues');
  };

  // ---------------------------------------------------------------------
  // shared Guessword views — the answer field, its check lines, the difficulty
  // panel and the board preview. The constructor and the editor draw the same
  // nodes, so a rule is stated once and read in both places.
  // ---------------------------------------------------------------------

  /* Five character cells that behave as one field: one upper-cased letter each,
     typing walks forward, Backspace walks back, a paste fills the row. */
  ED.answerCells = function (spec) {
    var lang = spec.lang;
    var letters = ED.chars(ED.normalizeAnswer(spec.value, lang)).slice(0, ED.ANSWER_LENGTH);
    var row = el('div', 'ans-cells');
    var inputs = [];

    function value() { return inputs.map(function (n) { return n.value; }).join(''); }
    function changed() { if (spec.onChange) spec.onChange(value()); }

    function cell(i) {
      var input = el('input', 'ans-cell');
      input.type = 'text';
      input.value = letters[i] || '';
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('aria-label', 'Answer letter ' + (i + 1) + ' of ' + ED.ANSWER_LENGTH);
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('input', function () {
        var typed = ED.chars(ED.normalizeAnswer(input.value, lang));
        input.value = typed[typed.length - 1] || '';
        if (input.value && i < ED.ANSWER_LENGTH - 1) inputs[i + 1].focus();
        changed();
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          e.preventDefault();
          inputs[i - 1].value = '';
          inputs[i - 1].focus();
          changed();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault(); inputs[i - 1].focus();
        } else if (e.key === 'ArrowRight' && i < ED.ANSWER_LENGTH - 1) {
          e.preventDefault(); inputs[i + 1].focus();
        }
      });
      input.addEventListener('paste', function (e) {
        var text = (e.clipboardData || window.clipboardData || {}).getData('text');
        if (!text) return;
        e.preventDefault();
        var chars = ED.chars(ED.normalizeAnswer(text, lang));
        for (var k = 0; k < chars.length && i + k < ED.ANSWER_LENGTH; k++) inputs[i + k].value = chars[k];
        inputs[Math.min(ED.ANSWER_LENGTH - 1, i + chars.length)].focus();
        changed();
      });
      return input;
    }

    for (var i = 0; i < ED.ANSWER_LENGTH; i++) {
      var input = cell(i);
      inputs.push(input);
      row.appendChild(input);
    }

    row.value = value;
    row.focusNext = function () {
      (inputs.filter(function (n) { return !n.value; })[0] || inputs[ED.ANSWER_LENGTH - 1]).focus();
    };
    row.focus = row.focusNext;   // so the validation tab can send focus here
    return row;
  };

  /* One line per check. A failed line that names another game opens it; a line
     that carries `onGo` runs it instead, which is how a crossword check walks
     to the cell or the clue it is about. */
  ED.checkList = function (checks) {
    var wrap = el('div', 'checks');
    checks.forEach(function (c) {
      var tone = c.ok ? 'ok' : c.warn ? 'warn' : 'bad';
      var link = c.onGo || (!c.ok && c.goTo);
      var node = el(link ? 'button' : 'div', 'check-line is-' + tone);
      if (link) {
        node.type = 'button';
        node.addEventListener('click', function () {
          if (c.onGo) { c.onGo(); return; }
          C.ui.closeModal();
          C.go('#/library/' + c.goTo);
        });
      }
      node.appendChild(el('span', 'check-mark', c.ok ? '✓' : c.warn ? '!' : '✕'));
      node.appendChild(el('span', 'check-name', c.label));
      node.appendChild(el('span', 'check-msg', c.message));
      wrap.appendChild(node);
    });
    return wrap;
  };

  /* The computed band beside the chosen target, with the four counts it is made
     of and the threshold each one is read against. */
  ED.difficultyPanel = function (answer, lang, target) {
    var d = ED.difficultyOf(answer, lang);
    var mismatch = !!target && target !== d.band;
    var wrap = el('div', 'diff-panel');

    var head = el('div', 'diff-head' + (mismatch ? ' is-warn' : ''));
    if (mismatch) head.appendChild(el('span', 'check-mark', '!'));
    head.appendChild(el('span', 'diff-band', d.band));
    if (target) head.appendChild(el('span', 'diff-target', 'target ' + target));
    head.appendChild(el('div', 'spacer'));
    head.appendChild(el('span', 'diff-t', d.points + ' of 7 · ' + ED.DIFFICULTY_THRESHOLDS.band));
    wrap.appendChild(head);

    d.counts.forEach(function (c) {
      var row = el('div', 'diff-row');
      row.appendChild(el('span', 'diff-k', c.label));
      row.appendChild(el('span', 'diff-v', c.value));
      row.appendChild(el('span', 'diff-p', '+' + c.points));
      row.appendChild(el('div', 'spacer'));
      row.appendChild(el('span', 'diff-t', c.threshold));
      wrap.appendChild(row);
    });
    return wrap;
  };

  /* Six rows of five tiles with one worked guess, and the same states carried
     onto the language's keyboard. The last row is the reveal after six failed
     guesses; `reveal:false` draws it blank, as a player would see it, and
     `compact:true` shrinks the board to fit inside the phone frame. */
  ED.boardPreview = function (answer, lang, opts) {
    opts = opts || {};
    var a = ED.normalizeAnswer(answer, lang);
    var guess = ED.workedGuess(a, lang);
    var keyState = {};
    var wrap = el('div', 'gw-board' + (opts.compact ? ' is-compact' : ''));

    var rows = el('div', 'gw-rows');
    for (var r = 0; r < 6; r++) {
      var line = el('div', 'gw-row' + (r === 5 ? ' is-reveal' : ''));
      var tag = el('span', 'gw-row-tag', r === 0 ? 'Guess 1' : r === 5 ? 'Reveal' : '');
      line.appendChild(tag);
      for (var i = 0; i < ED.ANSWER_LENGTH; i++) {
        var ch = '', state = 'empty';
        if (r === 0 && guess) {
          ch = ED.chars(guess.word)[i] || '';
          state = guess.marks[i];
          if (state === 'exact' || !keyState[ch]) keyState[ch] = state;
        } else if (r === 5 && opts.reveal !== false) {
          ch = ED.chars(a)[i] || '';
          state = ch ? 'exact' : 'empty';
        }
        line.appendChild(el('div', 'gw-tile is-' + state, ch));
      }
      rows.appendChild(line);
    }
    wrap.appendChild(rows);

    var keys = el('div', 'gw-keys');
    (ED.KEYBOARD[lang] || ED.KEYBOARD.en).forEach(function (rowStr) {
      var kr = el('div', 'gw-key-row');
      ED.chars(rowStr).forEach(function (ch) {
        kr.appendChild(el('span', 'gw-key is-' + (keyState[ch] || 'idle'), ch));
      });
      keys.appendChild(kr);
    });
    wrap.appendChild(keys);
    return wrap;
  };

  C.editorial = ED;

  // =====================================================================
  // screen state
  // =====================================================================

  /* Per-screen UI state lives on the store so it survives the full re-render
     that follows every commit. The operations builder writes
     store.ui.library.filter (or navigates to #/library?status=…) before
     handing over from O2/O3; both routes are supported. */
  C.store.ui.library = C.store.ui.library || {};
  var LIB = C.store.ui.library;
  if (LIB.tab == null) LIB.tab = 'cw';
  if (LIB.filter == null) LIB.filter = 'all';
  if (LIB.status == null) LIB.status = null;
  if (LIB.lang == null) LIB.lang = 'all';
  if (LIB.q == null) LIB.q = '';
  if (LIB.selected == null) LIB.selected = [];

  function st() { return C.store.ui.library; }

  /* The two kinds are the tabs, so the chip row carries only the states a
     content editor filters by within one kind. */
  var CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'review', label: 'Needs review' },
    { key: 'failed', label: 'Validation failed' }
  ];
  var CHIP_KEYS = CHIPS.map(function (c) { return c.key; });
  var STATUS_KEYS = ['draft', 'review', 'approved', 'scheduled', 'published', 'live'];

  /* One tab per kind. Crossword is a common noun and counts, so its tab is
     plural; Guessword is the game's name and stands alone. */
  var TABS = [
    { key: 'cw', label: C.kindLabelPlural('cw') },
    { key: 'guessword', label: C.kindLabel('guessword') }
  ];

  function activeTab() { return st().tab === 'guessword' ? 'guessword' : 'cw'; }

  function ofTab(list) {
    var k = activeTab();
    return list.filter(function (p) { return p.kind === k; });
  }

  // ---------------------------------------------------------------------
  // query hints — #/library?status=approved&kind=guessword&lang=en
  // The shell router splits the hash on "/" and would not match a route with a
  // query string, so the hint is consumed and stripped before the router sees
  // it. This listener is registered while the file loads, which is before
  // Console.boot() adds the router's own hashchange listener, so it runs first.
  // ---------------------------------------------------------------------

  function applyHints(query) {
    var s = st();
    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = decodeURIComponent(i < 0 ? '' : pair.slice(i + 1));
      if (k === 'kind' && (v === 'cw' || v === 'guessword')) s.tab = v;
      else if (k === 'status') s.status = STATUS_KEYS.indexOf(v) >= 0 ? v : null;
      else if (k === 'lang') s.lang = ED.LANG_LABEL[v] ? v : 'all';
      else if (k === 'q') s.q = v;
      else if (k === 'filter') s.filter = v;
      else if (k === 'tab' && (v === 'cw' || v === 'guessword')) s.tab = v;
    });
    s.selected = [];
  }

  function normalizeHash() {
    var raw = location.hash || '';
    var qi = raw.indexOf('?');
    if (qi < 0) return;
    var base = raw.slice(0, qi);
    if (base !== '#/library') return;
    applyHints(raw.slice(qi + 1));
    location.hash = base;   // the router then sees a clean, matchable route
  }

  window.addEventListener('hashchange', normalizeHash);
  normalizeHash();

  // ---------------------------------------------------------------------
  // filtering
  // ---------------------------------------------------------------------

  function activeFilter() {
    var f = st().filter;
    // Tolerate a status key written straight into `filter` by another builder.
    return CHIP_KEYS.indexOf(f) >= 0 ? f : 'all';
  }

  function activeStatus() {
    var f = st().filter;
    if (STATUS_KEYS.indexOf(f) >= 0) return f;
    return STATUS_KEYS.indexOf(st().status) >= 0 ? st().status : null;
  }

  function rows() {
    var f = activeFilter();
    var status = activeStatus();
    var lang = st().lang;
    var q = st().q.trim().toLowerCase();

    return ofTab(C.store.puzzles).filter(function (p) {
      if (f === 'review' && p.status !== 'review') return false;
      if (f === 'failed' && p.validation !== 'failed') return false;
      if (status && p.status !== status) return false;
      if (lang !== 'all' && p.lang !== lang) return false;
      if (!q) return true;
      return (p.id + ' ' + p.title + ' ' + p.author + ' ' + (p.topics || []).join(' ')).toLowerCase().indexOf(q) >= 0;
    });
  }

  function isPublished(p) { return p.status === 'published' || p.status === 'live'; }

  // ---------------------------------------------------------------------
  // E1 — import a puzzle batch
  // ---------------------------------------------------------------------

  var IMPORT_FILES = [
    {
      name: '2026-37-crosswords.json', size: '18 KB', items: [
        { title: 'Harbour lights', kind: 'cw', lang: 'en', difficulty: 'Medium', topics: ['Travel'], outcome: 'ok' },
        { title: 'Paper lantern', kind: 'cw', lang: 'en', difficulty: 'Easy', topics: ['Home'], outcome: 'ok' },
        { title: 'Crossed wires', kind: 'cw', lang: 'en', difficulty: 'Hard', topics: ['Science'], outcome: 'failed', detail: 'Row 4 spells NRTSE, which is not in the English word bank' }
      ]
    },
    {
      name: '2026-37-guessword.json', size: '6 KB', items: [
        { title: 'Second wind', kind: 'guessword', lang: 'en', difficulty: 'Easy', topics: ['Sport'], outcome: 'ok' },
        { title: 'Loose change', kind: 'guessword', lang: 'en', difficulty: 'Medium', topics: ['Everyday'], outcome: 'ok' },
        { title: 'Deep water', kind: 'guessword', lang: 'en', difficulty: 'Tricky', topics: ['Nature'], outcome: 'ok' }
      ]
    },
    {
      name: 'uk-batch-04.json', size: '9 KB', items: [
        { title: 'Львівська кава', kind: 'cw', lang: 'uk', difficulty: 'Medium', topics: ['City'], outcome: 'ok' },
        { title: 'Осінній вітер', kind: 'guessword', lang: 'uk', difficulty: 'Medium', topics: ['Nature'], outcome: 'failed', detail: 'The answer СНІГ is four letters, not five' }
      ]
    },
    {
      name: 'retry-CW-2270.json', size: '2 KB', items: [
        { title: 'Paper trail (retry)', kind: 'cw', lang: 'uk', difficulty: 'Medium', topics: ['Work'], outcome: 'ok' }
      ]
    }
  ];

  function importFlow() {
    var picked = IMPORT_FILES.map(function (f) { return f.name; });

    function chosenFiles() {
      return IMPORT_FILES.filter(function (f) { return picked.indexOf(f.name) >= 0; });
    }
    function chosenItems() {
      var out = [];
      chosenFiles().forEach(function (f) {
        f.items.forEach(function (it) { out.push(Object.assign({ file: f.name }, it)); });
      });
      return out;
    }

    // -- step 1 ---------------------------------------------------------
    function step1() {
      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 1 of 3 · Pick files.'));
      var list = el('div');
      list.style.marginTop = '12px';
      IMPORT_FILES.forEach(function (f) {
        var on = picked.indexOf(f.name) >= 0;
        var row = el('div', 'check-row' + (on ? ' is-on' : ''));
        var box = el('button', 'checkbox' + (on ? ' is-on' : ''), on ? '✓' : '');
        box.type = 'button';
        box.setAttribute('aria-pressed', String(on));
        box.setAttribute('aria-label', (on ? 'Deselect ' : 'Select ') + f.name);
        box.addEventListener('click', function () {
          picked = on ? picked.filter(function (n) { return n !== f.name; }) : picked.concat([f.name]);
          step1();
        });
        row.appendChild(box);
        var txt = el('div', 'check-row-text');
        txt.appendChild(el('div', 'check-row-label', f.name));
        txt.appendChild(el('div', 'check-row-detail', f.items.length + ' game' + (f.items.length === 1 ? '' : 's') + ' · ' + f.size + ' · JSON'));
        row.appendChild(txt);
        row.appendChild(el('div', 'spacer'));
        row.appendChild(C.ui.status(f.items.some(function (i) { return i.outcome === 'failed'; }) ? 'warn' : 'ok',
          f.items.some(function (i) { return i.outcome === 'failed'; }) ? 'Contains rejects' : 'Reads cleanly'));
        list.appendChild(row);
      });
      body.appendChild(list);

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Cancel' },
        primary: {
          label: 'Validate ' + chosenItems().length + ' games',
          disabled: function () { return !picked.length; },
          onClick: step2
        }
      });
    }

    // -- step 2 ---------------------------------------------------------
    function step2() {
      var items = chosenItems();
      var accepted = items.filter(function (i) { return i.outcome === 'ok'; });
      var rejected = items.filter(function (i) { return i.outcome !== 'ok'; });

      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 2 of 3 · Validation summary. Rejected games are not imported.'));

      var cards = el('div', 'cards-3');
      cards.style.margin = '12px 0';
      [['Files', chosenFiles().length],
       ['Accepted', accepted.length],
       ['Rejected', rejected.length]].forEach(function (s) {
        var c = el('div', 'stat');
        c.appendChild(el('div', 'eyebrow', s[0]));
        c.appendChild(el('div', 'stat-value', String(s[1])));
        cards.appendChild(c);
      });
      body.appendChild(cards);

      body.appendChild(C.ui.results(items.map(function (i) {
        return {
          label: i.title + ' · ' + ED.kindLabel(i.kind) + ' · ' + ED.langLabel(i.lang),
          outcome: i.outcome === 'ok' ? 'ok' : 'failed',
          outcomeLabel: i.outcome === 'ok' ? 'Accepted' : 'Rejected',
          detail: i.outcome === 'ok' ? i.file : i.detail
        };
      })));

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Back', onClick: step1 },
        primary: {
          label: 'Review import',
          disabled: function () { return !accepted.length; },
          onClick: function () { step3(accepted, rejected, items); }
        }
      });
    }

    // -- step 3 ---------------------------------------------------------
    function step3(accepted, rejected, items) {
      var body = el('div');
      body.appendChild(el('div', 'help', 'Step 3 of 3 · Confirm.'));
      var wrap = el('div');
      wrap.style.marginTop = '12px';
      wrap.appendChild(C.ui.reviewPanel({
        title: 'Review the import',
        before: [
          ['Library', C.store.puzzles.length + ' games'],
          ['Drafts', C.store.puzzles.filter(function (p) { return p.status === 'draft'; }).length + ' drafts'],
          ['Import batches', C.store.importBatches.length + ' batches']
        ],
        after: [
          ['Library', (C.store.puzzles.length + accepted.length) + ' games'],
          ['Drafts', (C.store.puzzles.filter(function (p) { return p.status === 'draft'; }).length + accepted.length) + ' drafts'],
          ['Import batches', (C.store.importBatches.length + 1) + ' batches']
        ],
        consequence: accepted.length + ' games are created as Draft. Nothing is scheduled or published.'
      }));
      body.appendChild(wrap);

      C.ui.modal({
        title: 'Import games',
        body: body,
        wide: true,
        secondary: { label: 'Back', onClick: step2 },
        primary: {
          label: 'Import ' + accepted.length + ' games',
          onClick: function () { doImport(accepted, rejected, items); }
        }
      });
    }

    function doImport(accepted, rejected, items) {
      var taken = [], answers = [];
      var created = accepted.map(function (i) {
        var id = ED.nextId(i.kind, taken);
        taken.push(id);
        var content = ED.sampleContent(i.kind, i.lang, answers);
        if (content.answer) answers.push(content.answer);
        return ED.newPuzzle({
          id: id, title: i.title, kind: i.kind, lang: i.lang,
          difficulty: i.difficulty, topics: i.topics,
          content: content,
          note: 'Imported from ' + i.file
        });
      });

      var batchId = 'batch_import_' + (C.store.importBatches.length + 1);
      var sources = chosenFiles().map(function (f) { return f.name; }).join(', ');

      C.commit({
        action: 'Import games',
        object: batchId,
        reason: '',
        result: created.length + ' drafts created from ' + chosenFiles().length + ' files · ' +
          rejected.length + ' rejected · ' + created.map(function (p) { return p.id; }).join(', '),
        apply: function (store) {
          created.forEach(function (p) { store.puzzles.push(p); });
          store.importBatches.unshift({
            id: batchId,
            when: ED.nowStamp(),
            operator: (store.session.operator && store.session.operator.handle) || 'unknown',
            source: sources,
            accepted: created.length,
            rejected: rejected.length,
            items: items.map(function (i, n) {
              var made = i.outcome === 'ok' ? created[accepted.indexOf(i)] : null;
              return {
                label: (made ? made.id + ' ' : '') + i.title,
                outcome: i.outcome === 'ok' ? 'ok' : 'failed',
                detail: i.outcome === 'ok' ? 'Draft created from ' + i.file : i.detail
              };
            })
          });
          st().filter = 'all';
          st().status = 'draft';
          st().lang = 'all';
          st().q = '';
          st().selected = created.map(function (p) { return p.id; });
        },
        silent: true
      });

      var body = el('div');
      var res = el('div');
      res.appendChild(C.ui.results(created.map(function (p) {
        return { label: p.id + ' ' + p.title, outcome: 'ok', outcomeLabel: 'Created', detail: 'Draft · validation not run' };
      }).concat(rejected.map(function (i) {
        return { label: i.title, outcome: 'failed', outcomeLabel: 'Rejected', detail: i.detail };
      }))));
      body.appendChild(res);

      C.ui.modal({
        title: 'Import complete',
        body: body,
        wide: true,
        primary: {
          label: 'Done',
          onClick: function () { C.ui.closeModal(); C.render(); }
        }
      });
      C.toast(created.length + ' drafts imported.');
    }

    step1();
  }

  // ---------------------------------------------------------------------
  // E2 — one constructor per game, and duplicate as draft
  // ---------------------------------------------------------------------

  /* Both constructors share the rows every game carries. Each builder appends
     its own rows and hands back the finished draft to `createDraft`. */

  function titleRow(draft, opts) {
    opts = opts || {};
    var row = el('div', 'form-row');
    var lab = el('label', 'label', 'Title');
    if (opts.required !== false) lab.appendChild(el('span', 'req', 'required'));
    lab.setAttribute('for', 'new_game_title');
    row.appendChild(lab);
    var input = el('input', 'input');
    input.id = 'new_game_title';
    input.type = 'text';
    input.value = draft.title;
    input.placeholder = opts.placeholder || 'e.g. Harbour lights';
    input.addEventListener('input', function () {
      draft.title = input.value;
      C.ui.refreshModal();
    });
    row.appendChild(input);
    return row;
  }

  function chipsRow(label, items, active, onPick) {
    var row = el('div', 'form-row');
    row.appendChild(el('div', 'label', label));
    var btns = el('div', 'btn-row');
    items.forEach(function (it) {
      var b = el('button', 'chip' + (it[0] === active ? ' is-on' : ''), it[1]);
      b.type = 'button';
      b.addEventListener('click', function () { onPick(it[0]); });
      btns.appendChild(b);
    });
    row.appendChild(btns);
    return row;
  }

  var LANGS = ED.LANGS;

  function createDraft(draft, content, resultTail) {
    var id = ED.nextId(draft.kind);
    var p = ED.newPuzzle({
      id: id, title: draft.title.trim(), kind: draft.kind,
      lang: draft.lang, difficulty: draft.difficulty, topics: [],
      content: content
    });
    C.commit({
      action: 'Create ' + C.kindArticle(draft.kind),
      object: id,
      reason: '',
      result: 'Draft ' + id + ' “' + p.title + '” created · ' + C.kindLabel(p.kind) + ' · ' +
        ED.langLabel(p.lang) + ' · ' + p.difficulty + (resultTail ? ' · ' + resultTail : ''),
      apply: function (store) { store.puzzles.push(p); },
      silent: true
    });
    C.ui.closeModal();
    C.toast('Draft ' + id + ' created.');
    C.go('#/library/' + id);
  }

  function focusTitle() {
    var t = document.getElementById('new_game_title');
    if (t && document.activeElement !== t) {
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    }
  }

  // -- New crossword ----------------------------------------------------

  /* Grid size is the one choice that cannot be changed later, so it is two
     cards rather than a chip: each names the shape and the par time it sets. */
  function gridSizeCards(draft, onPick) {
    var row = el('div', 'form-row');
    row.appendChild(el('div', 'label', 'Grid size'));
    var cards = el('div', 'size-cards');
    ED.GRID_SIZES.forEach(function (g) {
      var on = draft.size === g.size;
      var card = el('button', 'size-card' + (on ? ' is-on' : ''));
      card.type = 'button';
      card.setAttribute('aria-pressed', String(on));
      card.appendChild(el('span', 'size-name', g.name));
      card.appendChild(el('span', 'size-shape', g.size + ' × ' + g.size));
      card.appendChild(el('span', 'size-par', 'par ' + ED.parLabel(g.par)));
      card.addEventListener('click', function () { onPick(g.size); });
      cards.appendChild(card);
    });
    row.appendChild(cards);
    return row;
  }

  function newCrosswordFlow() {
    var draft = {
      kind: 'cw', lang: 'en', difficulty: 'Medium', title: '',
      size: ED.GRID_SIZES[0].size
    };

    function build() {
      var body = el('div');
      body.appendChild(titleRow(draft));
      body.appendChild(chipsRow('Language', LANGS, draft.lang,
        function (v) { draft.lang = v; build(); }));
      body.appendChild(chipsRow('Difficulty', ED.difficulties('cw'), draft.difficulty,
        function (v) { draft.difficulty = v; build(); }));
      body.appendChild(gridSizeCards(draft, function (v) { draft.size = v; build(); }));

      C.ui.modal({
        title: 'New ' + C.kindWord('cw'),
        body: body,
        secondary: { label: 'Cancel' },
        primary: {
          label: 'Create draft',
          disabled: function () { return !draft.title.trim(); },
          onClick: function () {
            var g = ED.gridSizeOf(draft.size);
            createDraft(draft, ED.blankContent('cw', draft.size),
              ED.gridSizeLabel(g));
          }
        }
      });
      focusTitle();
    }
    build();
  }

  // -- New Guessword ----------------------------------------------------

  /* One answer is the whole game, so it is typed here and checked as it is
     typed. The checks name what failed; they hold Approve, never Save, so a
     draft can be parked and finished later. */
  function newGuesswordFlow() {
    var draft = {
      kind: 'guessword', lang: 'en', difficulty: 'Medium', title: '', answer: ''
    };

    function build() {
      var body = el('div', 'ed-cols');

      var left = el('div');
      left.appendChild(chipsRow('Language', LANGS, draft.lang, function (v) {
        draft.lang = v;
        draft.answer = ED.normalizeAnswer(draft.answer, v);
        build();
      }));
      left.appendChild(chipsRow('Difficulty target', ED.difficulties('guessword'), draft.difficulty,
        function (v) { draft.difficulty = v; build(); }));
      left.appendChild(titleRow(draft, {
        required: false,
        placeholder: 'e.g. Fresh start'
      }));
      body.appendChild(left);

      var right = el('div');
      var answerRow = el('div', 'form-row');
      var lab = el('label', 'label', 'Answer');
      lab.appendChild(el('span', 'req', 'required'));
      answerRow.appendChild(lab);

      var checks = el('div');
      function paintChecks() {
        checks.innerHTML = '';
        if (!draft.answer) return;
        checks.appendChild(ED.checkList(ED.answerChecks(draft.answer, draft.lang)));
        var blocking = ED.blockingChecks(ED.answerChecks(draft.answer, draft.lang));
        if (blocking.length) {
          checks.appendChild(el('div', 'ed-note',
            'A draft saves with ' + blocking.length + ' failing ' +
            (blocking.length === 1 ? 'check' : 'checks') + '. Approve stays blocked until they pass.'));
        }
      }

      var cells = ED.answerCells({
        lang: draft.lang, value: draft.answer,
        onChange: function (v) {
          draft.answer = v;
          paintChecks();
          C.ui.refreshModal();
        }
      });
      answerRow.appendChild(cells);
      answerRow.appendChild(checks);
      paintChecks();
      right.appendChild(answerRow);
      body.appendChild(right);

      C.ui.modal({
        title: 'New ' + C.kindWord('guessword'),
        body: body,
        wide: true,
        secondary: { label: 'Cancel' },
        primary: {
          label: 'Create draft',
          disabled: function () { return !draft.answer.trim(); },
          onClick: function () {
            var answer = ED.normalizeAnswer(draft.answer, draft.lang);
            var blocking = ED.blockingChecks(ED.answerChecks(answer, draft.lang));
            /* An untitled Guessword takes the answer as its working title, so
               the result names the word once. */
            if (!draft.title.trim()) draft.title = answer;
            createDraft(draft, { answer: answer },
              (draft.title === answer ? '' : answer + ' · ') + (blocking.length
                ? blocking.length + ' failing ' + (blocking.length === 1 ? 'check' : 'checks')
                : 'every check passed'));
          }
        }
      });
      cells.focusNext();
    }
    build();
  }

  function duplicateFlow(list) {
    var sources = list.filter(Boolean);
    if (!sources.length) return;

    var body = el('div');
    var res = el('div');
    var taken = [];
    var plan = sources.map(function (p) {
      var id = ED.nextId(p.kind, taken);
      taken.push(id);
      return { src: p, id: id };
    });
    res.appendChild(C.ui.results(plan.map(function (x) {
      return {
        label: x.src.id + ' ' + x.src.title, outcome: 'ok', outcomeLabel: 'Copy',
        detail: 'becomes ' + x.id + ' · Draft'
      };
    })));
    body.appendChild(res);

    C.ui.modal({
      title: sources.length === 1 ? 'Duplicate as draft' : 'Duplicate ' + sources.length + ' games as drafts',
      body: body,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Duplicate as draft',
        onClick: function () {
          var made = plan.map(function (x) {
            return ED.newPuzzle({
              id: x.id,
              title: x.src.title + ' (copy)',
              kind: x.src.kind, lang: x.src.lang, difficulty: x.src.difficulty,
              topics: x.src.topics, content: clone(x.src.content),
              note: 'Duplicated from ' + x.src.id + ' v' + x.src.version
            });
          });
          C.commit({
            action: 'Duplicate as draft',
            object: plan.map(function (x) { return x.src.id; }).join(', '),
            reason: '',
            result: made.length + ' draft' + (made.length === 1 ? '' : 's') + ' created · ' + made.map(function (p) { return p.id; }).join(', '),
            apply: function (store) {
              made.forEach(function (p) { store.puzzles.push(p); });
              st().selected = [];
            },
            silent: true
          });
          C.ui.closeModal();
          C.toast(made.length === 1 ? 'Draft ' + made[0].id + ' created.' : made.length + ' drafts created.');
          if (made.length === 1) C.go('#/library/' + made[0].id);
          else C.render();
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // E7 — create a correction from a published puzzle
  // ---------------------------------------------------------------------

  function correctionFlow(src) {
    if (!isPublished(src)) return;
    var newId = ED.nextId(src.kind);
    var body = el('div');
    body.appendChild(C.ui.reviewPanel({
      title: 'Create a correction',
      before: [
        [src.id, src.title],
        ['Status', C.ui.pill(src.status)],
        ['Version', 'v' + src.version]
      ],
      after: [
        [newId, src.title],
        ['Status', C.ui.pill('draft')],
        ['Version', 'v' + (src.version + 1) + ' · correction of v' + src.version]
      ],
      consequence: src.id + ' keeps serving until the correction is published.'
    }));
    var reason = C.ui.reasonField({
      required: false,
      label: 'What needs correcting',
      placeholder: 'e.g. 7-across clue names the wrong river'
    });
    body.appendChild(reason);

    C.ui.modal({
      title: 'Create correction',
      body: body,
      wide: true,
      secondary: { label: 'Cancel' },
      primary: {
        label: 'Create correction',
        onClick: function () {
          var note = 'Correction of ' + src.id + ' v' + src.version;
          var p = ED.newPuzzle({
            id: newId, title: src.title, kind: src.kind, lang: src.lang,
            difficulty: src.difficulty, topics: src.topics,
            content: clone(src.content),
            version: src.version + 1,
            correctionOf: src.id,
            note: note + (reason.value() ? ' · ' + reason.value() : '')
          });
          C.commit({
            action: 'Create correction',
            object: src.id,
            reason: reason.value(),
            result: newId + ' created as Draft v' + p.version + ' · ' + note,
            apply: function (store) {
              store.puzzles.push(p);
              st().selected = [];
            },
            silent: true
          });
          C.ui.closeModal();
          C.toast('Correction ' + newId + ' created as a draft.');
          C.go('#/library/' + newId);
        }
      }
    });
  }

  C.editorial.correctionFlow = correctionFlow;

  // ---------------------------------------------------------------------
  // row menu
  // ---------------------------------------------------------------------

  function rowMenu(p) {
    var body = el('div');
    var head = el('div', 'help', p.id + ' · ' + ED.kindLabel(p.kind) + ' · ' + ED.langLabel(p.lang) + ' · v' + p.version);
    body.appendChild(head);

    var list = el('div');
    list.style.marginTop = '12px';

    function action(label, detail, fn, disabled) {
      var b = el('button', 'check-row');
      b.type = 'button';
      b.style.width = '100%';
      b.style.textAlign = 'left';
      b.style.cursor = disabled ? 'not-allowed' : 'pointer';
      if (disabled) b.style.opacity = '.5';
      var txt = el('div', 'check-row-text');
      txt.appendChild(el('div', 'check-row-label', label));
      if (disabled && detail) txt.appendChild(el('div', 'check-row-detail', detail));
      b.appendChild(txt);
      if (!disabled) b.addEventListener('click', function () { C.ui.closeModal(); fn(); });
      list.appendChild(b);
    }

    action('Open in editor', '', function () { C.go('#/library/' + p.id); });
    action('Duplicate as draft', '', function () { duplicateFlow([p]); });
    action('Create correction', 'Only a Published or Live game can be corrected',
      function () { correctionFlow(p); }, !isPublished(p));

    body.appendChild(list);

    C.ui.modal({
      title: p.title,
      body: body,
      secondary: { label: 'Close' }
    });
  }

  // ---------------------------------------------------------------------
  // screen
  // ---------------------------------------------------------------------

  function repaint(mount, keepFocus) {
    mount.innerHTML = '';
    build(mount);
    if (keepFocus) {
      var s = mount.querySelector('#library_search');
      if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    }
  }

  function filterBar(mount) {
    var bar = el('div', 'desk-toolbar');
    bar.style.flexWrap = 'wrap';

    var show = el('div', 'btn-row');
    show.appendChild(el('span', 'eyebrow', 'Show'));
    CHIPS.forEach(function (c) {
      var on = activeFilter() === c.key && !(c.key === 'all' && activeStatus());
      var b = el('button', 'chip' + (on ? ' is-on' : ''), c.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        st().filter = c.key;
        if (c.key !== 'all') st().status = activeStatus();
        st().selected = [];
        repaint(mount);
      });
      show.appendChild(b);
    });

    var status = activeStatus();
    if (status) {
      var sc = el('button', 'chip is-on');
      sc.type = 'button';
      sc.appendChild(document.createTextNode((C.ui.STATUS[status] || {}).label || status));
      sc.appendChild(el('span', null, ' ✕'));
      sc.setAttribute('aria-label', 'Clear the ' + status + ' status filter');
      sc.addEventListener('click', function () {
        st().status = null;
        if (STATUS_KEYS.indexOf(st().filter) >= 0) st().filter = 'all';
        st().selected = [];
        repaint(mount);
      });
      show.appendChild(sc);
    }
    bar.appendChild(show);

    var langRow = el('div', 'btn-row');
    langRow.appendChild(el('span', 'eyebrow', 'Language'));
    [['all', 'All']].concat(ED.LANGS).forEach(function (l) {
      var b = el('button', 'chip' + (st().lang === l[0] ? ' is-on' : ''), l[1]);
      b.type = 'button';
      b.addEventListener('click', function () { st().lang = l[0]; st().selected = []; repaint(mount); });
      langRow.appendChild(b);
    });
    bar.appendChild(langRow);

    bar.appendChild(el('div', 'spacer'));

    var search = el('input', 'input');
    search.id = 'library_search';
    search.type = 'search';
    search.style.maxWidth = '260px';
    search.placeholder = 'Search by id, title, author or topic';
    search.setAttribute('aria-label', 'Search the library');
    search.value = st().q;
    search.addEventListener('input', function () {
      st().q = search.value;
      st().selected = [];
      repaint(mount, true);
    });
    bar.appendChild(search);
    return bar;
  }

  function bulkBar(mount, list) {
    var sel = st().selected.filter(function (id) { return C.find.puzzle(id); });
    var chosen = sel.map(C.find.puzzle);
    var allPublished = chosen.length > 0 && chosen.every(isPublished);

    var bar = el('div', 'bulk-bar' + (sel.length ? ' is-active' : ''));
    bar.appendChild(el('span', 'bulk-label', sel.length
      ? sel.length + ' game' + (sel.length === 1 ? '' : 's') + ' selected'
      : list.length + ' game' + (list.length === 1 ? '' : 's') + ' shown'));
    bar.appendChild(el('div', 'spacer'));

    if (sel.length) {
      bar.appendChild(C.ui.button('Duplicate as draft', {
        small: true,
        onClick: function () { duplicateFlow(chosen); }
      }));
      bar.appendChild(C.ui.button('Create correction', {
        small: true,
        disabled: !allPublished || sel.length !== 1,
        onClick: function () { correctionFlow(chosen[0]); }
      }));
      bar.appendChild(C.ui.button('Clear selection', {
        small: true, variant: 'quiet',
        onClick: function () { st().selected = []; repaint(mount); }
      }));
      if (!allPublished || sel.length !== 1) {
        bar.appendChild(el('span', 'bulk-hint',
          'A correction is made from exactly one Published or Live row.'));
      }
    } else {
      bar.appendChild(C.ui.button('Select every row shown', {
        small: true,
        disabled: !list.length,
        onClick: function () {
          st().selected = list.map(function (p) { return p.id; });
          repaint(mount);
        }
      }));
    }
    return bar;
  }

  function table(mount, list) {
    /* A Guessword is its answer, so the tab that lists them shows it. */
    var answerCol = {
      key: 'answer', label: 'Answer', width: '104px', cls: 'cell-answer',
      render: function (p) { return (p.content || {}).answer || '—'; }
    };
    return C.ui.table({
      cols: [
        { key: 'id', label: 'ID', cls: 'cell-id', width: '116px' },
        {
          key: 'title', label: 'Title', cls: 'cell-title',
          render: function (p) {
            var w = el('span');
            w.appendChild(el('span', null, p.title));
            if (p.correctionOf) {
              var tag = el('span', 'chip chip-sm', 'Correction');
              tag.style.marginLeft = '8px';
              w.appendChild(tag);
            }
            return w;
          }
        },
        {
          key: 'lang', label: 'Language', width: '112px', cls: 'nowrap',
          render: function (p) { return ED.langLabel(p.lang); }
        }
      ].concat(activeTab() === 'guessword' ? [answerCol] : []).concat([
        { key: 'difficulty', label: 'Difficulty', width: '106px', cls: 'nowrap' },
        { key: 'status', label: 'Status', width: '150px', render: function (p) { return C.ui.pill(p.status); } },
        { key: 'validation', label: 'Validation', width: '120px', render: function (p) { return C.ui.status(p.validation); } },
        {
          key: 'menu', label: '', align: 'right', width: '56px',
          render: function (p) {
            var b = el('button', 'btn btn-sm btn-quiet', '⋯');
            b.type = 'button';
            b.setAttribute('aria-label', 'Actions for ' + p.id);
            b.addEventListener('click', function (e) { e.stopPropagation(); rowMenu(p); });
            return b;
          }
        }
      ]),
      rows: list,
      onRowClick: function (p) { C.go('#/library/' + p.id); },
      selectable: {
        selected: st().selected,
        idKey: 'id',
        onChange: function (next) { st().selected = next; repaint(mount); }
      },
      empty: 'No games match these filters.'
    });
  }

  /* Another builder may write a status key straight into `filter` (the O2
     hand-off). Fold it into the status dimension so both chip rows stay
     independent and the ✕ chip can clear it. */
  function normalizeState() {
    /* A kind written straight into `filter` by an older hand-off picks the tab. */
    if (st().filter === 'cw' || st().filter === 'guessword') {
      st().tab = st().filter;
      st().filter = 'all';
    }
    if (st().tab !== 'cw' && st().tab !== 'guessword') st().tab = 'cw';
    if (STATUS_KEYS.indexOf(st().filter) >= 0) {
      st().status = st().filter;
      st().filter = 'all';
    }
    if (CHIP_KEYS.indexOf(st().filter) < 0) st().filter = 'all';
  }

  /* A full re-render, not a repaint: the topbar and the footer count the tab. */
  function tabStrip() {
    return C.ui.tabs(TABS, activeTab(), function (k) {
      st().tab = k;
      st().selected = [];
      C.render();
    });
  }

  function build(mount) {
    normalizeState();
    var inTab = ofTab(C.store.puzzles);
    var list = rows();

    mount.appendChild(tabStrip());

    var needsReview = inTab.filter(function (p) { return p.status === 'review'; });
    var failing = inTab.filter(function (p) { return p.validation === 'failed'; });
    if (needsReview.length || failing.length) {
      var b = el('div', 'banner attention');
      b.appendChild(el('span', 'banner-dot'));
      b.appendChild(el('div', 'banner-text',
        needsReview.length + ' game' + (needsReview.length === 1 ? '' : 's') + ' waiting for review · ' +
        failing.length + ' failing validation'));
      b.appendChild(el('div', 'spacer'));
      b.appendChild(C.ui.button('Show needs review', {
        small: true,
        onClick: function () { st().filter = 'review'; st().status = null; st().selected = []; repaint(mount); }
      }));
      b.appendChild(C.ui.button('Show validation failed', {
        small: true,
        onClick: function () { st().filter = 'failed'; st().status = null; st().selected = []; repaint(mount); }
      }));
      mount.appendChild(b);
    }

    mount.appendChild(filterBar(mount));
    mount.appendChild(bulkBar(mount, list));

    var wrap = el('div');
    wrap.className = 'rule-top';
    wrap.appendChild(table(mount, list));
    mount.appendChild(wrap);

    var foot = el('div', 'table-foot');
    foot.appendChild(el('span', null, list.length + ' of ' + inTab.length + ' shown · ' +
      ED.LANGS.map(function (l) {
        return inTab.filter(function (p) { return p.lang === l[0]; }).length + ' ' + l[1];
      }).join(' · ')));
    foot.appendChild(el('span', 'spacer'));
    foot.appendChild(el('span', null, 'Approved and unassigned: ' +
      inTab.filter(function (p) { return p.status === 'approved'; }).length));
    mount.appendChild(foot);
  }

  C.registerScreen('#/library', {
    title: 'Library',
    subline: function () {
      normalizeState();
      return C.kindLabelPlural('cw') + ' and ' + C.kindLabel('guessword') + ' · ' +
        C.store.puzzles.length + ' games';
    },
    /* One constructor per game: the primary control follows the active tab. */
    actions: function () {
      normalizeState();
      var kind = activeTab();
      var row = el('div', 'btn-row');
      row.appendChild(C.ui.button('Import', { onClick: importFlow }));
      row.appendChild(C.ui.button('New ' + C.kindWord(kind), {
        variant: 'pink',
        onClick: kind === 'guessword' ? newGuesswordFlow : newCrosswordFlow
      }));
      return row;
    },
    render: function (mount) { build(mount); }
  });

  // ---------------------------------------------------------------------
  // screen-specific CSS (library + editor share this block)
  // ---------------------------------------------------------------------

  if (!document.getElementById('editorial-css')) {
    var style = el('style');
    style.id = 'editorial-css';
    style.textContent = [
      /* library table */
      '.tbl td.nowrap,.tbl td.cell-id{white-space:nowrap}',
      '.tbl td.cell-title{min-width:150px}',
      /* editor review bar */
      '.ed-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px var(--pad-x);',
      '  border-bottom:1px solid var(--rule);background:var(--paper)}',
      '.ed-facts{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
      '.ed-fact{display:flex;flex-direction:column;gap:2px}',
      '.ed-fact .k{font:700 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55)}',
      '.ed-fact .v{font:700 13px var(--sans)}',
      '.ed-dirty{font:700 11px var(--mono);color:var(--gold)}',
      '.ed-body{padding:16px var(--pad-x);display:flex;flex-direction:column;gap:14px;min-width:0}',
      '.ed-cols{display:grid;grid-template-columns:minmax(300px,360px) minmax(0,1fr);gap:18px;align-items:start}',
      '.ed-note{font:400 12px/1.5 var(--sans);color:var(--ink-55);max-width:620px}',
      /* the crossword Content tab: grid left, derived clue list right */
      '.cw-cols{display:grid;grid-template-columns:auto minmax(0,1fr);gap:22px;align-items:start}',
      '.cw-left{position:sticky;top:14px;align-self:start}',
      '.cw-right{min-width:0;display:flex;flex-direction:column;gap:12px}',
      '.cwgrid{display:grid;gap:3px;width:max-content;padding:2px;border-radius:3px}',
      '.cwgrid:focus{outline:none}',
      '.cwgrid:focus-visible{outline:2px solid var(--pink);outline-offset:3px}',
      /* cell states, in the vocabulary the Play screen uses */
      '.cwcell{position:relative;width:44px;height:44px;border-radius:3px;cursor:pointer;',
      '  display:flex;align-items:center;justify-content:center;user-select:none}',
      '.cwcell.is-empty{background:var(--paper);border:1px solid var(--ink-35)}',
      '.cwcell.is-letter{background:var(--paper);border:1px solid var(--ink-35)}',
      '.cwcell.is-block{background:var(--ink);border:1px solid var(--ink)}',
      '.cwcell.is-slot{background:var(--pink-wash);border-color:var(--pink);border-width:2px}',
      '.cwcell.is-caret{border:3px solid var(--pink)}',
      '.cwcell.is-flagged{border:2px solid var(--gold-soft);background:var(--gold-wash)}',
      '.cwcell.is-error{border:2px solid var(--pink);background:var(--pink-tint)}',
      '.cwcell.is-block.is-caret{border-color:var(--pink)}',
      '.cwcell .n{position:absolute;top:1px;left:3px;font:700 8px var(--mono);color:var(--ink-45);pointer-events:none}',
      '.cwcell .ch{font:800 19px var(--mono);color:var(--ink);pointer-events:none}',
      '.cwcell .flag-dot{position:absolute;top:2px;right:2px;width:5px;height:5px;border-radius:50%;',
      '  background:var(--gold);pointer-events:none}',
      '.cw-stats{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;',
      '  font:600 12px var(--mono);color:var(--ink-65)}',
      '.cw-stats .is-bad{color:var(--pink)}',
      '.cw-stats .is-warn{color:var(--gold)}',
      '.cw-sep{color:var(--ink-35)}',
      /* one row per derived slot */
      '.cw-dir{font:700 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55);',
      '  margin:6px 0 5px}',
      '.cw-rows{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.cw-none{font:400 12px var(--sans);color:var(--ink-55);padding:2px 0}',
      '.cw-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--rule);',
      '  border-left:3px solid transparent;border-radius:var(--radius);background:var(--paper);min-width:0}',
      '.cw-row.is-on{border-color:var(--pink);border-left-color:var(--pink);background:var(--pink-wash)}',
      '.cw-row.is-flagged{border-left-color:var(--gold-soft)}',
      '.cw-row.is-error{border-left-color:var(--pink)}',
      '.cw-n{font:800 12px var(--mono);color:var(--ink);width:22px;flex:none;text-align:right}',
      '.cw-dirtag{font:700 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;',
      '  color:var(--ink-55);width:48px;flex:none}',
      'input.cw-answer{flex:none;text-align:left;text-transform:uppercase;padding:5px 7px;',
      '  font:700 14px var(--mono);letter-spacing:.14em}',
      'input.cw-clue{flex:1;min-width:0}',
      '.cw-meta{flex:none;display:flex;gap:8px;align-items:baseline;justify-content:flex-end;min-width:96px}',
      '.cw-same{font:600 10px var(--mono);color:var(--gold)}',
      '.cw-count{font:600 10px var(--mono);color:var(--ink-45)}',
      '.cw-count.is-over{color:var(--gold)}',
      '.ed-blocked{font:700 11px var(--mono);color:var(--pink)}',
      /* new crossword: grid size cards */
      '.size-cards{display:flex;gap:10px;flex-wrap:wrap}',
      '.size-card{display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;cursor:pointer;',
      '  padding:10px 14px;border:1px solid var(--ink-28);border-radius:var(--radius-lg);background:var(--paper);min-width:150px}',
      '.size-card:hover{border-color:var(--pink)}',
      '.size-card.is-on{border-color:var(--pink);background:var(--pink-wash);box-shadow:inset 0 0 0 1px var(--pink)}',
      '.size-name{font:800 15px var(--sans)}',
      '.size-shape{font:700 12px var(--mono);color:var(--ink-65)}',
      '.size-par{font:500 11px var(--mono);color:var(--ink-55)}',
      /* the Guessword answer, five cells that behave as one field */
      '.ans-cells{display:flex;gap:6px}',
      '.ans-cell{width:52px;height:56px;flex:none;text-align:center;text-transform:uppercase;padding:0;',
      '  font:800 22px var(--mono);border:1px solid var(--ink-28);border-radius:var(--radius);background:var(--paper);color:var(--ink)}',
      '.ans-cell:focus{border-color:var(--pink);outline:none;box-shadow:0 0 0 2px var(--pink-wash)}',
      /* one line per live check */
      '.checks{display:flex;flex-direction:column;gap:4px;margin-top:12px;max-width:640px}',
      '.check-line{display:flex;align-items:baseline;gap:9px;width:100%;text-align:left;padding:6px 9px;',
      '  border:1px solid var(--rule);border-left-width:3px;border-radius:var(--radius);background:var(--paper);font:500 13px/1.35 var(--sans)}',
      'button.check-line{cursor:pointer}',
      'button.check-line:hover{border-color:var(--pink);background:var(--pink-wash)}',
      '.check-line.is-ok{border-left-color:var(--green)}',
      '.check-line.is-warn{border-left-color:var(--gold)}',
      '.check-line.is-bad{border-left-color:var(--pink);background:var(--pink-wash)}',
      '.check-mark{font:700 12px var(--mono);width:12px;flex:none}',
      '.check-line.is-ok .check-mark{color:var(--green)}',
      '.check-line.is-warn .check-mark{color:var(--gold)}',
      '.check-line.is-bad .check-mark{color:var(--pink)}',
      '.check-name{font:700 10px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-55);',
      '  width:132px;flex:none}',
      '.check-msg{min-width:0}',
      /* the computed difficulty band and the counts behind it */
      '.diff-panel{display:flex;flex-direction:column;gap:4px;max-width:640px}',
      '.diff-head{display:flex;align-items:baseline;gap:10px;padding:8px 10px;border:1px solid var(--rule);',
      '  border-left:3px solid var(--ink-28);border-radius:var(--radius);background:var(--paper)}',
      '.diff-head.is-warn{border-left-color:var(--gold);background:var(--gold-wash)}',
      '.diff-band{font:800 17px var(--sans)}',
      '.diff-target{font:600 12px var(--mono);color:var(--ink-65)}',
      '.diff-row{display:flex;align-items:baseline;gap:10px;padding:5px 10px;border-bottom:1px solid var(--rule-soft)}',
      '.diff-k{font:500 13px var(--sans);width:250px;flex:none}',
      '.diff-v{font:700 13px var(--mono)}',
      '.diff-p{font:700 11px var(--mono);color:var(--pink)}',
      '.diff-t{font:500 10px var(--mono);color:var(--ink-55)}',
      /* six rows of five tiles, and the keyboard they colour */
      '.gw-cols{display:grid;grid-template-columns:minmax(0,1fr) 316px;gap:18px;align-items:start}',
      '.gw-board{display:flex;flex-direction:column;gap:12px}',
      '.gw-rows{display:flex;flex-direction:column;gap:4px}',
      '.gw-row{display:flex;align-items:center;gap:4px}',
      '.gw-row.is-reveal{margin-top:4px;padding-top:6px;border-top:1px dashed var(--ink-28)}',
      '.gw-row-tag{font:700 9px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--ink-45);',
      '  width:50px;flex:none;text-align:right}',
      '.gw-tile{width:40px;height:40px;flex:none;display:flex;align-items:center;justify-content:center;',
      '  border-radius:3px;font:800 17px var(--mono)}',
      '.gw-tile.is-empty{background:var(--paper);border:1px solid var(--ink-28)}',
      '.gw-tile.is-exact{background:var(--green);color:var(--paper)}',
      '.gw-tile.is-present{background:var(--gold);color:var(--paper)}',
      '.gw-tile.is-absent{background:var(--ink-45);color:var(--paper)}',
      '.gw-keys{display:flex;flex-direction:column;gap:3px;align-items:center;max-width:340px}',
      '.gw-key-row{display:flex;gap:3px}',
      '.gw-key{min-width:22px;height:28px;padding:0 3px;border-radius:3px;display:flex;align-items:center;',
      '  justify-content:center;font:700 11px var(--mono)}',
      '.gw-key.is-idle{background:var(--paper);border:1px solid var(--rule);color:var(--ink-65)}',
      '.gw-key.is-exact{background:var(--green);color:var(--paper)}',
      '.gw-key.is-present{background:var(--gold);color:var(--paper)}',
      '.gw-key.is-absent{background:var(--ink-45);color:var(--paper)}',
      /* the same board, sized to sit inside the 280px phone frame */
      '.gw-board.is-compact{gap:8px}',
      '.gw-board.is-compact .gw-row-tag{width:34px;font-size:8px}',
      '.gw-board.is-compact .gw-tile{width:32px;height:32px;font-size:14px}',
      '.gw-board.is-compact .gw-keys{max-width:250px}',
      '.gw-board.is-compact .gw-key{min-width:18px;height:24px;font-size:9px;padding:0 2px}',
      '.tbl td.cell-answer{font:700 13px var(--mono);letter-spacing:.08em;white-space:nowrap}',
      /* validation list */
      '.issue{display:flex;align-items:flex-start;gap:10px;width:100%;text-align:left;padding:10px 12px;',
      '  border:1px solid var(--rule);border-radius:var(--radius);background:var(--paper);cursor:pointer}',
      '.issue + .issue{margin-top:7px}',
      '.issue:hover{border-color:var(--pink);background:var(--pink-wash)}',
      '.issue-where{font:700 11px var(--mono);color:var(--pink);width:130px;flex:none}',
      '.issue-msg{font:500 13px var(--sans);min-width:0}',
      '.issue-code{font:500 10px var(--mono);color:var(--ink-45);margin-left:auto;flex:none}',
      /* preview */
      '.preview-row{display:flex;gap:26px;flex-wrap:wrap}',
      '.phone{width:280px;flex:none}',
      '.phone-label{font:700 10px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-55);margin-bottom:8px}',
      '.phone-frame{width:280px;height:560px;border:2px solid var(--ink);border-radius:26px;background:var(--cream);',
      '  padding:14px 12px;overflow:hidden;display:flex;flex-direction:column;gap:12px}',
      '.phone-notch{width:74px;height:5px;border-radius:3px;background:var(--ink-28);margin:0 auto}',
      '.feed-head{display:flex;align-items:baseline;gap:8px}',
      '.feed-day{font:800 15px var(--sans)}',
      '.feed-sub{font:500 10px var(--mono);color:var(--ink-55)}',
      '.feed-card{background:var(--paper);border:1px solid var(--ink-28);border-radius:10px;padding:14px;',
      '  display:flex;flex-direction:column;gap:8px}',
      '.feed-kicker{font:700 9px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--pink)}',
      '.feed-title{font:900 20px/1.1 var(--sans);letter-spacing:-.4px}',
      '.feed-meta{font:500 10px var(--mono);color:var(--ink-55)}',
      '.feed-mini{display:grid;grid-template-columns:repeat(5,16px);gap:2px}',
      '.feed-mini span{width:16px;height:16px;border:1px solid var(--ink-28);border-radius:2px;background:var(--cream)}',
      '.feed-mini span.is-block{background:var(--ink);border-color:var(--ink)}',
      '.feed-cta{align-self:flex-start;background:var(--pink);color:var(--paper);border-radius:20px;',
      '  padding:6px 14px;font:800 11px var(--sans)}',
      '.solve-grid{display:grid;grid-template-columns:repeat(5,44px);gap:2px;justify-content:center}',
      '.solve-cell{position:relative;width:44px;height:44px;border:1px solid var(--ink-28);border-radius:2px;',
      '  background:var(--paper);display:flex;align-items:center;justify-content:center;font:800 17px var(--mono)}',
      '.solve-cell.is-block{background:var(--ink);border-color:var(--ink)}',
      '.solve-cell .n{position:absolute;top:1px;left:3px;font:700 8px var(--mono);color:var(--ink-45)}',
      '.solve-clue{background:var(--paper);border:1px solid var(--ink-28);border-radius:8px;padding:10px 12px;',
      '  font:600 13px/1.35 var(--sans)}',
      '.solve-clue .lab{font:700 9px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--pink);display:block;margin-bottom:4px}',
      '.solve-keys{display:flex;flex-wrap:wrap;gap:3px;margin-top:auto}',
      '.solve-keys span{width:24px;height:30px;border-radius:3px;background:var(--paper);border:1px solid var(--rule);',
      '  display:flex;align-items:center;justify-content:center;font:600 11px var(--mono);color:var(--ink-65)}'
    ].join('\n');
    document.head.appendChild(style);
  }
})(window.Console);

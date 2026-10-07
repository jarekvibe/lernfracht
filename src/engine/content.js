// Content-Modell: Katalog für die App und Validator für `npm run validate`/Build.
// Reine Logik ohne DOM und ohne Dateisystem – die Aufrufer liefern die geparsten Einheiten.

export const SCHEMA_VERSION = 1;

export const QUESTION_TYPES = /** @type {const} */ ([
  'single', 'multi', 'truefalse', 'categorize', 'order', 'cloze', 'numeric', 'open',
]);

export const REVIEW_STATUSES = /** @type {const} */ (['draft', 'reviewed']);

/** Unit ids end up in file names and DOM ids, so keep them strictly lowercase-kebab. */
const UNIT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Topic, question and canDo ids: no whitespace and no `/` (the global id separator). */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const UNIT_KEYS = new Set([
  'schemaVersion', 'id', 'lernfeld', 'title', 'description', 'reviewStatus', 'source', 'exam', 'topics', 'questions',
]);
const TOPIC_KEYS = new Set(['id', 'title', 'order', 'icon', 'canDo']);
const EXAM_KEYS = new Set(['title', 'questionCount', 'durationMinutes', 'maxOpenQuestions', 'topicWeights']);
const COMMON_QUESTION_KEYS = [
  'id', 'topic', 'type', 'difficulty', 'prompt', 'context', 'explanation', 'sourceRef', 'supplemented', 'note', 'examPoints',
];
/** @type {Record<string, string[]>} */
const TYPE_KEYS = {
  single: ['options', 'answer'],
  multi: ['options', 'answer'],
  truefalse: ['answer'],
  categorize: ['categories', 'items'],
  order: ['items'],
  cloze: ['text', 'gaps', 'distractors'],
  numeric: ['answer', 'tolerance', 'unit', 'decimals'],
  open: ['modelAnswer', 'rubric', 'keywords'],
};

/**
 * @typedef {Object} CanDo
 * @property {string} id
 * @property {string} text
 * @property {string[]} questionIds
 *
 * @typedef {Object} Topic
 * @property {string} id
 * @property {string} title
 * @property {number} order
 * @property {string} [icon]
 * @property {CanDo[]} [canDo]
 *
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} topic
 * @property {string} type
 * @property {number} difficulty
 * @property {string} prompt
 * @property {string} explanation
 * @property {string} sourceRef
 *
 * @typedef {Question & { gid: string, unitId: string }} CatalogQuestion
 *
 * @typedef {Object} Unit
 * @property {number} schemaVersion
 * @property {string} id
 * @property {{id: string, title: string}} lernfeld
 * @property {string} title
 * @property {string} [description]
 * @property {'draft'|'reviewed'} reviewStatus
 * @property {Object} exam
 * @property {Topic[]} topics
 * @property {Question[]} questions
 *
 * @typedef {Object} ValidationResult
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * Global question id, the key for all learning progress. Never change ids in content.
 * @param {string} unitId
 * @param {string} questionId
 * @returns {string}
 */
export function globalQuestionId(unitId, questionId) {
  return `${unitId}/${questionId}`;
}

/**
 * Builds lookup structures over already validated units.
 * Topics are sorted by `order`; questions keep their content order.
 * @param {Unit[]} units
 */
export function createCatalog(units) {
  /** @type {Map<string, Unit>} */
  const unitById = new Map();
  /** @type {Map<string, CatalogQuestion>} */
  const questionByGid = new Map();
  /** @type {Map<string, CatalogQuestion[]>} key `${unitId}/${topicId}` */
  const questionsByTopic = new Map();

  const sortedUnits = units.map((unit) => {
    const sorted = { ...unit, topics: [...unit.topics].sort((a, b) => a.order - b.order) };
    unitById.set(sorted.id, sorted);
    for (const topic of sorted.topics) questionsByTopic.set(`${sorted.id}/${topic.id}`, []);
    for (const question of sorted.questions) {
      const entry = { ...question, gid: globalQuestionId(sorted.id, question.id), unitId: sorted.id };
      questionByGid.set(entry.gid, entry);
      questionsByTopic.get(`${sorted.id}/${question.topic}`)?.push(entry);
    }
    return sorted;
  });

  return {
    units: sortedUnits,
    /** @param {string} unitId */
    getUnit: (unitId) => unitById.get(unitId) ?? null,
    /** @param {string} gid */
    getQuestion: (gid) => questionByGid.get(gid) ?? null,
    /** @param {string} unitId @param {string} topicId */
    getTopicQuestions: (unitId, topicId) => questionsByTopic.get(`${unitId}/${topicId}`) ?? [],
    get questionCount() {
      return questionByGid.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/** @param {unknown} v @returns {v is string} */
const isText = (v) => typeof v === 'string' && v.trim() !== '';
/** @param {unknown} v @returns {v is number} */
const isInt = (v) => Number.isInteger(v);
/** @param {string} s */
const fold = (s) => s.trim().toLocaleLowerCase('de');

/**
 * @param {unknown[]} list
 * @param {(v: any) => string} key
 * @returns {string[]} duplicated keys
 */
function duplicates(list, key = (v) => v) {
  const seen = new Set();
  const dup = new Set();
  for (const item of list) {
    const k = key(item);
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}

// ASSUMPTION: Über SPEC §7.4 hinaus gelten als Fehler: doppelte Optionen/Items/Kategorien
// (wären in der UI nicht unterscheidbar) und Kontext-Tabellen mit falscher Spaltenzahl.
// Unbekannte Felder (z. B. Tippfehler wie „explaination“) sind nur Warnungen.
// `description`, `source`, `topic.icon` und `topic.canDo` sind optional.
/**
 * Validates one content unit against the schema in SPEC §7.
 * Errors make `npm run validate` and the build fail; warnings do not.
 * @param {unknown} unit
 * @returns {ValidationResult}
 */
export function validateUnit(unit) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  /** @param {string} where @param {string} msg */
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  /** @param {string} where @param {string} msg */
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  if (!isObject(unit)) {
    err('Einheit', 'muss ein JSON-Objekt sein');
    return { errors, warnings };
  }
  if (unit.schemaVersion !== SCHEMA_VERSION) {
    err('schemaVersion', `unbekannt (${JSON.stringify(unit.schemaVersion)}), erwartet ${SCHEMA_VERSION}`);
    return { errors, warnings };
  }

  if (!isText(unit.id) || !UNIT_ID_RE.test(unit.id)) {
    err('id', 'fehlt oder ungültig (nur a–z, 0–9 und Bindestrich)');
  }
  if (!isObject(unit.lernfeld) || !isText(unit.lernfeld.id) || !isText(unit.lernfeld.title)) {
    err('lernfeld', 'braucht `id` und `title`');
  }
  if (!isText(unit.title)) err('title', 'fehlt');
  if (unit.description !== undefined && typeof unit.description !== 'string') err('description', 'muss Text sein');
  if (!REVIEW_STATUSES.includes(unit.reviewStatus)) {
    err('reviewStatus', `muss ${REVIEW_STATUSES.join(' oder ')} sein`);
  }
  if (unit.source !== undefined && !isObject(unit.source)) err('source', 'muss ein Objekt sein');
  for (const key of Object.keys(unit)) {
    if (!UNIT_KEYS.has(key)) warn('Einheit', `unbekanntes Feld „${key}“`);
  }

  // --- Topics -------------------------------------------------------------
  const topics = Array.isArray(unit.topics) ? unit.topics : [];
  if (!Array.isArray(unit.topics) || topics.length === 0) err('topics', 'mindestens ein Thema nötig');
  const topicIds = new Set();
  /** @type {{where: string, ids: unknown}[]} */
  const canDoLinks = [];
  const canDoIds = [];
  topics.forEach((topic, i) => {
    const where = `topics[${isObject(topic) && isText(topic.id) ? topic.id : i}]`;
    if (!isObject(topic)) {
      err(where, 'muss ein Objekt sein');
      return;
    }
    if (!isText(topic.id) || !ID_RE.test(topic.id)) err(where, '`id` fehlt oder ungültig');
    else if (topicIds.has(topic.id)) err(where, 'doppelte Themen-ID');
    else topicIds.add(topic.id);
    if (!isText(topic.title)) err(where, '`title` fehlt');
    if (typeof topic.order !== 'number' || !Number.isFinite(topic.order)) err(where, '`order` muss eine Zahl sein');
    if (topic.icon !== undefined && typeof topic.icon !== 'string') err(where, '`icon` muss Text sein');
    for (const key of Object.keys(topic)) {
      if (!TOPIC_KEYS.has(key)) warn(where, `unbekanntes Feld „${key}“`);
    }
    if (topic.canDo === undefined) return;
    if (!Array.isArray(topic.canDo)) {
      err(where, '`canDo` muss eine Liste sein');
      return;
    }
    topic.canDo.forEach((entry, j) => {
      const cwhere = `${where}.canDo[${isObject(entry) && isText(entry.id) ? entry.id : j}]`;
      if (!isObject(entry)) {
        err(cwhere, 'muss ein Objekt sein');
        return;
      }
      if (!isText(entry.id) || !ID_RE.test(entry.id)) err(cwhere, '`id` fehlt oder ungültig');
      else canDoIds.push(entry.id);
      if (!isText(entry.text)) err(cwhere, '`text` fehlt');
      if (!Array.isArray(entry.questionIds) || entry.questionIds.length === 0) {
        err(cwhere, '`questionIds` braucht mindestens eine Frage');
      } else {
        canDoLinks.push({ where: cwhere, ids: entry.questionIds });
      }
    });
  });
  for (const id of duplicates(canDoIds)) err('topics', `doppelte canDo-ID „${id}“`);
  const orders = topics.filter(isObject).map((t) => t.order).filter((o) => typeof o === 'number');
  for (const order of duplicates(orders)) warn('topics', `mehrere Themen mit order ${order}`);

  // --- Questions ----------------------------------------------------------
  const questions = Array.isArray(unit.questions) ? unit.questions : [];
  if (!Array.isArray(unit.questions)) err('questions', 'muss eine Liste sein');
  const questionIds = new Set();
  /** @type {Map<string, number>} */
  const perTopic = new Map();
  questions.forEach((question, i) => {
    const where = `questions[${isObject(question) && isText(question.id) ? question.id : i}]`;
    if (!isObject(question)) {
      err(where, 'muss ein Objekt sein');
      return;
    }
    if (!isText(question.id) || !ID_RE.test(question.id)) err(where, '`id` fehlt oder ungültig');
    else if (questionIds.has(question.id)) err(where, 'doppelte Frage-ID');
    else questionIds.add(question.id);
    if (!isText(question.topic)) err(where, '`topic` fehlt');
    else if (!topicIds.has(question.topic)) err(where, `Thema „${question.topic}“ existiert nicht`);
    else perTopic.set(question.topic, (perTopic.get(question.topic) ?? 0) + 1);
    validateQuestion(question, where, err, warn);
  });
  for (const id of topicIds) {
    if (!perTopic.get(id)) err(`topics[${id}]`, 'hat keine Fragen');
  }

  // --- Cross references ---------------------------------------------------
  const linked = new Set();
  for (const { where, ids } of canDoLinks) {
    for (const id of /** @type {unknown[]} */ (ids)) {
      if (typeof id !== 'string' || !questionIds.has(id)) err(where, `Frage „${id}“ existiert nicht`);
      else linked.add(id);
    }
  }
  const unlinked = [...questionIds].filter((id) => !linked.has(id));
  if (unlinked.length > 0) warn('canDo', `nicht in der Kann-Liste verlinkt: ${unlinked.join(', ')}`);

  // --- Exam ---------------------------------------------------------------
  const exam = unit.exam;
  if (!isObject(exam)) {
    err('exam', 'fehlt');
  } else {
    if (exam.title !== undefined && !isText(exam.title)) err('exam.title', 'muss Text sein');
    if (!isInt(exam.questionCount) || exam.questionCount < 1) {
      err('exam.questionCount', 'muss eine ganze Zahl ≥ 1 sein');
    } else if (exam.questionCount > questions.length) {
      err('exam.questionCount', `${exam.questionCount} > Anzahl Fragen (${questions.length})`);
    }
    if (typeof exam.durationMinutes !== 'number' || !(exam.durationMinutes > 0)) {
      err('exam.durationMinutes', 'muss eine Zahl > 0 sein');
    }
    if (!isInt(exam.maxOpenQuestions) || exam.maxOpenQuestions < 0) {
      err('exam.maxOpenQuestions', 'muss eine ganze Zahl ≥ 0 sein');
    }
    if (!isObject(exam.topicWeights) || Object.keys(exam.topicWeights).length === 0) {
      err('exam.topicWeights', 'braucht mindestens ein Thema');
    } else {
      let total = 0;
      for (const [topicId, weight] of Object.entries(exam.topicWeights)) {
        if (!topicIds.has(topicId)) err('exam.topicWeights', `Thema „${topicId}“ existiert nicht`);
        if (typeof weight !== 'number' || !(weight >= 0)) err('exam.topicWeights', `Gewicht für „${topicId}“ muss eine Zahl ≥ 0 sein`);
        else total += weight;
      }
      if (total <= 0) err('exam.topicWeights', 'Summe der Gewichte muss > 0 sein');
    }
    for (const key of Object.keys(exam)) {
      if (!EXAM_KEYS.has(key)) warn('exam', `unbekanntes Feld „${key}“`);
    }
  }

  return { errors, warnings };
}

/**
 * @param {Record<string, any>} q
 * @param {string} where
 * @param {(where: string, msg: string) => void} err
 * @param {(where: string, msg: string) => void} warn
 */
function validateQuestion(q, where, err, warn) {
  if (!QUESTION_TYPES.includes(q.type)) {
    err(where, `unbekannter Typ „${q.type}“`);
    return;
  }
  if (![1, 2, 3].includes(q.difficulty)) err(where, '`difficulty` muss 1, 2 oder 3 sein');
  if (!isText(q.prompt)) err(where, '`prompt` fehlt');
  if (!isText(q.explanation)) err(where, '`explanation` fehlt');
  if (!isText(q.sourceRef)) err(where, '`sourceRef` fehlt');
  if (q.supplemented !== undefined && typeof q.supplemented !== 'boolean') err(where, '`supplemented` muss true/false sein');
  if (q.note !== undefined && typeof q.note !== 'string') err(where, '`note` muss Text sein');
  if (q.examPoints !== undefined && (typeof q.examPoints !== 'number' || !(q.examPoints > 0))) {
    err(where, '`examPoints` muss eine Zahl > 0 sein');
  }
  if (q.context !== undefined) validateContext(q.context, where, err);

  const allowed = new Set([...COMMON_QUESTION_KEYS, ...TYPE_KEYS[q.type]]);
  for (const key of Object.keys(q)) {
    if (!allowed.has(key)) warn(where, `unbekanntes Feld „${key}“ für Typ ${q.type}`);
  }

  switch (q.type) {
    case 'single': {
      if (!validateOptions(q.options, where, err)) break;
      if (!isInt(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(where, '`answer` ist kein gültiger Options-Index');
      break;
    }
    case 'multi': {
      if (!validateOptions(q.options, where, err)) break;
      if (!Array.isArray(q.answer) || q.answer.length === 0) {
        err(where, '`answer` braucht mindestens eine Lösung');
        break;
      }
      if (q.answer.some((a) => !isInt(a) || a < 0 || a >= q.options.length)) err(where, '`answer` enthält ungültige Indizes');
      if (duplicates(q.answer).length > 0) err(where, '`answer` enthält doppelte Indizes');
      if (new Set(q.answer).size >= q.options.length) err(where, 'mindestens eine Option muss falsch sein');
      break;
    }
    case 'truefalse': {
      if (typeof q.answer !== 'boolean') err(where, '`answer` muss true oder false sein');
      break;
    }
    case 'categorize': {
      const cats = q.categories;
      if (!Array.isArray(cats) || cats.length < 2 || !cats.every(isText)) {
        err(where, '`categories` braucht mindestens zwei Texte');
        break;
      }
      if (duplicates(cats, fold).length > 0) err(where, '`categories` enthält Duplikate');
      if (!Array.isArray(q.items) || q.items.length === 0) {
        err(where, '`items` braucht mindestens ein Element');
        break;
      }
      const used = new Set();
      q.items.forEach((item, i) => {
        if (!isObject(item) || !isText(item.text)) err(where, `items[${i}] braucht \`text\``);
        if (!isObject(item) || !isInt(item.category) || item.category < 0 || item.category >= cats.length) {
          err(where, `items[${i}] hat keine gültige \`category\``);
        } else {
          used.add(item.category);
        }
      });
      cats.forEach((cat, i) => {
        if (!used.has(i)) err(where, `Kategorie „${cat}“ wird nie benutzt`);
      });
      const texts = q.items.filter((it) => isObject(it) && isText(it.text)).map((it) => it.text);
      if (duplicates(texts, fold).length > 0) err(where, '`items` enthält doppelte Texte');
      break;
    }
    case 'order': {
      if (!Array.isArray(q.items) || q.items.length < 3 || !q.items.every(isText)) {
        err(where, '`items` braucht mindestens drei Texte');
        break;
      }
      if (duplicates(q.items, fold).length > 0) err(where, '`items` enthält Duplikate');
      break;
    }
    case 'cloze': {
      if (!isText(q.text)) {
        err(where, '`text` fehlt');
        break;
      }
      if (!Array.isArray(q.gaps) || q.gaps.length === 0) {
        err(where, '`gaps` braucht mindestens eine Lücke');
        break;
      }
      const solutions = [];
      q.gaps.forEach((gap, i) => {
        if (!isObject(gap) || !isText(gap.answer)) {
          err(where, `gaps[${i}] braucht \`answer\``);
          return;
        }
        solutions.push(gap.answer);
        if (gap.alternatives !== undefined) {
          if (!Array.isArray(gap.alternatives) || !gap.alternatives.every(isText)) {
            err(where, `gaps[${i}].alternatives muss eine Liste von Texten sein`);
          } else {
            solutions.push(...gap.alternatives);
          }
        }
      });
      const placeholders = [...q.text.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]));
      for (const n of duplicates(placeholders)) err(where, `Platzhalter {${n}} kommt mehrfach vor`);
      for (const n of placeholders) {
        if (n >= q.gaps.length) err(where, `Platzhalter {${n}} hat keine Lücke in \`gaps\``);
      }
      for (let i = 0; i < q.gaps.length; i += 1) {
        if (!placeholders.includes(i)) err(where, `Lücke ${i} hat keinen Platzhalter {${i}} im Text`);
      }
      if (!Array.isArray(q.distractors) || !q.distractors.every(isText)) {
        err(where, '`distractors` muss eine Liste von Texten sein');
        break;
      }
      const solutionSet = new Set(solutions.map(fold));
      for (const d of q.distractors) {
        if (solutionSet.has(fold(d))) err(where, `Distraktor „${d}“ ist auch eine Lösung`);
      }
      if (duplicates(q.distractors, fold).length > 0) err(where, '`distractors` enthält Duplikate');
      break;
    }
    case 'numeric': {
      if (typeof q.answer !== 'number' || !Number.isFinite(q.answer)) err(where, '`answer` muss eine Zahl sein');
      if (typeof q.tolerance !== 'number' || !(q.tolerance >= 0)) err(where, '`tolerance` muss eine Zahl ≥ 0 sein');
      if (q.unit !== undefined && typeof q.unit !== 'string') err(where, '`unit` muss Text sein');
      if (q.decimals !== undefined && (!isInt(q.decimals) || q.decimals < 0)) err(where, '`decimals` muss eine ganze Zahl ≥ 0 sein');
      break;
    }
    case 'open': {
      if (!isText(q.modelAnswer)) err(where, '`modelAnswer` darf nicht leer sein');
      if (!Array.isArray(q.rubric) || q.rubric.length === 0) {
        err(where, '`rubric` braucht mindestens ein Kriterium');
      } else {
        q.rubric.forEach((r, i) => {
          if (!isObject(r) || !isText(r.criterion)) err(where, `rubric[${i}] braucht \`criterion\``);
          if (!isObject(r) || typeof r.points !== 'number' || !(r.points > 0)) err(where, `rubric[${i}].points muss > 0 sein`);
        });
      }
      if (!Array.isArray(q.keywords) || !q.keywords.every(isText)) err(where, '`keywords` muss eine Liste von Texten sein');
      break;
    }
    default:
      break;
  }
}

/**
 * @param {unknown} options
 * @param {string} where
 * @param {(where: string, msg: string) => void} err
 * @returns {options is string[]}
 */
function validateOptions(options, where, err) {
  if (!Array.isArray(options) || options.length < 2 || !options.every(isText)) {
    err(where, '`options` braucht mindestens zwei Texte');
    return false;
  }
  if (duplicates(options, fold).length > 0) err(where, '`options` enthält Duplikate');
  return true;
}

/**
 * @param {unknown} context
 * @param {string} where
 * @param {(where: string, msg: string) => void} err
 */
function validateContext(context, where, err) {
  if (!isObject(context) || (context.text === undefined && context.table === undefined)) {
    err(where, '`context` braucht `text` und/oder `table`');
    return;
  }
  if (context.text !== undefined && !isText(context.text)) err(where, '`context.text` muss Text sein');
  if (context.table === undefined) return;
  const table = context.table;
  if (!isObject(table) || !Array.isArray(table.headers) || table.headers.length === 0 || !table.headers.every((c) => typeof c === 'string')) {
    err(where, '`context.table.headers` muss eine Liste von Texten sein');
    return;
  }
  if (!Array.isArray(table.rows)) {
    err(where, '`context.table.rows` muss eine Liste sein');
    return;
  }
  table.rows.forEach((row, i) => {
    if (!Array.isArray(row) || !row.every((c) => typeof c === 'string')) {
      err(where, `context.table.rows[${i}] muss eine Liste von Texten sein`);
    } else if (row.length !== table.headers.length) {
      err(where, `context.table.rows[${i}] hat ${row.length} statt ${table.headers.length} Spalten`);
    }
  });
}

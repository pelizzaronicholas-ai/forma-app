// engine/schemas.js
// Schemi JSON per le chiamate tool-use al modello. Condivisi da backend (definizione tool)
// e frontend (validazione della risposta). Il modello DEVE rispondere solo tramite questi tool.

const FOOD_ITEM = {
  type: 'object',
  required: ['name', 'grams', 'category'],
  properties: {
    name:     { type: 'string', description: 'Nome alimento in italiano, es. "Petto di pollo"' },
    grams:    { type: 'number', description: 'Quantità in grammi (crudo, salvo indicato)' },
    category: { type: 'string', enum: ['protein', 'carb', 'fat', 'veg', 'fruit', 'dairy', 'other'] },
    kcal:     { type: 'number' },
    protein:  { type: 'number', description: 'g' },
    carbs:    { type: 'number', description: 'g' },
    fat:      { type: 'number', description: 'g' },
    note:     { type: 'string', description: 'es. "cotto al vapore", "integrale"' },
  },
};

const MEAL = {
  type: 'object',
  required: ['slot', 'title', 'items'],
  properties: {
    slot:  { type: 'string', enum: ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'] },
    title: { type: 'string', description: 'Nome breve del pasto, es. "Pollo con riso e broccoli"' },
    items: { type: 'array', items: FOOD_ITEM, minItems: 1 },
    prepMinutes: { type: 'number' },
  },
};

const DAY = {
  type: 'object',
  required: ['day', 'meals'],
  properties: {
    day:   { type: 'integer', minimum: 1, maximum: 7 },
    meals: { type: 'array', items: MEAL },
  },
};

/** Tool: generazione piano settimanale. */
export const TOOL_WEEKLY_PLAN = {
  name: 'submit_weekly_plan',
  description: 'Restituisce il piano alimentare settimanale (7 giorni) rispettando esattamente i target kcal/macro per ogni slot.',
  input_schema: {
    type: 'object',
    required: ['days'],
    properties: {
      days: { type: 'array', items: DAY, minItems: 7, maxItems: 7 },
      notes: { type: 'string', description: 'Consigli pratici brevi (max 3 frasi)' },
    },
  },
};

/** Tool: sostituzione di un singolo alimento o intero pasto. */
export const TOOL_SUBSTITUTE = {
  name: 'submit_substitution',
  description: 'Restituisce il pasto modificato con l\'alimento sostituito, mantenendo kcal e macro entro ±10%.',
  input_schema: {
    type: 'object',
    required: ['meal', 'reason'],
    properties: {
      meal: MEAL,
      reason: { type: 'string', description: 'Perché questa sostituzione è equivalente (1 frase)' },
    },
  },
};

/** Tool: preparazioni/ricette per i pasti scelti. */
export const TOOL_RECIPES = {
  name: 'submit_recipes',
  description: 'Restituisce le preparazioni per i pasti indicati, usando solo gli ingredienti elencati (più spezie, erbe, aceto, limone, sale).',
  input_schema: {
    type: 'object',
    required: ['recipes'],
    properties: {
      recipes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['mealTitle', 'steps', 'minutes'],
          properties: {
            mealTitle: { type: 'string' },
            minutes:   { type: 'integer' },
            steps:     { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8 },
            tips:      { type: 'string' },
            mealPrep:  { type: 'string', description: 'Come prepararlo in anticipo / conservazione' },
          },
        },
      },
    },
  },
};

/** Tool: adattamento programma allenamenti (infortuni, preferenze). */
export const TOOL_ADAPT_TRAINING = {
  name: 'submit_training_adaptation',
  description: 'Restituisce per ogni esercizio da sostituire l\'alternativa scelta dal DB e la motivazione.',
  input_schema: {
    type: 'object',
    required: ['replacements'],
    properties: {
      replacements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['sessionIdx', 'exerciseId', 'newExerciseId', 'reason'],
          properties: {
            sessionIdx: { type: 'integer' },
            exerciseId: { type: 'string' },
            newExerciseId: { type: 'string', description: 'id dal DB esercizi fornito' },
            reason: { type: 'string' },
          },
        },
      },
      generalAdvice: { type: 'string' },
    },
  },
};

// ---------------------------------------------------------------------------
// Validazione lato codice della risposta del modello. Il modello propone, il codice controlla.

/**
 * Verifica che ogni pasto del piano sia entro tolleranza rispetto ai target.
 * Ritorna { ok, errors[] }. Se un pasto sfora, il chiamante può riscalare le grammature
 * (scaleMealToTarget) o rigenerare.
 */
export function validatePlan(plan, mealTargets, tol = 0.10) {
  const errors = [];
  const targetBySlot = Object.fromEntries(mealTargets.map(m => [m.id, m]));
  if (!plan?.days || plan.days.length !== 7) errors.push('Il piano deve avere 7 giorni.');
  for (const d of plan?.days ?? []) {
    const slots = new Set();
    for (const m of d.meals ?? []) {
      slots.add(m.slot);
      const t = targetBySlot[m.slot];
      if (!t) { errors.push(`Giorno ${d.day}: slot ${m.slot} non previsto.`); continue; }
      const tot = mealTotals(m);
      if (Math.abs(tot.kcal - t.kcal) > t.kcal * tol)
        errors.push(`Giorno ${d.day} ${m.slot}: ${tot.kcal} kcal vs target ${t.kcal}.`);
      // Proteine: sotto il target è un errore, sopra è tollerato fino a +40% (non è un problema nutrizionale)
      if (t.protein - tot.protein > Math.max(8, t.protein * 0.15) || tot.protein > t.protein * 1.4)
        errors.push(`Giorno ${d.day} ${m.slot}: proteine ${Math.round(tot.protein)} g vs target ${t.protein}.`);
    }
    for (const t of mealTargets) if (!slots.has(t.id)) errors.push(`Giorno ${d.day}: manca ${t.id}.`);
  }
  return { ok: errors.length === 0, errors };
}

export function mealTotals(meal) {
  return meal.items.reduce((a, i) => ({
    kcal: a.kcal + (i.kcal ?? 0), protein: a.protein + (i.protein ?? 0),
    carbs: a.carbs + (i.carbs ?? 0), fat: a.fat + (i.fat ?? 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

/**
 * Riscala le grammature (e i nutrienti, proporzionalmente) di un pasto
 * per portarlo esattamente al target kcal. Le verdure non vengono toccate.
 */
export function scaleMealToTarget(meal, targetKcal) {
  const tot = mealTotals(meal);
  const vegKcal = meal.items.filter(i => i.category === 'veg').reduce((a, i) => a + (i.kcal ?? 0), 0);
  const scalable = tot.kcal - vegKcal;
  if (scalable <= 0) return meal;
  const k = (targetKcal - vegKcal) / scalable;
  return {
    ...meal,
    items: meal.items.map(i => i.category === 'veg' ? i : {
      ...i,
      grams: Math.round(i.grams * k / 5) * 5,
      kcal: Math.round((i.kcal ?? 0) * k), protein: +((i.protein ?? 0) * k).toFixed(1),
      carbs: +((i.carbs ?? 0) * k).toFixed(1), fat: +((i.fat ?? 0) * k).toFixed(1),
    }),
  };
}

/**
 * Controllo allergeni: cerca nei nomi alimenti le parole chiave associate
 * a ciascuna allergia dichiarata. Rete di sicurezza in più oltre al prompt.
 */
export const ALLERGEN_KEYWORDS = {
  lattosio:    ['latte', 'yogurt', 'formaggio', 'mozzarella', 'parmigiano', 'grana', 'ricotta', 'burro', 'panna', 'skyr', 'kefir', 'fiocchi di latte'],
  glutine:     ['pane', 'pasta', 'farro', 'orzo', 'seitan', 'couscous', 'farina', 'cracker', 'fette biscottate', 'avena', 'bulgur', 'piadina'],
  uova:        ['uovo', 'uova', 'albume', 'frittata', 'maionese'],
  frutta_secca:['noci', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'arachidi', 'burro di arachidi', 'pinoli'],
  pesce:       ['salmone', 'tonno', 'merluzzo', 'orata', 'branzino', 'sgombro', 'pesce', 'trota', 'sardine', 'alici'],
  crostacei:   ['gamberi', 'gamberetti', 'scampi', 'aragosta', 'granchio', 'cozze', 'vongole', 'calamari', 'polpo'],
  soia:        ['soia', 'tofu', 'tempeh', 'edamame', 'salsa di soia'],
  sesamo:      ['sesamo', 'tahina'],
};

// Nomi che contengono una keyword ma NON contengono l'allergene (falsi positivi noti).
const ALLERGEN_EXCEPTIONS = {
  lattosio: ['burro di arachidi', 'burro di mandorle', 'latte di cocco', 'latte di mandorla', 'latte di avena', 'latte di soia', 'latte di riso', 'senza lattosio', 'yogurt di soia', 'yogurt vegetale'],
  glutine:  ['pasta di riso', 'pasta di lenticchie', 'pasta di mais', 'pane senza glutine', 'farina di riso', 'farina di mandorle', 'avena senza glutine', 'senza glutine'],
  uova:     [],
};

export function findAllergenViolations(plan, allergies = []) {
  const out = [];
  const wordMatch = (text, kw) => new RegExp(`(^|[^a-zàèéìòù])${kw}([^a-zàèéìòù]|$)`, 'i').test(text);
  for (const a of allergies) {
    const kws = ALLERGEN_KEYWORDS[a] ?? [a.toLowerCase()];
    const exc = ALLERGEN_EXCEPTIONS[a] ?? [];
    for (const d of plan.days ?? []) for (const m of d.meals ?? []) for (const i of m.items ?? []) {
      const n = i.name.toLowerCase();
      if (exc.some(e => n.includes(e))) continue;
      if (kws.some(k => wordMatch(n, k))) out.push({ day: d.day, slot: m.slot, item: i.name, allergen: a });
    }
  }
  return out;
}

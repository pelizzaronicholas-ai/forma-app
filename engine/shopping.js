// engine/shopping.js
// Lista della spesa settimanale: aggrega le grammature del piano per ingrediente,
// raggruppa per reparto e arrotonda a confezioni. Deterministico, nessuna chiamata API.

const AISLES = {
  protein: 'Macelleria / Pescheria',
  dairy:   'Latticini e uova',
  carb:    'Cereali, pane e pasta',
  veg:     'Frutta e verdura',
  fruit:   'Frutta e verdura',
  fat:     'Condimenti e frutta secca',
  other:   'Altro',
};

// Confezioni tipiche in g: si arrotonda per eccesso al multiplo.
// Chiave = sottostringa del nome alimento (lowercase). Default 100 g.
const PACK_SIZES = [
  ['uovo', 60], ['uova', 60],                 // 1 uovo ≈ 60 g → contiamo pezzi
  ['yogurt', 125], ['skyr', 150],
  ['latte', 500], ['bevanda', 500],
  ['pane', 50], ['fette', 10],
  ['riso', 250], ['pasta', 250], ['avena', 250], ['farro', 250], ['quinoa', 250], ['couscous', 250],
  ['pollo', 100], ['tacchino', 100], ['manzo', 100], ['salmone', 100], ['merluzzo', 100], ['tonno', 80],
  ['olio', 50], ['burro di arachidi', 50], ['mandorle', 50], ['noci', 50],
  ['avocado', 150], ['banana', 120], ['mela', 150], ['arancia', 150], ['kiwi', 80],
];

function normalizeName(name) {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, '')           // rimuovo note tra parentesi
    .replace(/,.*$/, '')               // "pollo, petto" → "pollo"
    .trim();
}

function packFor(name) {
  const n = name.toLowerCase();
  for (const [k, g] of PACK_SIZES) if (n.includes(k)) return g;
  return 100;
}

function pieceUnit(name) {
  const n = name.toLowerCase();
  if (n.includes('uov')) return 'uova';
  if (n.includes('avocado') || n.includes('banana') || n.includes('mela') || n.includes('arancia') || n.includes('kiwi')) return 'pz';
  if (n.includes('yogurt') || n.includes('skyr')) return 'vasetti';
  return null;
}

/**
 * plan: output di submit_weekly_plan (days[].meals[].items[])
 * pantry: array di nomi alimenti già in casa (da escludere)
 * Ritorna { aisles: { [reparto]: [{ name, grams, display, checked:false }] }, totalItems }
 */
export function buildShoppingList(plan, pantry = []) {
  const agg = new Map();
  const skip = new Set(pantry.map(normalizeName));

  for (const d of plan.days ?? []) for (const m of d.meals ?? []) for (const i of m.items ?? []) {
    const key = normalizeName(i.name);
    if (skip.has(key)) continue;
    const cur = agg.get(key) ?? { name: i.name, grams: 0, category: i.category ?? 'other' };
    cur.grams += i.grams ?? 0;
    agg.set(key, cur);
  }

  const aisles = {};
  for (const item of agg.values()) {
    const aisle = AISLES[item.category] ?? AISLES.other;
    const pack = packFor(item.name);
    const unit = pieceUnit(item.name);
    const packs = Math.ceil(item.grams / pack);
    const roundedGrams = packs * pack;
    const display = unit
      ? `${packs} ${unit}`
      : roundedGrams >= 1000 ? `${(roundedGrams / 1000).toFixed(1).replace('.0', '')} kg` : `${roundedGrams} g`;
    (aisles[aisle] ??= []).push({ name: item.name, grams: item.grams, display, checked: false });
  }
  for (const k of Object.keys(aisles)) aisles[k].sort((a, b) => a.name.localeCompare(b.name, 'it'));

  return { aisles, totalItems: agg.size };
}

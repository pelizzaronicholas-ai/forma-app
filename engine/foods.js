// engine/foods.js
import { scaleMealToTarget } from './schemas.js';
// Mini DB alimenti (valori per 100 g crudo, fonte CREA/USDA arrotondati) e generatore
// di piano a regole. Serve come fallback offline e come piano "demo" senza backend.
// tags: allergeni contenuti. slots: dove è sensato usarlo.

export const FOODS = [
  // proteine
  { name: 'Petto di pollo',        cat: 'protein', kcal: 110, p: 23, c: 0,  f: 1.5, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Fesa di tacchino',      cat: 'protein', kcal: 107, p: 24, c: 0,  f: 1,   tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Manzo magro',           cat: 'protein', kcal: 130, p: 21, c: 0,  f: 5,   tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Salmone',               cat: 'protein', kcal: 185, p: 20, c: 0,  f: 12,  tags: ['pesce'],     slots: ['lunch', 'dinner'] },
  { name: 'Merluzzo',              cat: 'protein', kcal: 80,  p: 17, c: 0,  f: 1,   tags: ['pesce'],     slots: ['lunch', 'dinner'] },
  { name: 'Tonno al naturale',     cat: 'protein', kcal: 100, p: 23, c: 0,  f: 1,   tags: ['pesce'],     slots: ['lunch', 'dinner', 'snack1', 'snack2'] },
  { name: 'Uova',                  cat: 'protein', kcal: 140, p: 12.5, c: 1, f: 9.5, tags: ['uova'],     slots: ['breakfast', 'lunch', 'dinner'] },
  { name: 'Albume',                cat: 'protein', kcal: 45,  p: 10.5, c: 0.7, f: 0, tags: ['uova'],    slots: ['breakfast'] },
  { name: 'Tofu',                  cat: 'protein', kcal: 120, p: 12, c: 2,  f: 7,   tags: ['soia'],      slots: ['lunch', 'dinner'] },
  { name: 'Fesa di tacchino a fette', cat: 'protein', kcal: 105, p: 22, c: 1, f: 1.5, tags: [],          slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Proteine in polvere (isolate)', cat: 'protein', kcal: 380, p: 85, c: 5, f: 3, tags: [],     slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Bresaola',              cat: 'protein', kcal: 150, p: 32, c: 0,  f: 2,   tags: [],            slots: ['snack1', 'snack2', 'lunch'] },
  // latticini
  { name: 'Yogurt greco 0%',       cat: 'dairy',   kcal: 57,  p: 10, c: 4,  f: 0.2, tags: ['lattosio'],  slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Skyr',                  cat: 'dairy',   kcal: 63,  p: 11, c: 4,  f: 0.2, tags: ['lattosio'],  slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Fiocchi di latte',      cat: 'dairy',   kcal: 98,  p: 11, c: 3,  f: 4.5, tags: ['lattosio'],  slots: ['breakfast', 'snack2', 'dinner'] },
  { name: 'Latte parzialmente scremato', cat: 'dairy', kcal: 46, p: 3.3, c: 5, f: 1.6, tags: ['lattosio'], slots: ['breakfast'] },
  { name: 'Parmigiano',            cat: 'dairy',   kcal: 390, p: 33, c: 0,  f: 28,  tags: ['lattosio'],  slots: ['lunch', 'dinner'] },
  // carboidrati
  { name: 'Riso basmati',          cat: 'carb',    kcal: 350, p: 7,  c: 78, f: 0.6, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Pasta integrale',       cat: 'carb',    kcal: 340, p: 13, c: 65, f: 2.5, tags: ['glutine'],   slots: ['lunch', 'dinner'] },
  { name: 'Patate',                cat: 'carb',    kcal: 80,  p: 2,  c: 18, f: 0.1, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Pane integrale',        cat: 'carb',    kcal: 245, p: 9,  c: 45, f: 3,   tags: ['glutine'],   slots: ['breakfast', 'lunch', 'snack1', 'snack2'] },
  { name: 'Fiocchi d\'avena',      cat: 'carb',    kcal: 370, p: 13, c: 60, f: 7,   tags: ['glutine'],   slots: ['breakfast'] },
  { name: 'Quinoa',                cat: 'carb',    kcal: 365, p: 14, c: 64, f: 6,   tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Gallette di riso',      cat: 'carb',    kcal: 380, p: 8,  c: 82, f: 2.5, tags: [],            slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Farro',                 cat: 'carb',    kcal: 340, p: 15, c: 67, f: 2.5, tags: ['glutine'],   slots: ['lunch', 'dinner'] },
  // grassi
  { name: 'Olio extravergine d\'oliva', cat: 'fat', kcal: 900, p: 0, c: 0,  f: 100, tags: [],           slots: ['lunch', 'dinner'] },
  { name: 'Mandorle',              cat: 'fat',     kcal: 600, p: 21, c: 9,  f: 50,  tags: ['frutta_secca'], slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Noci',                  cat: 'fat',     kcal: 650, p: 15, c: 7,  f: 62,  tags: ['frutta_secca'], slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Burro di arachidi',     cat: 'fat',     kcal: 590, p: 25, c: 13, f: 50,  tags: ['frutta_secca'], slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Avocado',               cat: 'fat',     kcal: 160, p: 2,  c: 2,  f: 15,  tags: [],            slots: ['breakfast', 'lunch', 'dinner'] },
  { name: 'Cioccolato fondente 85%', cat: 'fat',   kcal: 590, p: 10, c: 20, f: 45,  tags: [],            slots: ['snack1', 'snack2'] },
  // verdure (kcal basse: quota fissa)
  { name: 'Broccoli',              cat: 'veg',     kcal: 30,  p: 3,  c: 3,  f: 0.4, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Zucchine',              cat: 'veg',     kcal: 17,  p: 1.3, c: 3, f: 0.3, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Spinaci',               cat: 'veg',     kcal: 23,  p: 3,  c: 3,  f: 0.4, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Insalata mista',        cat: 'veg',     kcal: 15,  p: 1,  c: 2,  f: 0.2, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Pomodori',              cat: 'veg',     kcal: 18,  p: 1,  c: 3.5, f: 0.2, tags: [],           slots: ['lunch', 'dinner'] },
  { name: 'Peperoni',              cat: 'veg',     kcal: 25,  p: 1,  c: 5,  f: 0.3, tags: [],            slots: ['lunch', 'dinner'] },
  { name: 'Fagiolini',             cat: 'veg',     kcal: 25,  p: 2,  c: 4,  f: 0.2, tags: [],            slots: ['lunch', 'dinner'] },
  // frutta
  { name: 'Banana',                cat: 'fruit',   kcal: 90,  p: 1,  c: 22, f: 0.3, tags: [],            slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Mela',                  cat: 'fruit',   kcal: 52,  p: 0.3, c: 13, f: 0.2, tags: [],           slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Frutti di bosco',       cat: 'fruit',   kcal: 45,  p: 1,  c: 9,  f: 0.5, tags: [],            slots: ['breakfast', 'snack1', 'snack2'] },
  { name: 'Arancia',               cat: 'fruit',   kcal: 45,  p: 1,  c: 10, f: 0.2, tags: [],            slots: ['snack1', 'snack2'] },
];

const VEG_GRAMS = 200;

function scaled(food, grams) {
  const k = grams / 100;
  return {
    name: food.name, category: food.cat, grams: Math.round(grams),
    kcal: Math.round(food.kcal * k), protein: +(food.p * k).toFixed(1),
    carbs: +(food.c * k).toFixed(1), fat: +(food.f * k).toFixed(1),
  };
}

/** Filtra il DB per allergie ed esclusioni. */
export function availableFoods({ allergies = [], dislikes = [] } = {}) {
  const dis = dislikes.map(d => d.toLowerCase());
  return FOODS.filter(f =>
    !f.tags.some(t => allergies.includes(t)) &&
    !dis.some(d => f.name.toLowerCase().includes(d)));
}

/**
 * Compone un pasto per lo slot dato con target {kcal, protein, carbs, fat}.
 * Strategia: verdura fissa (pranzo/cena), poi risolvo in sequenza
 * proteina → grasso → carbo per far tornare i macro. 3 passate per convergere.
 */
export function composeMeal(slot, target, foods, seed = 0) {
  // Rapporto grassi/proteine ammesso per la fonte proteica: se il target è magro
  // (cut) scarto uova/salmone e tengo le fonti magre, altrimenti va bene tutto.
  const maxFatRatio = (target.fat / Math.max(1, target.protein)) * 1.2 + 0.05;
  const pick = (cat) => {
    let pool = foods.filter(f => f.cat === cat && f.slots.includes(slot));
    if (cat === 'protein' || cat === 'dairy') {
      const lean = pool.filter(f => f.f / Math.max(1, f.p) <= maxFatRatio);
      pool = lean.length ? lean : pool.sort((a, b) => a.f / a.p - b.f / b.p).slice(0, 1);
    }
    return pool.length ? pool[seed % pool.length] : null;
  };
  const isMain = slot === 'lunch' || slot === 'dinner';
  const veg = isMain ? pick('veg') : null;
  // A colazione/spuntini la fonte proteica preferita è un latticino, se disponibile
  const prot = (!isMain && pick('dairy')) || pick('protein') || pick('dairy');
  const carb = pick('carb') || pick('fruit');
  const fat = pick('fat');
  const fruit = !isMain ? pick('fruit') : null;

  const items = [];
  const base = { kcal: 0, p: 0, c: 0, f: 0 };
  if (veg) { const v = scaled(veg, VEG_GRAMS); items.push(v); base.p += v.protein; base.c += v.carbs; base.f += v.fat; }
  if (fruit) { const fr = scaled(fruit, 100); items.push(fr); base.p += fr.protein; base.c += fr.carbs; base.f += fr.fat; }

  // Variabili: grammi proteina gp, grassi gf, carbo gc. Sistema lineare 3x3 risolto per sostituzione iterativa.
  let gp = 0, gf = 0, gc = 0;
  for (let i = 0; i < 4; i++) {
    gp = prot ? Math.max(0, (target.protein - base.p - (carb?.p ?? 0) * gc / 100 - (fat?.p ?? 0) * gf / 100) / (prot.p / 100)) : 0;
    gf = fat ? Math.max(0, (target.fat - base.f - (prot?.f ?? 0) * gp / 100 - (carb?.f ?? 0) * gc / 100) / (fat.f / 100)) : 0;
    gc = carb ? Math.max(0, (target.carbs - base.c - (prot?.c ?? 0) * gp / 100 - (fat?.c ?? 0) * gf / 100) / (carb.c / 100)) : 0;
  }
  // Porzioni minime sensate: sotto soglia l'alimento viene omesso (poi si riscala al target kcal).
  const r5 = g => Math.round(g / 5) * 5;
  const MIN = { protein: 20, dairy: 50, carb: 20, fruit: 50, fat: 10 };
  if (prot && r5(gp) >= MIN[prot.cat]) items.push(scaled(prot, r5(gp)));
  if (carb && r5(gc) >= MIN[carb.cat]) items.push(scaled(carb, r5(gc)));
  if (fat && r5(gf) >= MIN.fat) items.push(scaled(fat, r5(gf)));

  const title = [prot?.name, carb?.name, veg?.name].filter(Boolean).join(', ');
  // Le fonti "sporche" (salmone, uova, mandorle) fanno sforare le kcal: chiudo riscalando al target.
  return scaleMealToTarget({ slot, title, items, prepMinutes: isMain ? 25 : 5 }, target.kcal);
}

/**
 * Piano settimanale a regole: ruota le fonti giorno per giorno per varietà.
 * mealTargets: output di mealPlanTargets(). prefs: { allergies, dislikes }.
 */
export function generateRulePlan(mealTargets, prefs = {}) {
  const foods = availableFoods(prefs);
  const days = [];
  for (let d = 1; d <= 7; d++) {
    const meals = mealTargets.map((t, i) => composeMeal(t.id, t, foods, d + i));
    days.push({ day: d, meals });
  }
  return { days, notes: 'Piano generato a regole (offline). Le grammature sono a crudo. Verdure e spezie a piacere.' };
}

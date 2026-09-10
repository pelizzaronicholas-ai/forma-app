// engine/nutrition.js
// Motore deterministico: fabbisogno calorico, macro, distribuzione pasti.
// Nessuna dipendenza, ES module, usabile sia nel browser che in Node (test).
// Tutte le unità: kg, cm, anni, kcal, grammi.

export const ACTIVITY_FACTORS = {
  sedentary:   { factor: 1.2,   label: 'Sedentario',        desc: 'Lavoro da scrivania, poco movimento' },
  light:       { factor: 1.375, label: 'Leggero',           desc: 'Attività leggera 1-3 giorni/sett.' },
  moderate:    { factor: 1.55,  label: 'Moderato',          desc: 'Allenamento 3-5 giorni/sett.' },
  active:      { factor: 1.725, label: 'Attivo',            desc: 'Allenamento intenso 6-7 giorni/sett. o lavoro fisico' },
  very_active: { factor: 1.9,   label: 'Molto attivo',      desc: 'Lavoro fisico pesante + allenamento quotidiano' },
};

export const GOALS = {
  cut:       { label: 'Perdere grasso',      desc: 'Deficit calorico controllato' },
  maintain:  { label: 'Mantenere',           desc: 'Ricomposizione / mantenimento' },
  bulk:      { label: 'Aumentare massa',     desc: 'Surplus calorico moderato' },
};

// Velocità obiettivo: variazione peso settimanale target in % del peso corporeo.
// 7700 kcal ≈ 1 kg di tessuto adiposo (approssimazione standard).
export const PACE = {
  slow:     { pctPerWeek: 0.25, label: 'Lenta',    desc: '~0.25% peso/sett. — massima conservazione muscolare' },
  moderate: { pctPerWeek: 0.5,  label: 'Moderata', desc: '~0.5% peso/sett. — consigliata' },
  fast:     { pctPerWeek: 0.75, label: 'Veloce',   desc: '~0.75% peso/sett. — solo con molto grasso da perdere' },
};

const KCAL_PER_KG = 7700;

// Distribuzione percentuale delle kcal giornaliere sui pasti.
// Le percentuali sommano a 1. Lo slot "post_workout" è opzionale e viene
// gestito spostando kcal dallo spuntino più vicino (v2).
export const MEAL_SCHEMES = {
  3: [
    { id: 'breakfast', label: 'Colazione', pct: 0.30 },
    { id: 'lunch',     label: 'Pranzo',    pct: 0.40 },
    { id: 'dinner',    label: 'Cena',      pct: 0.30 },
  ],
  5: [
    { id: 'breakfast', label: 'Colazione',           pct: 0.25 },
    { id: 'snack1',    label: 'Spuntino mattina',    pct: 0.10 },
    { id: 'lunch',     label: 'Pranzo',              pct: 0.30 },
    { id: 'snack2',    label: 'Spuntino pomeriggio', pct: 0.10 },
    { id: 'dinner',    label: 'Cena',                pct: 0.25 },
  ],
};

/**
 * BMR Mifflin-St Jeor (1990). Errore medio ±10% sulla popolazione generale.
 * sex: 'm' | 'f'
 */
export function bmrMifflin({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'm' ? base + 5 : base - 161;
}

/**
 * BMR Katch-McArdle: usa la massa magra, più accurato se la % grasso è nota
 * (plicometria, BIA, DEXA). bodyFatPct in [3, 60].
 */
export function bmrKatch({ weightKg, bodyFatPct }) {
  const lbm = weightKg * (1 - bodyFatPct / 100);
  return 370 + 21.6 * lbm;
}

export function bmr(profile) {
  if (profile.bodyFatPct != null && profile.bodyFatPct >= 3 && profile.bodyFatPct <= 60) {
    return bmrKatch(profile);
  }
  return bmrMifflin(profile);
}

export function tdee(profile) {
  const f = ACTIVITY_FACTORS[profile.activity]?.factor;
  if (!f) throw new Error(`activity non valida: ${profile.activity}`);
  return bmr(profile) * f;
}

/**
 * Target calorico giornaliero con guardrail:
 *  - deficit massimo 25% del TDEE
 *  - mai sotto 1.1 × BMR
 *  - mai sotto 1200 kcal (F) / 1500 kcal (M) — soglia sotto cui serve supervisione medica
 *  - surplus massimo +15% del TDEE (oltre è quasi tutto grasso)
 */
export function targetCalories(profile) {
  const b = bmr(profile);
  const t = tdee(profile);
  const pace = PACE[profile.pace ?? 'moderate'].pctPerWeek / 100;
  const weeklyDeltaKg = profile.weightKg * pace;
  let dailyDelta = (weeklyDeltaKg * KCAL_PER_KG) / 7;

  let target;
  const warnings = [];

  switch (profile.goal) {
    case 'cut': {
      dailyDelta = Math.min(dailyDelta, t * 0.25);
      target = t - dailyDelta;
      const floor = Math.max(b * 1.1, profile.sex === 'm' ? 1500 : 1200);
      if (target < floor) {
        warnings.push(`Deficit ridotto: il target è stato alzato a ${Math.round(floor)} kcal per restare sopra la soglia di sicurezza.`);
        target = floor;
      }
      break;
    }
    case 'bulk': {
      // In surplus si usa metà del ritmo: il tessuto costruito non è tutto muscolo
      dailyDelta = Math.min(dailyDelta * 0.5, t * 0.15);
      target = t + dailyDelta;
      break;
    }
    case 'maintain':
    default:
      target = t;
      break;
  }

  return {
    bmr: Math.round(b),
    tdee: Math.round(t),
    target: Math.round(target / 10) * 10, // arrotondo a 10 kcal
    dailyDelta: Math.round(target - t),
    expectedWeeklyChangeKg: +(((target - t) * 7) / KCAL_PER_KG).toFixed(2),
    warnings,
  };
}

/**
 * Split macro. Proteine e grassi in g/kg, carboidrati a chiudere.
 * Riferimenti: proteine 1.6–2.2 g/kg (Morton 2018), grassi ≥0.8 g/kg per
 * funzione ormonale, carbo in base al residuo con minimo 100 g/die.
 * Se profile.bodyFatPct è alta (>30%) le proteine si calcolano sul peso
 * "target" (LBM/0.75) per non sovrastimarle.
 */
export function macros(profile, targetKcal) {
  const gPerKg = { cut: 2.2, maintain: 1.8, bulk: 1.8 }[profile.goal] ?? 1.8;
  const fatPerKg = { cut: 0.8, maintain: 1.0, bulk: 1.0 }[profile.goal] ?? 1.0;

  let refWeight = profile.weightKg;
  if (profile.bodyFatPct != null && profile.bodyFatPct > 30) {
    const lbm = profile.weightKg * (1 - profile.bodyFatPct / 100);
    refWeight = lbm / 0.75;
  }

  let protein = Math.round(refWeight * gPerKg);
  let fat = Math.round(refWeight * fatPerKg);
  let carbs = Math.round((targetKcal - protein * 4 - fat * 9) / 4);

  const warnings = [];
  if (carbs < 100) {
    // Riduco i grassi fino a 0.7 g/kg prima di accettare carbo bassi
    const minFat = Math.round(refWeight * 0.7);
    const needed = (100 - carbs) * 4;
    const fatCut = Math.min(fat - minFat, Math.ceil(needed / 9));
    if (fatCut > 0) { fat -= fatCut; carbs = Math.round((targetKcal - protein * 4 - fat * 9) / 4); }
    if (carbs < 100) warnings.push('Carboidrati sotto 100 g/die: il target calorico è molto basso per il tuo peso.');
  }

  const kcal = protein * 4 + carbs * 4 + fat * 9;
  return {
    protein, carbs, fat,
    kcal,
    pct: {
      protein: Math.round((protein * 4 / kcal) * 100),
      carbs:   Math.round((carbs * 4 / kcal) * 100),
      fat:     Math.round((fat * 9 / kcal) * 100),
    },
    fiberTarget: Math.round(targetKcal / 1000 * 14), // 14 g / 1000 kcal (IOM)
    waterMl: Math.round(profile.weightKg * 35),
    warnings,
  };
}

/**
 * Distribuisce kcal e macro sui pasti secondo lo schema scelto (3 o 5).
 * Le proteine vengono distribuite in modo più uniforme delle kcal
 * (≥ 0.4 g/kg per pasto principale favorisce la sintesi proteica).
 */
export function mealPlanTargets(macro, mealsPerDay = 3) {
  const scheme = MEAL_SCHEMES[mealsPerDay];
  if (!scheme) throw new Error(`mealsPerDay deve essere 3 o 5, ricevuto ${mealsPerDay}`);

  const mains = scheme.filter(m => !m.id.startsWith('snack'));
  const snacks = scheme.filter(m => m.id.startsWith('snack'));

  // Proteine: 15% per spuntino, il resto equamente sui principali
  const snackProt = snacks.length ? Math.round(macro.protein * 0.15) : 0;
  const mainProt = Math.round((macro.protein - snackProt * snacks.length) / mains.length);

  const meals = scheme.map(m => {
    const kcal = Math.round(macro.kcal * m.pct);
    const protein = m.id.startsWith('snack') ? snackProt : mainProt;
    const fat = Math.round(macro.fat * m.pct);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { id: m.id, label: m.label, kcal, protein, carbs, fat };
  });

  // Correggo l'errore di arrotondamento sull'ultimo pasto principale
  const sum = k => meals.reduce((a, m) => a + m[k], 0);
  const last = meals.filter(m => !m.id.startsWith('snack')).at(-1);
  last.protein += macro.protein - sum('protein');
  last.carbs   += macro.carbs - sum('carbs');
  last.fat     += macro.fat - sum('fat');
  last.kcal = last.protein * 4 + last.carbs * 4 + last.fat * 9;

  return meals;
}

/** Pipeline completa: profilo → piano numerico. */
export function computePlan(profile) {
  const cal = targetCalories(profile);
  const mac = macros(profile, cal.target);
  const meals = mealPlanTargets(mac, profile.mealsPerDay ?? 3);
  return {
    ...cal,
    macros: mac,
    meals,
    warnings: [...cal.warnings, ...mac.warnings],
  };
}

/** BMI e classificazione — solo informativo, non guida il piano. */
export function bmi({ weightKg, heightCm }) {
  const v = weightKg / ((heightCm / 100) ** 2);
  const cls = v < 18.5 ? 'Sottopeso' : v < 25 ? 'Normopeso' : v < 30 ? 'Sovrappeso' : 'Obesità';
  return { value: +v.toFixed(1), class: cls };
}

/**
 * Ricalcolo periodico: confronta variazione reale vs attesa su N settimane
 * e propone un aggiustamento del target (±100/150 kcal). Da chiamare ogni 2 settimane.
 */
export function adjustTarget({ plan, weights, weeks = 2 }) {
  if (weights.length < 2) return { adjust: 0, reason: 'Servono almeno due pesate.' };
  const actual = weights.at(-1) - weights[0];
  const expected = plan.expectedWeeklyChangeKg * weeks;
  const diff = actual - expected;
  // Tolleranza ±0.3 kg per settimana di rumore (acqua, glicogeno)
  if (Math.abs(diff) <= 0.3 * weeks) return { adjust: 0, reason: 'In linea con l\'atteso.' };
  const adjust = diff > 0 ? -100 : +100;
  return { adjust, reason: diff > 0
    ? 'Stai perdendo meno / prendendo più del previsto: riduco di 100 kcal.'
    : 'Stai perdendo più / prendendo meno del previsto: aumento di 100 kcal.' };
}

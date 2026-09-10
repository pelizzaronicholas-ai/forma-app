// engine/training.js
// Motore allenamenti a template: sceglie lo split in base a giorni/minuti/attrezzatura,
// riempie le sedute dal DB esercizi e applica una progressione lineare settimanale.
// L'LLM interviene solo per adattamenti (infortuni, esercizi sgraditi) — vedi backend.

export const EQUIPMENT = {
  none:  { label: 'Corpo libero',  desc: 'Nessuna attrezzatura' },
  home:  { label: 'Casa',          desc: 'Manubri, elastici, barra trazioni' },
  gym:   { label: 'Palestra',      desc: 'Bilancieri, macchine, cavi' },
};

export const LEVELS = {
  beginner:     { label: 'Principiante',  desc: '< 1 anno di allenamento costante' },
  intermediate: { label: 'Intermedio',    desc: '1-3 anni' },
  advanced:     { label: 'Avanzato',      desc: '> 3 anni' },
};

// DB esercizi. pattern: movimento primario. eq: attrezzature in cui è eseguibile.
// tier: 1 = fondamentale (multiarticolare), 2 = accessorio, 3 = isolamento.
export const EXERCISES = [
  // --- Lower push (squat pattern)
  { id: 'back_squat',     name: 'Squat con bilanciere',      pattern: 'squat', eq: ['gym'],               tier: 1 },
  { id: 'goblet_squat',   name: 'Goblet squat',              pattern: 'squat', eq: ['home', 'gym'],       tier: 1 },
  { id: 'bw_squat',       name: 'Squat a corpo libero',      pattern: 'squat', eq: ['none'],              tier: 1 },
  { id: 'leg_press',      name: 'Leg press',                 pattern: 'squat', eq: ['gym'],               tier: 2 },
  { id: 'split_squat',    name: 'Affondi bulgari',           pattern: 'squat', eq: ['none', 'home', 'gym'], tier: 2 },
  { id: 'leg_ext',        name: 'Leg extension',             pattern: 'squat', eq: ['gym'],               tier: 3 },
  // --- Lower pull (hinge)
  { id: 'deadlift',       name: 'Stacco da terra',           pattern: 'hinge', eq: ['gym'],               tier: 1 },
  { id: 'rdl',            name: 'Stacco rumeno',             pattern: 'hinge', eq: ['home', 'gym'],       tier: 1 },
  { id: 'hip_thrust',     name: 'Hip thrust',                pattern: 'hinge', eq: ['home', 'gym'],       tier: 2 },
  { id: 'glute_bridge',   name: 'Glute bridge',              pattern: 'hinge', eq: ['none'],              tier: 2 },
  { id: 'leg_curl',       name: 'Leg curl',                  pattern: 'hinge', eq: ['gym'],               tier: 3 },
  { id: 'nordic',         name: 'Nordic curl assistito',     pattern: 'hinge', eq: ['none', 'home'],      tier: 3 },
  // --- Horizontal push
  { id: 'bench',          name: 'Panca piana',               pattern: 'h_push', eq: ['gym'],              tier: 1 },
  { id: 'db_bench',       name: 'Panca con manubri',         pattern: 'h_push', eq: ['home', 'gym'],      tier: 1 },
  { id: 'pushup',         name: 'Piegamenti',                pattern: 'h_push', eq: ['none', 'home'],     tier: 1 },
  { id: 'decline_pushup', name: 'Piegamenti declinati',      pattern: 'h_push', eq: ['none', 'home'],     tier: 2 },
  { id: 'diamond_pushup', name: 'Piegamenti diamante',       pattern: 'h_push', eq: ['none', 'home'],     tier: 3 },
  { id: 'chair_dips',     name: 'Dip tra due sedie',         pattern: 'h_push', eq: ['none'],             tier: 2 },
  { id: 'incline_db',     name: 'Panca inclinata manubri',   pattern: 'h_push', eq: ['home', 'gym'],      tier: 2 },
  { id: 'dips',           name: 'Dip alle parallele',        pattern: 'h_push', eq: ['home', 'gym'],      tier: 2 },
  { id: 'cable_fly',      name: 'Croci ai cavi',             pattern: 'h_push', eq: ['gym'],              tier: 3 },
  // --- Vertical push
  { id: 'ohp',            name: 'Military press',            pattern: 'v_push', eq: ['gym'],              tier: 1 },
  { id: 'db_ohp',         name: 'Lento con manubri',         pattern: 'v_push', eq: ['home', 'gym'],      tier: 1 },
  { id: 'pike_pushup',    name: 'Pike push-up',              pattern: 'v_push', eq: ['none'],             tier: 1 },
  { id: 'wall_hs_hold',   name: 'Tenuta in verticale al muro', pattern: 'v_push', eq: ['none', 'home'],   tier: 2 },
  { id: 'band_lat_raise', name: 'Alzate laterali con elastico', pattern: 'v_push', eq: ['none'],          tier: 3 },
  { id: 'lat_raise',      name: 'Alzate laterali',           pattern: 'v_push', eq: ['home', 'gym'],      tier: 3 },
  // --- Horizontal pull
  { id: 'bb_row',         name: 'Rematore con bilanciere',   pattern: 'h_pull', eq: ['gym'],              tier: 1 },
  { id: 'db_row',         name: 'Rematore con manubrio',     pattern: 'h_pull', eq: ['home', 'gym'],      tier: 1 },
  { id: 'inv_row',        name: 'Rematore inverso',          pattern: 'h_pull', eq: ['none', 'home'],     tier: 1 },
  { id: 'towel_row',      name: 'Rematore con asciugamano (porta)', pattern: 'h_pull', eq: ['none'],      tier: 2 },
  { id: 'band_face_pull', name: 'Face pull con elastico',    pattern: 'h_pull', eq: ['none'],             tier: 3 },
  { id: 'cable_row',      name: 'Pulley basso',              pattern: 'h_pull', eq: ['gym'],              tier: 2 },
  { id: 'face_pull',      name: 'Face pull',                 pattern: 'h_pull', eq: ['home', 'gym'],      tier: 3 },
  // --- Vertical pull
  { id: 'pullup',         name: 'Trazioni',                  pattern: 'v_pull', eq: ['home', 'gym'],      tier: 1 },
  { id: 'lat_pulldown',   name: 'Lat machine',               pattern: 'v_pull', eq: ['gym'],              tier: 1 },
  { id: 'band_pulldown',  name: 'Pulldown con elastico',     pattern: 'v_pull', eq: ['none', 'home'],     tier: 2 },
  { id: 'band_curl',      name: 'Curl con elastico',         pattern: 'v_pull', eq: ['none'],             tier: 3 },
  { id: 'bicep_curl',     name: 'Curl bicipiti',             pattern: 'v_pull', eq: ['home', 'gym'],      tier: 3 },
  // --- Core / accessori
  { id: 'plank',          name: 'Plank',                     pattern: 'core', eq: ['none', 'home', 'gym'], tier: 2 },
  { id: 'deadbug',        name: 'Dead bug',                  pattern: 'core', eq: ['none', 'home', 'gym'], tier: 2 },
  { id: 'hanging_raise',  name: 'Sollevamento gambe alla sbarra', pattern: 'core', eq: ['home', 'gym'],  tier: 2 },
  { id: 'tricep_ext',     name: 'Estensioni tricipiti',      pattern: 'core', eq: ['home', 'gym'],        tier: 3 }, // accessorio "riempitivo"
];

// Template sedute: lista di pattern con tier richiesto e schema serie×rep.
// rep range per obiettivo: forza 4-6, ipertrofia 8-12, resistenza 12-20.
const SESSION_TEMPLATES = {
  full_body: [
    { pattern: 'squat',  tier: 1 }, { pattern: 'h_push', tier: 1 }, { pattern: 'h_pull', tier: 1 },
    { pattern: 'hinge',  tier: 1 }, { pattern: 'v_push', tier: 2 }, { pattern: 'v_pull', tier: 2 },
    { pattern: 'core',   tier: 2 },
  ],
  upper: [
    { pattern: 'h_push', tier: 1 }, { pattern: 'h_pull', tier: 1 }, { pattern: 'v_push', tier: 1 },
    { pattern: 'v_pull', tier: 1 }, { pattern: 'h_push', tier: 3 }, { pattern: 'v_pull', tier: 3 }, { pattern: 'v_push', tier: 3 },
  ],
  lower: [
    { pattern: 'squat', tier: 1 }, { pattern: 'hinge', tier: 1 }, { pattern: 'squat', tier: 2 },
    { pattern: 'hinge', tier: 2 }, { pattern: 'squat', tier: 3 }, { pattern: 'hinge', tier: 3 }, { pattern: 'core', tier: 2 },
  ],
  push: [
    { pattern: 'h_push', tier: 1 }, { pattern: 'v_push', tier: 1 }, { pattern: 'h_push', tier: 2 },
    { pattern: 'v_push', tier: 3 }, { pattern: 'h_push', tier: 3 }, { pattern: 'core', tier: 3 },
  ],
  pull: [
    { pattern: 'v_pull', tier: 1 }, { pattern: 'h_pull', tier: 1 }, { pattern: 'h_pull', tier: 2 },
    { pattern: 'h_pull', tier: 3 }, { pattern: 'v_pull', tier: 3 }, { pattern: 'core', tier: 2 },
  ],
  legs: [
    { pattern: 'squat', tier: 1 }, { pattern: 'hinge', tier: 1 }, { pattern: 'squat', tier: 2 },
    { pattern: 'hinge', tier: 2 }, { pattern: 'squat', tier: 3 }, { pattern: 'hinge', tier: 3 },
  ],
};

const SPLIT_LABELS = { full_body: 'Full body', upper_lower: 'Upper / Lower', ppl_ul: 'Push / Pull / Legs + Upper / Lower', ppl: 'Push / Pull / Legs' };

const SESSION_LABELS = {
  full_body: 'Full body', upper: 'Upper', lower: 'Lower', push: 'Push', pull: 'Pull', legs: 'Legs',
};

/** Sceglie lo split in base ai giorni disponibili e al livello. */
export function chooseSplit({ daysPerWeek, level, equipment }) {
  if (daysPerWeek <= 3) return { id: 'full_body', days: Array(daysPerWeek).fill('full_body') };
  if (daysPerWeek === 4) return { id: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower'] };
  // Principianti e corpo libero: oltre 4 giorni resta upper/lower (PPL a corpo libero non ha abbastanza varietà)
  if (level === 'beginner' || equipment === 'none') return { id: 'upper_lower', days: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower'].slice(0, daysPerWeek) };
  if (daysPerWeek === 5) return { id: 'ppl_ul', days: ['push', 'pull', 'legs', 'upper', 'lower'] };
  return { id: 'ppl', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
}

/** Numero esercizi per seduta in base ai minuti (≈ 8-10 min per esercizio incluso riscaldamento). */
export function exercisesForMinutes(minutes) {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  return 7;
}

function repScheme(goal, tier, level) {
  // Fondamentali: più pesanti; isolamento: più rep
  const base = {
    strength:    { 1: [4, 6],  2: [6, 8],   3: [8, 12] },
    hypertrophy: { 1: [6, 8],  2: [8, 12],  3: [12, 15] },
    endurance:   { 1: [10, 15], 2: [12, 15], 3: [15, 20] },
  }[goal] ?? { 1: [6, 8], 2: [8, 12], 3: [12, 15] };
  const sets = level === 'beginner' ? (tier === 1 ? 3 : 2) : (tier === 1 ? 4 : 3);
  const [lo, hi] = base[tier];
  return { sets, repMin: lo, repMax: hi, restSec: tier === 1 ? 150 : tier === 2 ? 90 : 60 };
}

function pickExercise(pattern, tier, equipment, used, excluded, rotate = 0) {
  const pool = EXERCISES.filter(e =>
    e.pattern === pattern && e.eq.includes(equipment) && !used.has(e.id) && !excluded.has(e.id));
  // Preferisco il tier richiesto, altrimenti il più vicino; tra quelli dello stesso tier
  // ruoto in base alla seduta (rotate) per variare le sedute A/B/C.
  const sorted = pool.sort((a, b) => Math.abs(a.tier - tier) - Math.abs(b.tier - tier));
  if (!sorted.length) return null;
  const bestDist = Math.abs(sorted[0].tier - tier);
  const top = sorted.filter(e => Math.abs(e.tier - tier) === bestDist);
  return top[rotate % top.length];
}

/**
 * Genera il programma settimanale.
 * profile: { daysPerWeek, minutesPerSession, equipment, level, trainingGoal, excludedExercises? }
 */
export function buildProgram(profile) {
  const {
    daysPerWeek = 3, minutesPerSession = 60, equipment = 'gym',
    level = 'beginner', trainingGoal = 'hypertrophy', excludedExercises = [],
  } = profile;
  if (daysPerWeek < 1 || daysPerWeek > 6) throw new Error('daysPerWeek deve essere 1-6');

  const split = chooseSplit({ daysPerWeek, level, equipment });
  const nEx = exercisesForMinutes(minutesPerSession);
  const excluded = new Set(excludedExercises);

  const sessions = split.days.map((type, i) => {
    const used = new Set();
    const exercises = [];
    const nth = split.days.slice(0, i).filter(d => d === type).length; // 0 = A, 1 = B, ...
    for (const slot of SESSION_TEMPLATES[type]) {
      if (exercises.length >= nEx) break;
      const ex = pickExercise(slot.pattern, slot.tier, equipment, used, excluded, nth);
      if (!ex) continue;
      used.add(ex.id);
      exercises.push({ ...ex, ...repScheme(trainingGoal, ex.tier, level) });
    }
    const repeats = split.days.filter(d => d === type).length;
    const label = repeats > 1 ? `${SESSION_LABELS[type]} ${String.fromCharCode(65 + nth)}` : SESSION_LABELS[type];
    return { day: i + 1, type, label, exercises };
  });

  return {
    split: split.id,
    splitLabel: SPLIT_LABELS[split.id],
    daysPerWeek, minutesPerSession, equipment, level, trainingGoal,
    sessions,
    progression: progressionRules(level),
    warmup: 'Riscaldamento 5-8 min: mobilità articolare + 2 serie di avvicinamento sul primo esercizio (50% e 75% del carico di lavoro).',
  };
}

/** Regole di progressione lineare (double progression). */
export function progressionRules(level) {
  return {
    rule: 'double_progression',
    text: level === 'beginner'
      ? 'Quando completi tutte le serie al limite alto del range di ripetizioni, aumenta il carico alla seduta successiva (+2.5 kg upper, +5 kg lower). Se fallisci due volte lo stesso carico, riduci del 10% e risali.'
      : 'Double progression: aumenta le ripetizioni fino al limite alto del range, poi aumenta il carico (+2.5% circa) e riparti dal limite basso. Ogni 4-6 settimane una settimana di scarico al 60% del volume.',
    deloadEveryWeeks: level === 'beginner' ? 8 : 5,
  };
}

/** Sostituisce un esercizio con un'alternativa dello stesso pattern (senza LLM). */
export function substituteExercise(program, sessionIdx, exerciseId, extraExcluded = []) {
  const session = program.sessions[sessionIdx];
  const idx = session.exercises.findIndex(e => e.id === exerciseId);
  if (idx < 0) return null;
  const old = session.exercises[idx];
  const used = new Set(session.exercises.map(e => e.id));
  const excluded = new Set([exerciseId, ...extraExcluded]);
  const alt = pickExercise(old.pattern, old.tier, program.equipment, used, excluded);
  if (!alt) return null;
  session.exercises[idx] = { ...alt, sets: old.sets, repMin: old.repMin, repMax: old.repMax, restSec: old.restSec };
  return session.exercises[idx];
}

/** Stima del dispendio per seduta (MET ~5 per resistance training moderato). Solo informativo. */
export function sessionKcal({ weightKg, minutesPerSession }) {
  return Math.round(5 * weightKg * (minutesPerSession / 60));
}

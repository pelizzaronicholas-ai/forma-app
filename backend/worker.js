// backend/worker.js — Cloudflare Worker
// Proxy verso l'API Anthropic. La API key NON esce mai dal Worker.
// Endpoint: POST /plan, /substitute, /recipes, /adapt-training
// Il modello risponde SOLO tramite tool-use (tool_choice forzato), il JSON viene validato qui
// e — se sfora i target — riscalato o rigenerato una volta prima di restituirlo.
//
// Deploy:  npm i -g wrangler && wrangler login && wrangler secret put ANTHROPIC_API_KEY && wrangler deploy
// Rate limit: KV namespace RATE (binding) — 20 richieste/utente/giorno per default.

import { TOOL_WEEKLY_PLAN, TOOL_SUBSTITUTE, TOOL_RECIPES, TOOL_ADAPT_TRAINING,
         validatePlan, scaleMealToTarget, findAllergenViolations } from '../engine/schemas.js';

const MODEL = 'claude-sonnet-4-5';
const MAX_PER_DAY = 20;

const CORS = {
  'Access-Control-Allow-Origin': '*', // in produzione: dominio della PWA
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SYSTEM = `Sei un nutrizionista e personal trainer che lavora per un'app. Rispondi SOLO usando il tool fornito.
Regole non negoziabili:
- I target kcal e macro di ogni pasto sono vincoli rigidi: ogni pasto deve stare entro ±5% kcal e proteine ≥ target.
- Compila kcal, protein, carbs, fat per OGNI alimento usando valori nutrizionali standard per 100 g crudo (tabelle CREA/USDA).
- Alimenti reali, reperibili in un supermercato italiano, nomi in italiano. Grammature a multipli di 5 g.
- Allergie ed esclusioni dell'utente sono assolute: mai includere quegli alimenti né derivati.
- Varietà: non ripetere lo stesso pasto principale più di 2 volte a settimana. Verdure a ogni pranzo e cena.
- Tempo di preparazione coerente con quanto indicato dall'utente.
- Nessun testo fuori dal tool. Nessun consiglio medico.`;

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    const url = new URL(req.url);
    const userId = await authenticate(req, env);
    if (!userId) return json({ error: 'unauthorized' }, 401);
    if (!(await rateLimitOk(env, userId))) return json({ error: 'rate_limited', message: `Limite di ${MAX_PER_DAY} generazioni al giorno raggiunto.` }, 429);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

    try {
      switch (url.pathname) {
        case '/plan':           return json(await handlePlan(body, env));
        case '/substitute':     return json(await handleSubstitute(body, env));
        case '/recipes':        return json(await handleRecipes(body, env));
        case '/adapt-training': return json(await handleAdaptTraining(body, env));
        default:                return json({ error: 'not_found' }, 404);
      }
    } catch (e) {
      return json({ error: 'internal', message: String(e.message ?? e) }, 500);
    }
  },
};

// ---------------------------------------------------------------------------

async function handlePlan({ profile, mealTargets, prefs }, env) {
  if (!Array.isArray(mealTargets) || !mealTargets.length) throw new Error('mealTargets mancanti');
  const prompt = `Profilo: ${JSON.stringify(profile)}
Preferenze: ${JSON.stringify(prefs)}
Target per ogni pasto (validi per tutti i 7 giorni):
${mealTargets.map(m => `- ${m.id} (${m.label}): ${m.kcal} kcal, P ${m.protein} g, C ${m.carbs} g, F ${m.fat} g`).join('\n')}
Genera il piano di 7 giorni.`;

  let plan = await callTool(env, TOOL_WEEKLY_PLAN, prompt);
  let v = validatePlan(plan, mealTargets);
  let allergens = findAllergenViolations(plan, prefs?.allergies ?? []);

  // Un tentativo di correzione guidata, poi riscalo in codice ciò che resta.
  if (!v.ok || allergens.length) {
    const fix = `Il piano precedente ha questi errori, correggili mantenendo tutto il resto:\n${[...v.errors, ...allergens.map(a => `Giorno ${a.day} ${a.slot}: "${a.item}" contiene ${a.allergen} (VIETATO)`)].join('\n')}`;
    plan = await callTool(env, TOOL_WEEKLY_PLAN, prompt + '\n\n' + fix);
    allergens = findAllergenViolations(plan, prefs?.allergies ?? []);
    if (allergens.length) throw new Error('Il modello ha reinserito allergeni: ' + allergens.map(a => a.item).join(', '));
  }

  // Riscalo in codice ogni pasto al target kcal esatto (verdure escluse).
  const byId = Object.fromEntries(mealTargets.map(m => [m.id, m]));
  plan.days = plan.days.map(d => ({ ...d, meals: d.meals.map(m => byId[m.slot] ? scaleMealToTarget(m, byId[m.slot].kcal) : m) }));
  v = validatePlan(plan, mealTargets);

  return { plan, validation: v, source: 'llm', model: MODEL };
}

async function handleSubstitute({ meal, target, remove, prefs }, env) {
  const prompt = `Pasto attuale: ${JSON.stringify(meal)}
Target del pasto: ${JSON.stringify(target)}
Sostituisci: "${remove}" (l'utente non lo vuole).
Preferenze/allergie: ${JSON.stringify(prefs)}
Restituisci il pasto completo modificato.`;
  const r = await callTool(env, TOOL_SUBSTITUTE, prompt);
  const bad = findAllergenViolations({ days: [{ day: 1, meals: [r.meal] }] }, prefs?.allergies ?? []);
  if (bad.length) throw new Error('Sostituzione con allergene: ' + bad.map(b => b.item).join(', '));
  r.meal = scaleMealToTarget(r.meal, target.kcal);
  return r;
}

async function handleRecipes({ meals, cookingSkill = 'base', maxMinutes = 30 }, env) {
  const prompt = `Livello in cucina: ${cookingSkill}. Tempo massimo per preparazione: ${maxMinutes} min.
Pasti (usa SOLO questi ingredienti e grammature, più spezie/erbe/aceto/limone/sale):
${meals.map(m => `- ${m.title}: ${m.items.map(i => `${i.name} ${i.grams} g`).join(', ')}`).join('\n')}`;
  return callTool(env, TOOL_RECIPES, prompt);
}

async function handleAdaptTraining({ program, issues, exerciseDb }, env) {
  const prompt = `Programma attuale: ${JSON.stringify(program.sessions.map((s, i) => ({ idx: i, label: s.label, exercises: s.exercises.map(e => e.id) })))}
Problemi/preferenze utente: ${issues}
DB esercizi disponibili (id, pattern, attrezzatura): ${JSON.stringify(exerciseDb.map(e => ({ id: e.id, pattern: e.pattern, eq: e.eq })))}
Attrezzatura utente: ${program.equipment}
Sostituisci solo gli esercizi problematici con alternative dello STESSO pattern e attrezzatura compatibile.`;
  const r = await callTool(env, TOOL_ADAPT_TRAINING, prompt);
  const valid = new Set(exerciseDb.map(e => e.id));
  r.replacements = r.replacements.filter(x => valid.has(x.newExerciseId));
  return r;
}

// ---------------------------------------------------------------------------

async function callTool(env, tool, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = data.content?.find(b => b.type === 'tool_use' && b.name === tool.name);
  if (!block) throw new Error('Il modello non ha usato il tool');
  return block.input;
}

/**
 * Auth: Bearer JWT Supabase (o altro provider). Qui verifico solo la firma HS256 con il
 * JWT secret del progetto Supabase (env.SUPABASE_JWT_SECRET). Ritorna il sub (user id).
 * Per sviluppo locale: env.DEV_TOKEN accetta un token statico.
 */
async function authenticate(req, env) {
  const h = req.headers.get('Authorization') ?? '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  if (env.DEV_TOKEN && token === env.DEV_TOKEN) return 'dev';
  if (!env.SUPABASE_JWT_SECRET) return null;
  try {
    const [h64, p64, s64] = token.split('.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SUPABASE_JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64url(s64), new TextEncoder().encode(`${h64}.${p64}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64url(p64)));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload.sub ?? null;
  } catch { return null; }
}

function b64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function rateLimitOk(env, userId) {
  if (!env.RATE) return true; // nessun KV configurato → nessun limite (solo dev)
  const key = `${userId}:${new Date().toISOString().slice(0, 10)}`;
  const n = parseInt((await env.RATE.get(key)) ?? '0', 10);
  if (n >= MAX_PER_DAY) return false;
  await env.RATE.put(key, String(n + 1), { expirationTtl: 86400 });
  return true;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } });
}

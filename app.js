// app.js — FORMA PWA. Router a tab + onboarding. Nessun framework.
import { store } from './store.js';
import { api, apiConfigured } from './api.js';
import { ACTIVITY_FACTORS, GOALS, PACE, computePlan, bmi, adjustTarget } from './engine/nutrition.js';
import { EQUIPMENT, LEVELS, EXERCISES, buildProgram, substituteExercise, sessionKcal } from './engine/training.js';
import { generateRulePlan, availableFoods, composeMeal } from './engine/foods.js';
import { validatePlan, scaleMealToTarget, mealTotals, findAllergenViolations, ALLERGEN_KEYWORDS } from './engine/schemas.js';
import { buildShoppingList } from './engine/shopping.js';
import { foodIcon, SLOT_ICON } from './engine/foodIcons.js';
import { exerciseSVG, exerciseInfo } from './engine/moves.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const tabs = $('#tabs');
const h = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (vals[i] ?? ''), '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// ---------------------------------------------------------------------------
// Stato

const state = {
  profile: store.get('profile'),
  numbers: store.get('numbers'),
  mealPlan: store.get('mealPlan'),
  program: store.get('program'),
  shopping: store.get('shopping', { checked: {}, pantry: [] }),
  weights: store.get('weights', []),
  recipes: store.get('recipes', {}),
  tab: 'today',
  planDay: ((new Date().getDay() + 6) % 7), // 0 = lunedì
};
const save = k => store.set(k, state[k]);

// ---------------------------------------------------------------------------
// Utilità UI

function toast(msg, ms = 2500) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms);
}
function modal(html) {
  const m = $('#modal'); $('#modal-body').innerHTML = html; m.showModal();
  m.addEventListener('click', e => { if (e.target === m) m.close(); }, { once: true });
  return m;
}
function busy(msg) {
  return modal(h`<div class="center"><span class="spinner"></span><p style="margin-top:12px">${esc(msg)}</p></div>`);
}
function macroBar(p, c, f) {
  const tot = p * 4 + c * 4 + f * 9 || 1;
  return h`<div class="bar"><div class="p" style="width:${p * 4 / tot * 100}%"></div><div class="c" style="width:${c * 4 / tot * 100}%"></div><div class="f" style="width:${f * 9 / tot * 100}%"></div></div>
  <div class="legend"><span><i style="background:var(--p)"></i>P ${Math.round(p)} g</span><span><i style="background:var(--c)"></i>C ${Math.round(c)} g</span><span><i style="background:var(--f)"></i>F ${Math.round(f)} g</span></div>`;
}

// ---------------------------------------------------------------------------
// Router

function go(tab) {
  state.tab = tab;
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  ({ today: renderToday, plan: renderPlan, training: renderTraining, shopping: renderShopping, profile: renderProfile })[tab]();
}
tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.tab); });

function boot() {
  if (!state.profile || !state.numbers) { tabs.hidden = true; renderOnboarding(); }
  else { tabs.hidden = false; go('today'); }
}

// ---------------------------------------------------------------------------
// Onboarding (fase di conoscenza)

const ALLERGY_LABELS = { lattosio: 'Lattosio', glutine: 'Glutine', uova: 'Uova', frutta_secca: 'Frutta secca', pesce: 'Pesce', crostacei: 'Crostacei e molluschi', soia: 'Soia', sesamo: 'Sesamo' };

function renderOnboarding() {
  const p = state.profile ?? { sex: 'm', activity: 'moderate', goal: 'cut', pace: 'moderate', mealsPerDay: 3, allergies: [], dislikes: [], daysPerWeek: 3, minutesPerSession: 60, equipment: 'gym', level: 'beginner', trainingGoal: 'hypertrophy', cookingMinutes: 30 };
  let step = 0;
  const steps = [stepIntro, stepBody, stepGoal, stepMeals, stepTraining, stepSummary];

  function render() {
    view.innerHTML = h`<div class="progress"><div style="width:${(step) / (steps.length - 1) * 100}%"></div></div>` + steps[step]();
    bind();
  }
  function bind() {
    view.querySelectorAll('[data-next]').forEach(b => b.onclick = () => { if (collect()) { step++; render(); } });
    view.querySelectorAll('[data-prev]').forEach(b => b.onclick = () => { step--; render(); });
    view.querySelectorAll('.choice[data-k]').forEach(c => c.onclick = () => {
      p[c.dataset.k] = isNaN(c.dataset.v) ? c.dataset.v : +c.dataset.v;
      view.querySelectorAll(`.choice[data-k="${c.dataset.k}"]`).forEach(x => x.classList.toggle('selected', x === c));
    });
    view.querySelectorAll('.chip[data-allergy]').forEach(c => c.onclick = () => {
      const a = c.dataset.allergy; const i = p.allergies.indexOf(a);
      i >= 0 ? p.allergies.splice(i, 1) : p.allergies.push(a); c.classList.toggle('on');
    });
    const fin = $('[data-finish]', view); if (fin) fin.onclick = finish;
  }
  function collect() {
    const errs = [];
    view.querySelectorAll('input[data-f]').forEach(i => {
      const v = i.type === 'number' ? parseFloat(i.value) : i.value.trim();
      if (i.required && (v === '' || Number.isNaN(v))) errs.push(i.dataset.f);
      if (i.dataset.f === 'dislikes') p.dislikes = v.split(',').map(s => s.trim()).filter(Boolean);
      else if (i.dataset.f === 'bodyFatPct') p.bodyFatPct = Number.isNaN(v) ? null : v;
      else p[i.dataset.f] = v;
    });
    if (errs.length) { toast('Compila tutti i campi obbligatori'); return false; }
    if (p.weightKg && (p.weightKg < 30 || p.weightKg > 300)) { toast('Peso non plausibile'); return false; }
    if (p.heightCm && (p.heightCm < 120 || p.heightCm > 230)) { toast('Altezza non plausibile'); return false; }
    if (p.age && (p.age < 18 || p.age > 90)) { toast('App riservata a maggiorenni (18-90 anni)'); return false; }
    return true;
  }
  const choice = (k, opts, cur) => `<div class="choices">${Object.entries(opts).map(([v, o]) => h`<div class="choice ${cur == v ? 'selected' : ''}" data-k="${k}" data-v="${v}"><div><b>${o.label}</b><span class="muted">${o.desc ?? ''}</span></div></div>`).join('')}</div>`;
  const nav = (last = false) => h`<div class="grid2" style="margin-top:18px">${step > 0 ? '<button class="btn secondary" data-prev>Indietro</button>' : '<span></span>'}${last ? '<button class="btn" data-finish>Crea il mio piano</button>' : '<button class="btn" data-next>Avanti</button>'}</div>`;

  function stepIntro() {
    return h`<div class="card neon"><h1>Conosciamoci<em style="color:#0a0a0b">.</em></h1><p>Qualche domanda per calcolare il tuo fabbisogno e costruire piano alimentare e allenamenti su misura. Ci vogliono 2 minuti.</p></div>
    <div class="card warn small">FORMA è uno strumento di supporto, non sostituisce medico, dietista o nutrizionista. In caso di patologie, gravidanza o disturbi alimentari rivolgiti a un professionista prima di seguire qualsiasi piano.</div>${nav()}`;
  }
  function stepBody() {
    return h`<h2>Dati fisici</h2>
    <div class="card">
      <div class="grid2"><div class="field"><label>Peso (kg)</label><input type="number" inputmode="decimal" step="0.1" data-f="weightKg" value="${p.weightKg ?? ''}" required></div>
      <div class="field"><label>Altezza (cm)</label><input type="number" inputmode="numeric" data-f="heightCm" value="${p.heightCm ?? ''}" required></div></div>
      <div class="grid2"><div class="field"><label>Età</label><input type="number" inputmode="numeric" data-f="age" value="${p.age ?? ''}" required></div>
      <div class="field"><label>% grasso (opzionale)</label><input type="number" inputmode="decimal" data-f="bodyFatPct" value="${p.bodyFatPct ?? ''}" placeholder="es. 18"><div class="hint">Se la conosci (BIA, plicometria) il calcolo è più preciso.</div></div></div>
      <label>Sesso biologico</label>${choice('sex', { m: { label: 'Uomo' }, f: { label: 'Donna' } }, p.sex)}
    </div>${nav()}`;
  }
  function stepGoal() {
    return h`<h2>Attività e obiettivo</h2>
    <div class="card"><label>Quanto ti muovi in una settimana tipo?</label>${choice('activity', ACTIVITY_FACTORS, p.activity)}</div>
    <div class="card"><label>Obiettivo</label>${choice('goal', GOALS, p.goal)}</div>
    <div class="card"><label>Ritmo</label>${choice('pace', PACE, p.pace)}</div>${nav()}`;
  }
  function stepMeals() {
    return h`<h2>Alimentazione</h2>
    <div class="card"><label>Quanti pasti al giorno?</label>${choice('mealsPerDay', { 3: { label: '3 pasti', desc: 'Colazione, pranzo, cena' }, 5: { label: '5 pasti', desc: 'Con due spuntini' } }, p.mealsPerDay)}</div>
    <div class="card"><label>Allergie / intolleranze</label><div class="chips">${Object.entries(ALLERGY_LABELS).map(([k, l]) => h`<span class="chip ${p.allergies.includes(k) ? 'on' : ''}" data-allergy="${k}">${l}</span>`).join('')}</div></div>
    <div class="card"><div class="field"><label>Alimenti che non ti piacciono</label><input data-f="dislikes" value="${esc(p.dislikes.join(', '))}" placeholder="es. tofu, broccoli, pesce azzurro"><div class="hint">Separati da virgola. Verranno esclusi dal piano.</div></div>
    <div class="field"><label>Tempo per cucinare un pasto (min)</label><input type="number" inputmode="numeric" data-f="cookingMinutes" value="${p.cookingMinutes}" required></div></div>${nav()}`;
  }
  function stepTraining() {
    return h`<h2>Allenamento</h2>
    <div class="card"><div class="grid2"><div class="field"><label>Giorni a settimana</label><input type="number" inputmode="numeric" min="1" max="6" data-f="daysPerWeek" value="${p.daysPerWeek}" required></div>
    <div class="field"><label>Minuti a seduta</label><input type="number" inputmode="numeric" min="20" max="120" data-f="minutesPerSession" value="${p.minutesPerSession}" required></div></div></div>
    <div class="card"><label>Dove ti alleni?</label>${choice('equipment', EQUIPMENT, p.equipment)}</div>
    <div class="card"><label>Esperienza</label>${choice('level', LEVELS, p.level)}</div>
    <div class="card"><label>Focus</label>${choice('trainingGoal', { hypertrophy: { label: 'Massa / tonificazione', desc: '8-12 rip.' }, strength: { label: 'Forza', desc: '4-6 rip.' }, endurance: { label: 'Resistenza', desc: '12-20 rip.' } }, p.trainingGoal)}</div>${nav()}`;
  }
  function stepSummary() {
    const n = computePlan(p);
    const b = bmi(p);
    return h`<h1>Il tuo <em>fabbisogno</em></h1>
    <div class="card accent center"><div class="muted">Target giornaliero</div><div class="big neon-text">${n.target}</div><div class="muted">kcal / giorno</div></div>
    <div class="card"><div class="grid3"><div class="kpi"><div class="v">${n.bmr}</div><div class="l">Metabolismo basale</div></div><div class="kpi"><div class="v">${n.tdee}</div><div class="l">Dispendio totale</div></div><div class="kpi"><div class="v">${n.expectedWeeklyChangeKg > 0 ? '+' : ''}${n.expectedWeeklyChangeKg}</div><div class="l">kg / settimana attesi</div></div></div></div>
    <div class="card"><h3>Macronutrienti</h3>${macroBar(n.macros.protein, n.macros.carbs, n.macros.fat)}<p class="muted small" style="margin-top:8px">Fibre ≥ ${n.macros.fiberTarget} g · Acqua ≈ ${(n.macros.waterMl / 1000).toFixed(1)} L · BMI ${b.value} (${b.class})</p></div>
    ${n.warnings.map(w => h`<div class="card warn">${esc(w)}</div>`).join('')}
    ${nav(true)}`;
  }
  async function finish() {
    state.profile = p; save('profile');
    state.numbers = computePlan(p); save('numbers');
    state.program = buildProgram(p); save('program');
    await generateMealPlan();
    tabs.hidden = false; go('today');
  }
  render();
}

// ---------------------------------------------------------------------------
// Generazione piano pasti (LLM se configurato, altrimenti regole)

const prefsOf = p => ({ allergies: p.allergies ?? [], dislikes: p.dislikes ?? [], cookingMinutes: p.cookingMinutes, mealsPerDay: p.mealsPerDay });

async function generateMealPlan() {
  const p = state.profile, n = state.numbers;
  let plan, source = 'rules';
  if (apiConfigured()) {
    const m = busy('Il nutrizionista sta preparando il tuo piano…');
    try {
      const r = await api.plan({ sex: p.sex, age: p.age, weightKg: p.weightKg, goal: p.goal }, n.meals, prefsOf(p));
      plan = r.plan; source = 'llm';
    } catch (e) { toast('Backend non raggiungibile, uso il piano a regole: ' + e.message, 4000); }
    finally { m.close(); }
  }
  if (!plan) plan = generateRulePlan(n.meals, prefsOf(p));
  state.mealPlan = { ...plan, source, createdAt: Date.now() }; save('mealPlan');
  state.shopping = { checked: {}, pantry: state.shopping.pantry ?? [] }; save('shopping');
  state.recipes = {}; save('recipes');
}

// Sostituzione locale a regole: stesso slot/categoria, riscalo il pasto al target.
function substituteLocal(meal, itemName, target) {
  const foods = availableFoods(prefsOf(state.profile));
  const item = meal.items.find(i => i.name === itemName);
  const inMeal = new Set(meal.items.map(i => i.name));
  const cands = foods.filter(f => f.cat === item.category && f.slots.includes(meal.slot) && !inMeal.has(f.name));
  if (!cands.length) return null;
  const alt = cands[Math.floor(Math.random() * cands.length)];
  const grams = Math.max(5, Math.round((item.kcal / alt.kcal * 100) / 5) * 5);
  const k = grams / 100;
  const newItem = { name: alt.name, category: alt.cat, grams, kcal: Math.round(alt.kcal * k), protein: +(alt.p * k).toFixed(1), carbs: +(alt.c * k).toFixed(1), fat: +(alt.f * k).toFixed(1) };
  const items = meal.items.map(i => i === item ? newItem : i);
  const title = items.filter(i => i.category !== 'fat').map(i => i.name).join(', ');
  return scaleMealToTarget({ ...meal, title, items }, target.kcal);
}

async function substitute(dayIdx, mealIdx, itemName) {
  const meal = state.mealPlan.days[dayIdx].meals[mealIdx];
  const target = state.numbers.meals.find(m => m.id === meal.slot);
  let out = null;
  if (apiConfigured()) {
    const m = busy('Cerco un\'alternativa equivalente…');
    try { out = (await api.substitute(meal, target, itemName, prefsOf(state.profile))).meal; }
    catch (e) { toast('Backend: ' + e.message); }
    finally { m.close(); }
  }
  if (!out) out = substituteLocal(meal, itemName, target);
  if (!out) return toast('Nessuna alternativa disponibile con le tue esclusioni');
  state.mealPlan.days[dayIdx].meals[mealIdx] = out; save('mealPlan');
  renderPlan();
}

// ---------------------------------------------------------------------------
// Vista: Oggi

function renderToday() {
  const n = state.numbers, p = state.profile;
  const day = state.mealPlan?.days[state.planDay];
  const sessionIdx = trainingDayIndex(state.planDay);
  const session = sessionIdx >= 0 ? state.program.sessions[sessionIdx] : null;
  const lastW = state.weights.at(-1);
  view.innerHTML = h`
  <h1>${DAYS[state.planDay]}<em>.</em> <span class="muted" style="font-size:14px;text-transform:none;letter-spacing:0;font-weight:500">${GOALS[p.goal].label}</span></h1>
  <div class="stripe"></div>
  <div class="card accent"><div class="row"><div><div class="muted">Target di oggi</div><div class="big neon-text">${n.target}</div><div class="muted">kcal</div></div>
  <div class="kpi"><div class="v">${(lastW?.kg ?? p.weightKg)} <span class="muted">kg</span></div><div class="l">${lastW ? 'ultima pesata' : 'peso iniziale'}</div></div></div>${macroBar(n.macros.protein, n.macros.carbs, n.macros.fat)}</div>
  ${day ? h`<div class="card"><div class="row"><h2>Pasti di oggi</h2><button class="btn ghost sm" data-go="plan">Piano completo →</button></div>
    ${day.meals.map(m => h`<div class="meal"><div class="row"><div><div class="slot">${SLOT_ICON[m.slot] ?? ''} ${esc(state.numbers.meals.find(x => x.id === m.slot)?.label)}</div><div class="title">${esc(m.title)}</div></div><div class="scheme" style="color:var(--neon);font-weight:800;white-space:nowrap">${mealTotals(m).kcal} kcal</div></div>
    <div style="font-size:28px;margin-top:6px;filter:drop-shadow(0 6px 6px rgba(0,0,0,.6))">${m.items.map(i => foodIcon(i.name, i.category)).join(' ')}</div></div>`).join('')}</div>` : ''}
  <div class="card"><div class="row"><h2>Allenamento</h2><button class="btn ghost sm" data-go="training">Programma →</button></div>
    ${session ? h`<div class="row" style="align-items:center"><div class="thumb" style="width:72px;height:72px;border-radius:14px;background:var(--bg-2);border:1px solid var(--line-2);flex:0 0 auto">${exerciseSVG(session.exercises[0].id)}</div><div><b>${esc(session.label)}</b><div class="muted small">${session.exercises.length} esercizi · ~${state.program.minutesPerSession} min · ~${sessionKcal({ weightKg: p.weightKg, minutesPerSession: state.program.minutesPerSession })} kcal</div><div class="muted small">${session.exercises.map(e => esc(e.name)).join(' · ')}</div></div></div>` : '<p class="muted">Oggi riposo. Cammina 30 minuti se puoi.</p>'}</div>
  <div class="card"><h2>Pesata</h2><p class="muted small">Pesati al mattino, a digiuno, 2-3 volte a settimana. Ogni 2 settimane ricalcolo il target in base ai risultati reali.</p>
    <div class="row"><input type="number" inputmode="decimal" step="0.1" id="w-in" placeholder="kg" value="${lastW?.kg ?? p.weightKg}"><button class="btn sm" id="w-add">Registra</button></div>
    ${state.weights.length ? h`<p class="muted small" style="margin-top:10px">${state.weights.slice(-6).map(w => `${w.date.slice(5)}: ${w.kg}`).join(' · ')}</p>` : ''}
    ${state.weights.length >= 3 ? renderAdjust() : ''}</div>`;
  view.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#w-add').onclick = () => {
    const kg = parseFloat($('#w-in').value); if (!kg) return;
    state.weights.push({ date: new Date().toISOString().slice(0, 10), kg }); save('weights');
    toast('Pesata registrata'); renderToday();
  };
  const adj = $('#adj-apply'); if (adj) adj.onclick = applyAdjust;
}

function renderAdjust() {
  const r = adjustTarget({ plan: state.numbers, weights: state.weights.slice(-6).map(w => w.kg), weeks: 2 });
  if (!r.adjust) return h`<p class="small" style="margin-top:8px">✓ ${esc(r.reason)}</p>`;
  return h`<div class="card warn" style="margin:10px 0 0"><b>Ricalcolo suggerito</b><p class="small">${esc(r.reason)}</p><button class="btn sm" id="adj-apply" data-adj="${r.adjust}">Applica ${r.adjust > 0 ? '+' : ''}${r.adjust} kcal e rigenera il piano</button></div>`;
}
async function applyAdjust() {
  const d = +$('#adj-apply').dataset.adj;
  state.profile.weightKg = state.weights.at(-1).kg; save('profile');
  const n = computePlan(state.profile);
  n.target += d; // il ricalcolo parte dal nuovo peso, poi applico la correzione empirica
  const { macros, mealPlanTargets } = await import('./engine/nutrition.js');
  n.macros = macros(state.profile, n.target); n.meals = mealPlanTargets(n.macros, state.profile.mealsPerDay);
  state.numbers = n; save('numbers');
  state.weights = state.weights.slice(-1); save('weights');
  await generateMealPlan(); toast('Target aggiornato e piano rigenerato'); renderToday();
}

function trainingDayIndex(dayIdx) {
  // Distribuisco le sedute sulla settimana: 3 giorni → Lun/Mer/Ven, 4 → Lun/Mar/Gio/Ven, ecc.
  const map = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
  return (map[state.program?.daysPerWeek] ?? []).indexOf(dayIdx);
}

// ---------------------------------------------------------------------------
// Vista: Piano

function renderPlan() {
  const plan = state.mealPlan; const n = state.numbers;
  if (!plan) return view.innerHTML = '<div class="card">Nessun piano. <button class="btn" id="gen">Genera</button></div>';
  const day = plan.days[state.planDay];
  const totals = day.meals.reduce((a, m) => { const t = mealTotals(m); a.kcal += t.kcal; a.p += t.protein; a.c += t.carbs; a.f += t.fat; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
  view.innerHTML = h`
  <div class="row"><h1>Piano<em>.</em></h1><span class="tag ${plan.source === 'llm' ? 'llm' : ''}">${plan.source === 'llm' ? 'AI' : 'regole'}</span></div>
  <div class="daypick">${DAYS.map((d, i) => h`<button class="${i === state.planDay ? 'on' : ''}" data-day="${i}">${d}</button>`).join('')}</div>
  <div class="card accent"><div class="row"><div><span class="big neon-text" style="font-size:34px">${Math.round(totals.kcal)}</span> <span class="muted">kcal</span></div><span class="muted small">target ${n.target}</span></div>${macroBar(totals.p, totals.c, totals.f)}</div>
  <div class="card">${day.meals.map((m, mi) => {
    const t = mealTotals(m); const tg = n.meals.find(x => x.id === m.slot);
    return h`<div class="meal"><div class="row"><div><div class="slot">${SLOT_ICON[m.slot] ?? ''} ${esc(tg?.label)} <span class="muted small" style="text-transform:none;letter-spacing:0;font-weight:500">· ${Math.round(t.kcal)} kcal · P ${Math.round(t.protein)} g</span></div><div class="title">${esc(m.title)}</div></div>
      <button class="btn ghost sm" data-recipe="${mi}">${state.recipes[m.title] ? 'Chiudi' : 'Preparazione'}</button></div>
      <div class="foods">${m.items.map(i => h`<div class="food ${esc(i.category)}" data-sub="${mi}" data-item="${esc(i.name)}" title="Tocca per sostituire"><span class="swap">⇄</span><span class="emoji">${foodIcon(i.name, i.category)}</span><span class="name">${esc(i.name)}</span><span class="g">${i.grams} g</span></div>`).join('')}</div>
      ${state.recipes[m.title] ? renderRecipe(state.recipes[m.title]) : ''}</div>`;
  }).join('')}</div>
  ${plan.notes ? h`<p class="muted small">${esc(plan.notes)}</p>` : ''}
  <button class="btn secondary" id="regen">Rigenera tutta la settimana</button>`;
  view.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { state.planDay = +b.dataset.day; renderPlan(); });
  view.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { if (confirm(`Sostituire "${b.dataset.item}" con un'alternativa equivalente?`)) substitute(state.planDay, +b.dataset.sub, b.dataset.item); });
  view.querySelectorAll('[data-recipe]').forEach(b => b.onclick = () => recipeFor(+b.dataset.recipe));
  $('#regen').onclick = async () => { if (confirm('Rigenero il piano della settimana? Le sostituzioni fatte andranno perse.')) { await generateMealPlan(); renderPlan(); } };
}

function renderRecipe(r) {
  return h`<div class="card" style="margin:12px 0 0;background:var(--bg-2)"><h3>Preparazione <span style="text-transform:none;letter-spacing:0;color:var(--neon)">~${r.minutes} min</span></h3><ol class="steps small">${r.steps.map(s => h`<li>${esc(s)}</li>`).join('')}</ol>${r.tips ? h`<p class="small muted">💡 ${esc(r.tips)}</p>` : ''}${r.mealPrep ? h`<p class="small muted">🥡 ${esc(r.mealPrep)}</p>` : ''}</div>`;
}

async function recipeFor(mealIdx) {
  const meal = state.mealPlan.days[state.planDay].meals[mealIdx];
  if (state.recipes[meal.title]) { delete state.recipes[meal.title]; save('recipes'); return renderPlan(); }
  let r = null;
  if (apiConfigured()) {
    const m = busy('Scrivo la preparazione…');
    try { r = (await api.recipes([meal], 'base', state.profile.cookingMinutes)).recipes?.[0]; }
    catch (e) { toast('Backend: ' + e.message); }
    finally { m.close(); }
  }
  if (!r) r = localRecipe(meal);
  state.recipes[meal.title] = r; save('recipes'); renderPlan();
}

// Preparazione generica offline, per categoria. Senza backend è il massimo che si può fare onestamente.
function localRecipe(meal) {
  const by = c => meal.items.filter(i => i.category === c).map(i => `${i.name.toLowerCase()} (${i.grams} g)`);
  const steps = [];
  const carbs = by('carb'), prot = by('protein'), veg = by('veg'), fat = by('fat'), dairy = by('dairy'), fruit = by('fruit');
  if (carbs.length) steps.push(`Pesa a crudo e cuoci ${carbs.join(', ')} secondo le indicazioni sulla confezione (cereali in acqua salata, pane/gallette così come sono).`);
  if (veg.length) steps.push(`Lava e taglia ${veg.join(', ')}: al vapore 8-10 min, in padella 6-8 min o cruda in insalata.`);
  if (prot.length) steps.push(`Cuoci ${prot.join(', ')} in padella antiaderente o al forno a 200 °C (carne bianca 12-15 min, pesce 10-12 min) con spezie, aglio, limone. Sale a fine cottura.`);
  if (dairy.length || fruit.length) steps.push(`Componi in una ciotola ${[...dairy, ...fruit].join(', ')}; cannella o cacao amaro a piacere.`);
  if (fat.length) steps.push(`Aggiungi ${fat.join(', ')} a crudo, a fine preparazione.`);
  steps.push('Impiatta tutto insieme. Verdure a volontà se hai ancora fame.');
  return { minutes: meal.prepMinutes ?? 20, steps, mealPrep: 'Cereali e proteine si possono cuocere in doppia dose e conservare in frigo 2-3 giorni in contenitore chiuso.', tips: 'Configura il backend nel Profilo per preparazioni dettagliate e personalizzate.' };
}

// ---------------------------------------------------------------------------
// Vista: Allenamento

function renderTraining() {
  const pr = state.program;
  view.innerHTML = h`<h1>Allenamento<em>.</em></h1><div class="stripe"></div>
  <div class="card accent"><div class="row"><div><b style="font-size:18px">${esc(pr.splitLabel ?? pr.split)}</b><div class="muted small">${pr.daysPerWeek} giorni · ${pr.minutesPerSession} min · ${EQUIPMENT[pr.equipment].label}</div></div><div class="kpi"><div class="v neon-text" style="color:var(--neon)">${pr.sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0)}</div><div class="l">serie / sett.</div></div></div></div>
  <p class="muted small">Tocca un esercizio per vedere il movimento, i muscoli e l'esecuzione.</p>
  ${pr.sessions.map((s, si) => h`<div class="card"><div class="session-head"><h2>${esc(s.label)}</h2><span class="day">${DAYS[[0, [0], [0, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 4, 5], [0, 1, 2, 3, 4, 5]][pr.daysPerWeek][si]]}</span></div>
    ${s.exercises.map(e => h`<div class="ex" data-detail="${si}:${e.id}"><div class="thumb">${exerciseSVG(e.id)}</div><div class="name">${esc(e.name)}</div><div class="scheme">${e.sets}×${e.repMin}-${e.repMax}</div><div class="sub">${exerciseInfo(e).primary.slice(0, 2).join(', ')} · rec. ${e.restSec}s · <button data-swap="${si}" data-ex="${e.id}">sostituisci</button></div></div>`).join('')}</div>`).join('')}
  <div class="card"><h3>Progressione</h3><p class="small">${esc(pr.progression.text)}</p><p class="small muted">Scarico ogni ${pr.progression.deloadEveryWeeks} settimane. ${esc(pr.warmup)}</p></div>
  <div class="card"><h3>Adatta il programma</h3><p class="muted small">Infortuni, dolori, esercizi che non puoi fare: descrivili e il programma viene adattato.</p><textarea id="issues" rows="2" placeholder="es. dolore alla spalla destra, niente trazioni"></textarea><button class="btn secondary" id="adapt" style="margin-top:8px">Adatta</button></div>`;
  view.querySelectorAll('[data-detail]').forEach(el => el.onclick = () => {
    const [si, id] = el.dataset.detail.split(':'); const e = state.program.sessions[+si].exercises.find(x => x.id === id);
    showExercise(e);
  });
  view.querySelectorAll('[data-swap]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    const r = substituteExercise(state.program, +b.dataset.swap, b.dataset.ex);
    if (!r) return toast('Nessuna alternativa disponibile'); save('program'); renderTraining(); toast(`→ ${r.name}`);
  });
  $('#adapt').onclick = async () => {
    const issues = $('#issues').value.trim(); if (!issues) return;
    if (!apiConfigured()) return toast('Serve il backend per l\'adattamento guidato. Usa "sostituisci" sui singoli esercizi.', 4000);
    const m = busy('Adatto il programma…');
    try {
      const r = await api.adaptTraining(state.program, issues, EXERCISES);
      for (const x of r.replacements) {
        const s = state.program.sessions[x.sessionIdx]; const i = s?.exercises.findIndex(e => e.id === x.exerciseId);
        const alt = EXERCISES.find(e => e.id === x.newExerciseId);
        if (i >= 0 && alt) s.exercises[i] = { ...alt, sets: s.exercises[i].sets, repMin: s.exercises[i].repMin, repMax: s.exercises[i].repMax, restSec: s.exercises[i].restSec };
      }
      save('program'); renderTraining(); if (r.generalAdvice) modal(h`<h3>Consiglio</h3><p>${esc(r.generalAdvice)}</p>`);
    } catch (e) { toast('Backend: ' + e.message); } finally { m.close(); }
  };
}

function showExercise(e) {
  const info = exerciseInfo(e);
  modal(h`<div class="slot" style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--lime)">${e.sets} serie × ${e.repMin}-${e.repMax} rip · recupero ${e.restSec}s</div>
  <h2 style="font-size:24px">${esc(e.name)}</h2>
  <div class="move-stage">${exerciseSVG(e.id)}</div>
  <h3>Muscoli</h3><div class="muscles">${info.primary.map(m => h`<span>${esc(m)}</span>`).join('')}${info.secondary.map(m => h`<span class="sec">${esc(m)}</span>`).join('')}</div>
  <h3>Esecuzione</h3><ol class="steps">${info.steps.map(s => h`<li>${esc(s)}</li>`).join('')}</ol>
  <h3>Errori comuni</h3><ul class="steps mistakes">${info.mistakes.map(s => h`<li>${esc(s)}</li>`).join('')}</ul>
  <button class="btn secondary" onclick="this.closest('dialog').close()">Chiudi</button>`);
}

// ---------------------------------------------------------------------------
// Vista: Spesa

function renderShopping() {
  const list = buildShoppingList(state.mealPlan, state.shopping.pantry);
  const checked = state.shopping.checked;
  const done = Object.values(list.aisles).flat().filter(i => checked[i.name]).length;
  const catOf = {}; state.mealPlan.days.forEach(d => d.meals.forEach(m => m.items.forEach(i => catOf[i.name] = i.category)));
  view.innerHTML = h`<div class="row"><h1>Spesa<em>.</em></h1><span class="tag llm">${done}/${list.totalItems}</span></div><div class="stripe"></div>
  <p class="muted small">Quantità per 7 giorni, arrotondate alle confezioni. Spunta quello che hai già.</p>
  <div class="card shop">${Object.entries(list.aisles).map(([aisle, items]) => h`<h3>${esc(aisle)}</h3>${items.map(i => h`<label class="item ${checked[i.name] ? 'done' : ''}"><input type="checkbox" data-item="${esc(i.name)}" ${checked[i.name] ? 'checked' : ''}><span class="em">${foodIcon(i.name, catOf[i.name])}</span>${esc(i.name)}<span class="q">${esc(i.display)}</span></label>`).join('')}`).join('')}</div>
  <div class="card"><h3>Già in dispensa</h3><p class="muted small">Alimenti da escludere sempre dalla lista (es. olio, spezie).</p><input id="pantry" value="${esc(state.shopping.pantry.join(', '))}" placeholder="es. Olio extravergine d'oliva"><button class="btn secondary sm" id="pantry-save" style="margin-top:8px">Salva</button></div>
  <div class="grid2"><button class="btn secondary" id="share">Condividi lista</button><button class="btn secondary" id="uncheck">Azzera spunte</button></div>`;
  view.querySelectorAll('input[data-item]').forEach(c => c.onchange = () => { checked[c.dataset.item] = c.checked; save('shopping'); c.parentElement.classList.toggle('done', c.checked); });
  $('#pantry-save').onclick = () => { state.shopping.pantry = $('#pantry').value.split(',').map(s => s.trim()).filter(Boolean); save('shopping'); renderShopping(); };
  $('#uncheck').onclick = () => { state.shopping.checked = {}; save('shopping'); renderShopping(); };
  $('#share').onclick = async () => {
    const text = Object.entries(list.aisles).map(([a, items]) => `${a}\n${items.filter(i => !checked[i.name]).map(i => `• ${i.name} — ${i.display}`).join('\n')}`).join('\n\n');
    if (navigator.share) { try { await navigator.share({ title: 'Lista della spesa', text }); } catch {} }
    else { await navigator.clipboard?.writeText(text); toast('Lista copiata negli appunti'); }
  };
}

// ---------------------------------------------------------------------------
// Vista: Profilo

function renderProfile() {
  const p = state.profile, n = state.numbers, s = store.get('settings', {});
  view.innerHTML = h`<h1>Profilo<em>.</em></h1><div class="stripe"></div>
  <div class="card"><div class="grid3"><div class="kpi"><div class="v">${p.weightKg}</div><div class="l">kg</div></div><div class="kpi"><div class="v">${p.heightCm}</div><div class="l">cm</div></div><div class="kpi"><div class="v">${p.age}</div><div class="l">anni</div></div></div>
  <p class="muted small" style="margin-top:10px">${GOALS[p.goal].label} · ${ACTIVITY_FACTORS[p.activity].label} · ${p.mealsPerDay} pasti · ${p.allergies.length ? 'Allergie: ' + p.allergies.map(a => ALLERGY_LABELS[a]).join(', ') : 'Nessuna allergia'}</p>
  <p class="muted small">BMR ${n.bmr} · TDEE ${n.tdee} · Target ${n.target} kcal</p>
  <button class="btn secondary" id="redo">Rifai il questionario</button></div>
  <div class="card"><h3>Backend AI <span class="tag ${apiConfigured() ? 'llm' : ''}">${apiConfigured() ? 'attivo' : 'non configurato'}</span></h3>
  <p class="muted small">Senza backend i piani sono generati a regole (offline). Con il backend, piano, sostituzioni e ricette sono generati dall'AI con i tuoi vincoli.</p>
  <div class="field"><label>URL Worker</label><input id="apiBase" value="${esc(s.apiBase ?? '')}" placeholder="https://forma-api.tuonome.workers.dev"></div>
  <div class="field"><label>Token</label><input id="token" value="${esc(s.token ?? '')}" placeholder="JWT utente o DEV_TOKEN"></div>
  <button class="btn secondary sm" id="api-save">Salva</button></div>
  <div class="card"><h3>Dati</h3><div class="grid2"><button class="btn secondary sm" id="export">Esporta JSON</button><button class="btn danger sm" id="reset">Cancella tutto</button></div></div>
  <p class="muted small center">FORMA v0.2 · Strumento educativo, non è un dispositivo medico né sostituisce un professionista sanitario.</p>`;
  $('#redo').onclick = () => { tabs.hidden = true; renderOnboarding(); };
  $('#api-save').onclick = () => { store.set('settings', { apiBase: $('#apiBase').value.trim(), token: $('#token').value.trim() }); toast('Salvato'); renderProfile(); };
  $('#export').onclick = () => {
    const blob = new Blob([JSON.stringify({ profile: p, numbers: n, mealPlan: state.mealPlan, program: state.program, weights: state.weights }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'forma-export.json' }); a.click();
  };
  $('#reset').onclick = () => { if (confirm('Cancellare tutti i dati locali?')) { store.clear(); location.reload(); } };
}

// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();

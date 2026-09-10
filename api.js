// api.js — client verso il Worker. Se apiBase non è configurato o la chiamata fallisce,
// il chiamante usa il fallback a regole (engine/foods.js).
import { store } from './store.js';

export function apiConfigured() {
  const s = store.get('settings', {});
  return !!(s.apiBase && s.token);
}

async function call(path, body) {
  const s = store.get('settings', {});
  if (!s.apiBase) throw new Error('Backend non configurato');
  const res = await fetch(s.apiBase.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${s.token ?? ''}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export const api = {
  plan:          (profile, mealTargets, prefs) => call('/plan', { profile, mealTargets, prefs }),
  substitute:    (meal, target, remove, prefs) => call('/substitute', { meal, target, remove, prefs }),
  recipes:       (meals, cookingSkill, maxMinutes) => call('/recipes', { meals, cookingSkill, maxMinutes }),
  adaptTraining: (program, issues, exerciseDb) => call('/adapt-training', { program, issues, exerciseDb }),
};

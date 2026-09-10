// store.js — persistenza locale. localStorage per ora (dati piccoli, sincroni);
// interfaccia async per poter passare a IndexedDB/Supabase senza toccare l'app.
const PREFIX = 'nutricoach:';

export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { console.warn('store.set', e); }
  },
  del(key) { try { localStorage.removeItem(PREFIX + key); } catch {} },
  clear() {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {}
  },
};

// Chiavi usate:
//  profile   → dati onboarding (peso, altezza, età, sesso, attività, obiettivo, pasti, allergie, dislikes, training*)
//  numbers   → output computePlan (bmr, tdee, target, macros, meals)
//  mealPlan  → piano settimanale { days[], notes, source }
//  program   → programma allenamento (buildProgram)
//  shopping  → { checked: { [name]: true }, pantry: [] }
//  weights   → [{ date, kg }]
//  settings  → { apiBase, token }
//  recipes   → { [mealTitle]: recipe }

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan } from '../engine/nutrition.js';
import { generateRulePlan, availableFoods } from '../engine/foods.js';
import { validatePlan, findAllergenViolations, scaleMealToTarget, mealTotals } from '../engine/schemas.js';
import { buildShoppingList } from '../engine/shopping.js';

const nick = { weightKg: 80, heightCm: 178, age: 35, sex: 'm', activity: 'moderate', goal: 'cut', pace: 'moderate', mealsPerDay: 5 };

test('piano a regole 5 pasti passa la validazione ±10%', () => {
  const p = computePlan(nick);
  const plan = generateRulePlan(p.meals, {});
  const v = validatePlan(plan, p.meals);
  assert.ok(v.ok, v.errors.join('\n'));
});

test('piano a regole 3 pasti con allergie lattosio+pesce: nessuna violazione', () => {
  const p = computePlan({ ...nick, mealsPerDay: 3 });
  const prefs = { allergies: ['lattosio', 'pesce'], dislikes: ['tofu'] };
  const plan = generateRulePlan(p.meals, prefs);
  assert.deepEqual(findAllergenViolations(plan, prefs.allergies), []);
  const v = validatePlan(plan, p.meals);
  assert.ok(v.ok, v.errors.join('\n'));
  plan.days.forEach(d => d.meals.forEach(m => m.items.forEach(i => assert.ok(!i.name.toLowerCase().includes('tofu')))));
});

test('donna bulk 3 pasti', () => {
  const p = computePlan({ weightKg: 58, heightCm: 165, age: 28, sex: 'f', activity: 'active', goal: 'bulk', mealsPerDay: 3 });
  const plan = generateRulePlan(p.meals, {});
  const v = validatePlan(plan, p.meals);
  assert.ok(v.ok, v.errors.join('\n'));
});

test('availableFoods esclude allergeni', () => {
  const f = availableFoods({ allergies: ['uova', 'glutine'] });
  assert.ok(!f.some(x => x.tags.includes('uova') || x.tags.includes('glutine')));
});

test('scaleMealToTarget porta le kcal al target senza toccare le verdure', () => {
  const meal = { slot: 'lunch', title: 'x', items: [
    { name: 'Broccoli', grams: 200, category: 'veg', kcal: 60, protein: 6, carbs: 6, fat: 0.8 },
    { name: 'Pollo', grams: 150, category: 'protein', kcal: 165, protein: 34, carbs: 0, fat: 2 },
    { name: 'Riso', grams: 80, category: 'carb', kcal: 280, protein: 5.6, carbs: 62, fat: 0.5 },
  ] };
  const s = scaleMealToTarget(meal, 700);
  assert.equal(s.items[0].grams, 200);
  assert.ok(Math.abs(mealTotals(s).kcal - 700) < 15, `${mealTotals(s).kcal}`);
});

test('lista spesa aggrega e raggruppa', () => {
  const p = computePlan(nick);
  const plan = generateRulePlan(p.meals, {});
  const list = buildShoppingList(plan, ['Olio extravergine d\'oliva']);
  assert.ok(list.totalItems > 5);
  assert.ok(Object.keys(list.aisles).length >= 3);
  const all = Object.values(list.aisles).flat();
  assert.ok(!all.some(i => i.name.includes('Olio')));
  all.forEach(i => assert.ok(/(g|kg|uova|pz|vasetti)$/.test(i.display), i.display));
});

test('allergeni: word match ed eccezioni', () => {
  const plan = { days: [{ day: 1, meals: [{ slot: 'breakfast', items: [
    { name: 'Burro di arachidi' }, { name: 'Latte di avena' }, { name: 'Latte intero' }, { name: 'Pasta di riso' }, { name: 'Pasta integrale' },
  ] }] }] };
  const v = findAllergenViolations(plan, ['lattosio', 'glutine']);
  assert.deepEqual(v.map(x => x.item).sort(), ['Latte di avena', 'Latte intero', 'Pasta integrale']);
});

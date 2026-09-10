// test/nutrition.test.js — node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bmrMifflin, bmrKatch, tdee, targetCalories, macros, mealPlanTargets, computePlan, adjustTarget, bmi } from '../engine/nutrition.js';

const nick = { weightKg: 80, heightCm: 178, age: 35, sex: 'm', activity: 'moderate', goal: 'cut', pace: 'moderate', mealsPerDay: 5 };

test('BMR Mifflin uomo 80kg/178cm/35a', () => {
  // 10*80 + 6.25*178 - 5*35 + 5 = 800 + 1112.5 - 175 + 5 = 1742.5
  assert.equal(bmrMifflin(nick), 1742.5);
});

test('BMR Mifflin donna', () => {
  assert.equal(bmrMifflin({ weightKg: 60, heightCm: 165, age: 30, sex: 'f' }), 1320.25);
});

test('Katch-McArdle con 15% BF', () => {
  const v = bmrKatch({ weightKg: 80, bodyFatPct: 15 });
  assert.equal(Math.round(v), 1839);
});

test('TDEE moderate = BMR * 1.55', () => {
  assert.equal(Math.round(tdee(nick)), Math.round(1742.5 * 1.55));
});

test('cut moderato: deficit ~440 kcal, target arrotondato a 10', () => {
  const r = targetCalories(nick);
  assert.equal(r.tdee, 2701);
  assert.ok(r.target < r.tdee);
  assert.equal(r.target % 10, 0);
  assert.ok(r.dailyDelta < -400 && r.dailyDelta > -480, `delta ${r.dailyDelta}`);
  assert.ok(r.expectedWeeklyChangeKg < 0);
});

test('guardrail: non scende sotto 1.1*BMR', () => {
  const p = { weightKg: 50, heightCm: 160, age: 45, sex: 'f', activity: 'sedentary', goal: 'cut', pace: 'fast' };
  const r = targetCalories(p);
  assert.ok(r.target >= Math.floor(r.bmr * 1.1), `${r.target} < ${r.bmr * 1.1}`);
  assert.ok(r.target >= 1200);
  assert.equal(r.warnings.length, 1);
});

test('bulk: surplus limitato a +15% TDEE', () => {
  const r = targetCalories({ ...nick, goal: 'bulk', pace: 'fast' });
  assert.ok(r.target > r.tdee);
  assert.ok(r.target <= r.tdee * 1.15 + 10);
});

test('macro chiudono sul target ±20 kcal', () => {
  const cal = targetCalories(nick);
  const m = macros(nick, cal.target);
  assert.ok(Math.abs(m.kcal - cal.target) <= 20, `${m.kcal} vs ${cal.target}`);
  assert.equal(m.protein, 176); // 2.2 g/kg * 80
  assert.equal(m.fat, 64);      // 0.8 g/kg * 80
  assert.ok(m.carbs >= 100);
});

test('macro con BF alta usano peso di riferimento ridotto', () => {
  const p = { weightKg: 120, heightCm: 175, age: 40, sex: 'm', activity: 'sedentary', goal: 'cut', bodyFatPct: 38 };
  const cal = targetCalories(p);
  const m = macros(p, cal.target);
  // LBM = 74.4, ref = 99.2, prot = 218 (non 264)
  assert.ok(m.protein < 230 && m.protein > 200, `protein ${m.protein}`);
});

test('distribuzione 5 pasti: somme esatte', () => {
  const cal = targetCalories(nick);
  const m = macros(nick, cal.target);
  const meals = mealPlanTargets(m, 5);
  assert.equal(meals.length, 5);
  const sum = k => meals.reduce((a, x) => a + x[k], 0);
  assert.equal(sum('protein'), m.protein);
  assert.equal(sum('carbs'), m.carbs);
  assert.equal(sum('fat'), m.fat);
  meals.forEach(x => assert.ok(x.carbs >= 0 && x.kcal > 0));
});

test('distribuzione 3 pasti: somme esatte', () => {
  const m = macros(nick, 2200);
  const meals = mealPlanTargets(m, 3);
  assert.equal(meals.length, 3);
  const sum = k => meals.reduce((a, x) => a + x[k], 0);
  assert.equal(sum('protein'), m.protein);
  assert.equal(sum('carbs'), m.carbs);
});

test('mealsPerDay non valido lancia', () => {
  assert.throws(() => mealPlanTargets(macros(nick, 2200), 4));
});

test('computePlan pipeline completa', () => {
  const p = computePlan(nick);
  assert.ok(p.target > 0 && p.macros && p.meals.length === 5);
});

test('adjustTarget: in linea → 0, troppo lento → -100', () => {
  const plan = { expectedWeeklyChangeKg: -0.4 };
  assert.equal(adjustTarget({ plan, weights: [80, 79.6, 79.2], weeks: 2 }).adjust, 0);
  assert.equal(adjustTarget({ plan, weights: [80, 80.1, 80.2], weeks: 2 }).adjust, -100);
  assert.equal(adjustTarget({ plan, weights: [80, 79, 77.8], weeks: 2 }).adjust, 100);
});

test('bmi', () => {
  assert.deepEqual(bmi({ weightKg: 80, heightCm: 178 }), { value: 25.2, class: 'Sovrappeso' });
});

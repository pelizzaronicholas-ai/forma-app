import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseSplit, buildProgram, substituteExercise, exercisesForMinutes, EXERCISES } from '../engine/training.js';

test('split per giorni', () => {
  assert.equal(chooseSplit({ daysPerWeek: 2, level: 'beginner' }).id, 'full_body');
  assert.equal(chooseSplit({ daysPerWeek: 4, level: 'intermediate' }).id, 'upper_lower');
  assert.equal(chooseSplit({ daysPerWeek: 5, level: 'intermediate' }).id, 'ppl_ul');
  assert.equal(chooseSplit({ daysPerWeek: 6, level: 'advanced' }).id, 'ppl');
  assert.equal(chooseSplit({ daysPerWeek: 6, level: 'beginner' }).id, 'upper_lower');
});

test('esercizi per minuti', () => {
  assert.equal(exercisesForMinutes(30), 4);
  assert.equal(exercisesForMinutes(60), 6);
  assert.equal(exercisesForMinutes(90), 7);
});

for (const equipment of ['none', 'home', 'gym']) {
  for (const days of [2, 3, 4, 5, 6]) {
    test(`programma ${equipment} ${days}g: nessun esercizio duplicato, attrezzatura rispettata`, () => {
      const p = buildProgram({ daysPerWeek: days, minutesPerSession: 60, equipment, level: 'intermediate' });
      assert.equal(p.sessions.length, days);
      for (const s of p.sessions) {
        const ids = s.exercises.map(e => e.id);
        assert.equal(new Set(ids).size, ids.length, `duplicati in ${s.label}`);
        assert.ok(s.exercises.length >= 4, `${s.label} ha solo ${s.exercises.length} esercizi`);
        s.exercises.forEach(e => {
          assert.ok(e.eq.includes(equipment));
          assert.ok(e.sets >= 2 && e.repMin < e.repMax);
        });
      }
    });
  }
}

test('esclusioni rispettate', () => {
  const p = buildProgram({ daysPerWeek: 3, equipment: 'gym', excludedExercises: ['back_squat', 'deadlift'] });
  p.sessions.forEach(s => s.exercises.forEach(e => assert.ok(!['back_squat', 'deadlift'].includes(e.id))));
});

test('sostituzione stesso pattern', () => {
  const p = buildProgram({ daysPerWeek: 3, equipment: 'gym', level: 'intermediate' });
  const first = p.sessions[0].exercises[0];
  const alt = substituteExercise(p, 0, first.id);
  assert.ok(alt && alt.id !== first.id && alt.pattern === first.pattern);
});

test('DB esercizi: id univoci', () => {
  const ids = EXERCISES.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

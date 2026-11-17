import test from 'node:test';
import assert from 'node:assert/strict';
import { wer, werGlobal, puntajeSUS, promedio, interpretarSUS, tasaInterpretacion } from '../../backend/src/utils/metricas.js';

// Ejemplos sintéticos para verificar el ALGORITMO. No son resultados de la evaluación del proyecto.
test('WER: sin errores', () => assert.deepEqual(wer('vender dos coca cola', 'vender dos coca cola'), { S: 0, D: 0, I: 0, N: 4, wer: 0 }));
test('WER: una sustitución', () => { const r = wer('vender dos coca cola', 'vender tres coca cola'); assert.equal(r.S, 1); assert.equal(r.wer, 0.25); });
test('WER: eliminación e inserción', () => {
  const d = wer('vender dos coca cola', 'vender coca cola'); assert.equal(d.D, 1);
  const i = wer('vender dos coca cola', 'vender dos coca cola ahora'); assert.equal(i.I, 1);
  assert.equal(wer('a b c d', 'a x c d e').wer, 0.5); // S=1, I=1, N=4
});
test('WER ignora mayúsculas, tildes y signos', () => assert.equal(wer('¿Cuánto cuesta la leche?', 'cuanto cuesta la leche').wer, 0));
test('WER global suma errores y palabras (no promedia porcentajes)', () => {
  const g = werGlobal([['a b', 'a b'], ['a b c d e f g h', 'a b c d e f g x']]);
  assert.equal(g.N, 10); assert.equal(g.S, 1); assert.equal(g.wer, 0.1);
});
test('SUS: valores límite y validación', () => {
  assert.equal(puntajeSUS([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
  assert.equal(puntajeSUS([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
  assert.equal(puntajeSUS([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]), 50);
  assert.throws(() => puntajeSUS([1, 2, 3]));
  assert.throws(() => puntajeSUS([6, 1, 5, 1, 5, 1, 5, 1, 5, 1]));
  assert.equal(promedio([50, 100]), 75);
  assert.match(interpretarSUS(72), /68/);
});
test('tasa de interpretación', () => { assert.equal(tasaInterpretacion(18, 20), 0.9); assert.equal(tasaInterpretacion(0, 0), null); });

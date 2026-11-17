import test from 'node:test';
import assert from 'node:assert/strict';
import { leerNumero } from '../../backend/src/services/voz/cantidades.js';
import { segmentarItems } from '../../backend/src/services/voz/interprete.js';
import { normalizar } from '../../backend/src/services/voz/texto.js';

const n = (s) => leerNumero(normalizar(s).split(' '), 0);

test('números en palabras y dígitos', () => {
  assert.equal(n('dos').valor, 2);
  assert.equal(n('12').valor, 12);
  assert.equal(n('quince').valor, 15);
  assert.equal(n('veintiuno').valor, 21);
  assert.equal(n('cien').valor, 100);
});
test('compuestos "treinta y cinco"', () => {
  const r = n('treinta y cinco');
  assert.equal(r.valor, 35); assert.equal(r.consumidos, 3);
});
test('docenas', () => {
  assert.equal(n('media docena').valor, 6);
  assert.equal(n('dos docenas').valor, 24);
});
test('un número seguido de unidad de medida no es cantidad (agua 500 ml)', () => {
  assert.equal(leerNumero(['500', 'ml'], 0), null);
});
test('palabra que no es número', () => assert.equal(n('coca'), null));

test('segmentación: varias líneas, cantidad implícita y separadores', () => {
  const r = segmentarItems(normalizar('vende dos coca cola y tres pepsi'));
  assert.deepEqual(r.map((x) => [x.cantidad, x.palabras.join(' ')]), [[2, 'coca cola'], [3, 'pepsi']]);
  const r2 = segmentarItems(normalizar('arroz flor y leche vita'));
  assert.deepEqual(r2.map((x) => [x.cantidad, x.palabras.join(' ')]), [[1, 'arroz flor'], [1, 'leche vita']]);
  const r3 = segmentarItems(normalizar('2 coca cola, 1 leche vita'));
  assert.equal(r3.length, 2);
});
test('"agua 500 ml" conserva el número dentro del nombre', () => {
  const r = segmentarItems(normalizar('dos agua 500 ml'));
  assert.equal(r.length, 1); assert.equal(r[0].cantidad, 2); assert.equal(r[0].palabras.join(' '), 'agua 500 ml');
});

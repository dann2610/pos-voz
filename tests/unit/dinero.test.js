import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotales, dineroHablado, aCentavos } from '../../backend/src/utils/dinero.js';

test('totales sin impuesto', () => {
  const t = calcularTotales([{ precio: '0.75', cantidad: 2 }, { precio: '1.25', cantidad: 1 }], 0);
  assert.equal(t.subtotal, '2.75'); assert.equal(t.impuesto, '0.00'); assert.equal(t.total, '2.75');
});
test('totales con impuesto (15 %) y redondeo a centavos', () => {
  const t = calcularTotales([{ precio: '0.70', cantidad: 3 }], 15);
  assert.equal(t.subtotal, '2.10'); assert.equal(t.impuesto, '0.32'); assert.equal(t.total, '2.42');
});
test('sin errores de coma flotante (0.1 + 0.2)', () => {
  const t = calcularTotales([{ precio: '0.10', cantidad: 1 }, { precio: '0.20', cantidad: 1 }], 0);
  assert.equal(t.total, '0.30'); assert.equal(aCentavos('1.005') >= 100, true);
});
test('dinero hablado', () => {
  assert.equal(dineroHablado('2.75'), '2 dólares con 75 centavos');
  assert.equal(dineroHablado('1.00'), '1 dólar');
  assert.equal(dineroHablado('0.45'), '0 dólares con 45 centavos');
});

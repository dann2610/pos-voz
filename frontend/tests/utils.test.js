import test from 'node:test';
import assert from 'node:assert/strict';
import { dinero, totalesPrevios, etiquetaDia } from '../src/utils/format.js';
import { mensajeErrorVoz, soportaReconocimiento, soportaSintesis } from '../src/utils/voz.js';

test('vista previa de totales en centavos, con impuesto', () => {
  const t = totalesPrevios([{ precio: '0.70', cantidad: 3 }], 15);
  assert.deepEqual(t, { subtotal: 2.1, impuesto: 0.32, total: 2.42 });
});
test('formato de dinero y de día', () => {
  assert.match(dinero(2.5), /^\$2[.,]50$/);
  assert.equal(etiquetaDia('2026-10-25'), '25/10');
});
test('sin soporte de voz del navegador (Node no tiene window): se detecta y no falla', () => {
  assert.equal(soportaReconocimiento(), false);
  assert.equal(soportaSintesis(), false);
});
test('con soporte webkitSpeechRecognition se detecta', () => {
  globalThis.window = { webkitSpeechRecognition: function Mock() {} };
  assert.equal(soportaReconocimiento(), true);
  delete globalThis.window;
});
test('mensajes de error de voz en español, comprensibles', () => {
  assert.match(mensajeErrorVoz('not-allowed'), /permiso.*micrófono/i);
  assert.match(mensajeErrorVoz('no-speech'), /No te escuché/);
  assert.match(mensajeErrorVoz('network'), /internet/);
  assert.equal(mensajeErrorVoz('aborted'), null);
  assert.match(mensajeErrorVoz('otro-error'), /modo manual/);
});

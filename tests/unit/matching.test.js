import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, similitud } from '../../backend/src/services/voz/similitud.js';
import { indexarCatalogo, buscarProducto } from '../../backend/src/services/voz/matching.js';
import { interpretar } from '../../backend/src/services/voz/interprete.js';
import { fonetico, normalizar } from '../../backend/src/services/voz/texto.js';

const nombres = ['Coca-Cola', 'Pepsi', 'Arroz Flor', 'Arroz Gustadina', 'Leche Vita', 'Jabón Protex', 'Papas Ruffles', 'Chocolate Manicho', 'Galletas Ricas'];
const productos = nombres.map((nombre, i) => ({ id_producto: i + 1, nombre, descripcion: null, precio: '1.00', stock: nombre.startsWith('Choc') ? 0 : nombre.startsWith('Papas') ? 3 : 20 }));
const idx = indexarCatalogo(productos);
const buscar = (f) => buscarProducto(f, idx, { umbral: 0.6, margen: 0.08 });

test('Levenshtein', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.equal(similitud('coca', 'coca'), 1);
});
test('normalización: tildes, mayúsculas y signos', () => {
  assert.equal(normalizar('¿Cuánto cuesta la LECHE?'), 'cuanto cuesta la leche');
  assert.equal(fonetico('koka'), fonetico('coca'));
});
test('coincidencia exacta y variantes fonéticas', () => {
  assert.equal(buscar('coca cola').mejor.producto.nombre, 'Coca-Cola');
  assert.equal(buscar('coca kola').mejor.producto.nombre, 'Coca-Cola');
  assert.equal(buscar('cocacola').mejor.producto.nombre, 'Coca-Cola');
  assert.equal(buscar('jabon protec').mejor.producto.nombre, 'Jabón Protex');
});
test('plural y error de escritura', () => {
  assert.equal(buscar('galetas').mejor.producto.nombre, 'Galletas Ricas');
  assert.equal(buscar('papas rufles').mejor.producto.nombre, 'Papas Ruffles');
});
test('nombres parecidos: devuelve opciones, no elige en silencio', () => {
  const r = buscar('arroz');
  assert.equal(r.estado, 'ambiguo');
  assert.deepEqual(r.opciones.map((o) => o.producto.nombre).sort(), ['Arroz Flor', 'Arroz Gustadina']);
});
test('el nombre completo resuelve la ambigüedad', () => assert.equal(buscar('arroz gustadina').mejor.producto.nombre, 'Arroz Gustadina'));
test('producto inexistente', () => assert.equal(buscar('pizza napolitana').estado, 'no_encontrado'));
test('umbral configurable: con umbral alto un error ya no coincide', () => {
  assert.equal(buscarProducto('galetas', idx, { umbral: 0.95 }).estado, 'no_encontrado');
});

test('intérprete: venta con stock suficiente, insuficiente y agotado', () => {
  const r = interpretar('vender dos coca cola y cinco papas ruffles y un chocolate manicho', productos, { umbral: 0.6, margen: 0.08 });
  assert.equal(r.intent, 'vender');
  assert.deepEqual(r.items.map((i) => i.estado), ['ok', 'sin_stock', 'sin_stock']);
  assert.equal(r.items[0].cantidad, 2);
});
test('intérprete: intenciones', () => {
  const c = { umbral: 0.6, margen: 0.08 };
  assert.equal(interpretar('Cancelar el pedido actual', productos, c).intent, 'cancelar');
  assert.equal(interpretar('Confirmar la venta', productos, c).intent, 'confirmar');
  const p = interpretar('¿Cuánto cuesta la leche?', productos, c);
  assert.equal(p.intent, 'consultar_precio'); assert.equal(p.consulta.producto.nombre, 'Leche Vita');
  const s = interpretar('¿Cuántas unidades quedan de papas ruffles?', productos, c);
  assert.equal(s.intent, 'consultar_stock'); assert.equal(s.consulta.producto.stock, 3);
  assert.equal(interpretar('hola buenas', productos, c).intent, 'desconocido');
  assert.equal(interpretar('el segundo', productos, c, { hayPedidoPendiente: true }).indice, 1);
});

test('presentaciones del mismo producto: la descripción desempata ("coca cola 500", "3 litros")', () => {
  const c = { umbral: 0.6, margen: 0.08 };
  const cat = [['Coca-Cola', 'Botella 500 ml'], ['Coca-Cola', 'Botella 1.35 litros'], ['Coca-Cola', 'Botella 3 litros'], ['Pepsi', 'Botella 500 ml']]
    .map(([nombre, descripcion], i) => ({ id_producto: i + 1, nombre, descripcion, precio: '1.00', stock: 20 }));
  const sin = interpretar('dos coca cola', cat, c);
  assert.equal(sin.items[0].estado, 'ambiguo'); assert.equal(sin.items[0].opciones.length, 3); // no adivina
  const a = interpretar('dos coca cola 500', cat, c);
  assert.equal(a.items[0].estado, 'ok'); assert.equal(a.items[0].descripcion, 'Botella 500 ml'); assert.equal(a.items[0].cantidad, 2);
  const b = interpretar('tres coca cola de tres litros y una pepsi', cat, c);
  assert.deepEqual(b.items.map((i) => [i.cantidad, i.nombre, i.descripcion]), [[3, 'Coca-Cola', 'Botella 3 litros'], [1, 'Pepsi', 'Botella 500 ml']]);
});

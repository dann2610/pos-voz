import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarBD, levantar } from './helpers.js';

let api; let t;
before(async () => { reiniciarBD(); api = await levantar(); t = await api.sesion(); });
after(() => api.cerrar());

const decir = (texto, id_pedido, token = t.vendedor) => api.http('POST', '/voz/interpretar', { token, cuerpo: { texto, id_pedido } });
const nVentas = async () => (await api.http('GET', '/ventas?por_pagina=1', { token: t.admin })).json.paginacion.total;

test('venta por voz: interpretar NO toca el inventario; confirmar registra venta (canal voz) y descuenta stock', async () => {
  const coca = await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml'); const antes = coca.stock; const v0 = await nVentas();
  const r = await decir('Vender dos Coca-Cola 500 ml');
  assert.equal(r.status, 200); assert.equal(r.json.intent, 'vender');
  assert.equal(r.json.items[0].cantidad, 2); assert.equal(r.json.items[0].nombre, 'Coca-Cola');
  assert.equal(r.json.listo_para_confirmar, true); assert.equal(r.json.resumen.total, '1.50');
  assert.match(r.json.habla, /Confirmas/);
  assert.equal((await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml')).stock, antes); assert.equal(await nVentas(), v0);
  const c = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: { metodo_pago: 'efectivo', duracion_seg: 12 } });
  assert.equal(c.status, 200); assert.equal(c.json.venta.canal, 'voz'); assert.equal(c.json.venta.total, '1.50'); assert.equal(c.json.venta.duracion_seg, 12);
  assert.equal((await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml')).stock, antes - 2);
  // confirmar de nuevo no duplica (idempotente)
  const c2 = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} });
  assert.equal(c2.json.venta.id_venta, c.json.venta.id_venta);
  assert.equal((await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml')).stock, antes - 2); assert.equal(await nVentas(), v0 + 1);
});

test('pedido cancelado no crea venta ni movimientos', async () => {
  const pepsi = await api.producto(t.admin, 'Pepsi', 'Botella 500 ml'); const v0 = await nVentas();
  const r = await decir('dame tres pepsi 500');
  const cmd = await decir('Cancelar el pedido actual', r.json.id_pedido);
  assert.equal(cmd.json.intent, 'cancelar'); assert.equal(cmd.json.estado, 'cancelado');
  const c = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} });
  assert.equal(c.status, 409);
  assert.equal((await api.producto(t.admin, 'Pepsi', 'Botella 500 ml')).stock, pepsi.stock); assert.equal(await nVentas(), v0);
  const m = (await api.http('GET', `/inventario/movimientos?id_producto=${pepsi.id_producto}`, { token: t.admin })).json.datos;
  assert.ok(m.every((x) => x.id_venta === null));
});

test('nombres parecidos: pide elegir; no se puede confirmar hasta resolver; "el segundo" selecciona', async () => {
  const r = await decir('dos arroz');
  assert.equal(r.json.items[0].estado, 'ambiguo'); assert.equal(r.json.listo_para_confirmar, false);
  assert.ok(r.json.items[0].opciones.length >= 2); assert.match(r.json.habla, /Cuál/i);
  const c = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} });
  assert.equal(c.status, 400);
  const sel = await decir('el segundo', r.json.id_pedido);
  assert.equal(sel.json.items[0].estado, 'ok'); assert.equal(sel.json.listo_para_confirmar, true);
  assert.equal(sel.json.items[0].nombre, r.json.items[0].opciones[1].nombre);
});

test('resolver por botón (modo accesible) solo acepta opciones propuestas', async () => {
  const r = await decir('un arroz');
  const flor = r.json.items[0].opciones.find((o) => o.nombre === 'Arroz Flor');
  const leche = await api.producto(t.admin, 'Leche Vita');
  assert.equal((await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/resolver`, { token: t.vendedor, cuerpo: { indice: 0, id_producto: leche.id_producto } })).status, 400);
  const ok = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/resolver`, { token: t.vendedor, cuerpo: { indice: 0, id_producto: flor.id_producto } });
  assert.equal(ok.status, 200); assert.equal(ok.json.items[0].nombre, 'Arroz Flor');
});

test('producto inexistente y producto sin stock suficiente quedan marcados y bloquean la confirmación', async () => {
  const a = await decir('vender dos pizza hawaiana');
  assert.equal(a.json.items[0].estado, 'no_encontrado'); assert.equal(a.json.listo_para_confirmar, false);
  const b = await decir('cinco papas ruffles');
  assert.equal(b.json.items[0].estado, 'sin_stock'); assert.match(b.json.items[0].mensaje, /quedan 3/);
  assert.equal((await api.http('POST', `/voz/pedidos/${b.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} })).status, 400);
  const c = await decir('un chocolate manicho');
  assert.equal(c.json.items[0].estado, 'sin_stock'); assert.match(c.json.items[0].mensaje, /agotado/);
});

test('editar el pedido: cambiar cantidad (se revalida el stock) y quitar un renglón', async () => {
  const r = await decir('dos coca cola 500 y una leche vita funda');
  assert.equal(r.json.items.length, 2);
  const m = await api.http('PATCH', `/voz/pedidos/${r.json.id_pedido}/items/0`, { token: t.vendedor, cuerpo: { cantidad: 1000 } });
  assert.equal(m.json.items[0].estado, 'sin_stock'); assert.equal(m.json.listo_para_confirmar, false);
  const m2 = await api.http('PATCH', `/voz/pedidos/${r.json.id_pedido}/items/0`, { token: t.vendedor, cuerpo: { cantidad: 3 } });
  assert.equal(m2.json.items[0].cantidad, 3); assert.equal(m2.json.listo_para_confirmar, true);
  const q = await api.http('PATCH', `/voz/pedidos/${r.json.id_pedido}/items/0`, { token: t.vendedor, cuerpo: { cantidad: 0 } });
  assert.equal(q.json.items.length, 1); assert.equal(q.json.items[0].nombre, 'Leche Vita');
});

test('con un pedido en curso, todo lo que se dicta se suma al mismo pedido; cancelar lo vacía', async () => {
  const r = await decir('dos coca cola 500');
  const s = await decir('tres pepsi 500', r.json.id_pedido);
  assert.equal(s.json.id_pedido, r.json.id_pedido); assert.equal(s.json.items.length, 2);
  const t2 = await decir('vender un jugo del valle 1 litro', r.json.id_pedido);
  assert.equal(t2.json.items.length, 3); assert.equal(t2.json.id_pedido, r.json.id_pedido);
  await decir('cancelar el pedido actual', r.json.id_pedido);
  const n = await decir('un jugo del valle 1 litro', r.json.id_pedido);
  assert.notEqual(n.json.id_pedido, r.json.id_pedido); assert.equal(n.json.items.length, 1);
});

test('confirmación vuelve a validar el stock: si cambió entre dictar y confirmar, se rechaza sin descontar', async () => {
  const q = await api.producto(t.admin, 'Queso Kiosko'); // stock 18
  const r = await decir('diez queso kiosko');
  assert.equal(r.json.listo_para_confirmar, true);
  await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'salida', id_producto: q.id_producto, cantidad: 12, motivo: 'Venta mostrador' } });
  const c = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} });
  assert.equal(c.status, 409); assert.equal(c.json.error.codigo, 'STOCK_INSUFICIENTE');
  assert.equal((await api.producto(t.admin, 'Queso Kiosko')).stock, 6);
  // el pedido sigue pendiente: se puede corregir y confirmar
  const m = await api.http('PATCH', `/voz/pedidos/${r.json.id_pedido}/items/0`, { token: t.vendedor, cuerpo: { cantidad: 5 } });
  assert.equal(m.json.listo_para_confirmar, true);
  assert.equal((await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} })).status, 200);
});

test('pedido caducado no se puede confirmar', async () => {
  const r = await decir('una azucar valdez');
  await api.pool.query(`UPDATE pedidos_voz SET expira_en = now() - interval '1 minute' WHERE id_pedido = $1`, [r.json.id_pedido]);
  const c = await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: {} });
  assert.equal(c.status, 409); assert.equal(c.json.error.codigo, 'PEDIDO_CADUCADO');
});

test('un usuario no puede ver ni confirmar el pedido de otro', async () => {
  const r = await decir('una azucar valdez');
  assert.equal((await api.http('GET', `/voz/pedidos/${r.json.id_pedido}`, { token: t.admin })).status, 404);
  assert.equal((await api.http('POST', `/voz/pedidos/${r.json.id_pedido}/confirmar`, { token: t.admin, cuerpo: {} })).status, 404);
});

test('consultas por voz: precio y stock', async () => {
  const p = await decir('¿Cuánto cuesta la Pepsi de 3 litros?');
  assert.equal(p.json.intent, 'consultar_precio'); assert.match(p.json.mensaje, /Pepsi cuesta \$2\.30/);
  const amb = await decir('¿Cuánto cuesta la leche?');
  assert.equal(amb.json.consulta.estado, 'ambiguo'); // dos presentaciones: pide precisar, no adivina
  const s = await decir('¿Cuántas unidades quedan de papas ruffles?');
  assert.equal(s.json.intent, 'consultar_stock'); assert.match(s.json.mensaje, /Quedan 3/);
  const a = await decir('¿Cuántas unidades quedan de arroz?');
  assert.equal(a.json.consulta.estado, 'ambiguo');
});

test('texto no entendido, vacío o demasiado largo; y la venta manual sigue funcionando sin voz', async () => {
  assert.equal((await decir('blablabla')).json.intent, 'desconocido');
  assert.equal((await decir('')).status, 400);
  assert.equal((await decir('a'.repeat(400))).status, 400);
  const agua = await api.producto(t.admin, 'Agua Tesalia');
  assert.equal((await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: agua.id_producto, cantidad: 1 }] } })).status, 201);
});

test('umbral de similitud configurable afecta al reconocimiento', async () => {
  const cfg = { nombre_negocio: 'Tienda Demo', tasa_impuesto: 0, umbral_similitud: 0.95, margen_ambiguedad: 0.08, minutos_caducidad: 5 };
  await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: cfg });
  assert.equal((await decir('dos galetas ricas')).json.items[0].estado, 'no_encontrado');
  await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: { ...cfg, umbral_similitud: 0.6 } });
  assert.equal((await decir('dos galetas ricas')).json.items[0].estado, 'ok');
});

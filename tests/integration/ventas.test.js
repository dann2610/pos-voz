import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarBD, levantar } from './helpers.js';

let api; let t;
before(async () => { reiniciarBD(); api = await levantar(); t = await api.sesion(); });
after(() => api.cerrar());

const movs = async (id) => (await api.http('GET', `/inventario/movimientos?id_producto=${id}&por_pagina=100`, { token: t.admin })).json.datos;

test('venta manual: descuenta stock, guarda precio histórico y crea movimiento de salida', async () => {
  const coca = await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml');
  const antes = coca.stock;
  const r = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: coca.id_producto, cantidad: 3 }], metodo_pago: 'efectivo' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.total, '2.25'); assert.equal(r.json.canal, 'manual');
  assert.equal(r.json.detalle[0].precio_unitario, '0.75');
  assert.equal((await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml')).stock, antes - 3);
  const m = (await movs(coca.id_producto))[0];
  assert.equal(m.tipo_movimiento, 'salida'); assert.equal(m.id_venta, r.json.id_venta); assert.equal(m.stock_resultante, antes - 3);
  // cambiar el precio después no altera la venta histórica
  await api.http('PUT', `/productos/${coca.id_producto}`, { token: t.admin, cuerpo: { nombre: 'Coca-Cola', descripcion: 'Botella 500 ml', costo: 0.52, precio: 1.5, stock_minimo: 10, id_categoria: coca.id_categoria } });
  const h = await api.http('GET', `/ventas/${r.json.id_venta}`, { token: t.vendedor });
  assert.equal(h.json.detalle[0].precio_unitario, '0.75'); assert.equal(h.json.total, '2.25');
});

test('el total lo calcula el servidor con el impuesto configurado; el cliente no puede imponerlo', async () => {
  await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: { nombre_negocio: 'Tienda Demo', tasa_impuesto: 15, umbral_similitud: 0.6, margen_ambiguedad: 0.08, minutos_caducidad: 5 } });
  const leche = await api.producto(t.admin, 'Leche Vita', 'Funda 1 litro');
  const r = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: leche.id_producto, cantidad: 2 }], total: '0.01', subtotal: '0.01' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.subtotal, '2.10'); assert.equal(r.json.impuesto, '0.32'); assert.equal(r.json.total, '2.42'); assert.equal(r.json.tasa_impuesto, '15.00');
  await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: { nombre_negocio: 'Tienda Demo', tasa_impuesto: 0, umbral_similitud: 0.6, margen_ambiguedad: 0.08, minutos_caducidad: 5 } });
});

test('stock insuficiente, agotado, inactivo e inexistente se rechazan sin modificar nada', async () => {
  const papas = await api.producto(t.admin, 'Papas Ruffles'); // stock 3
  const choc = await api.producto(t.admin, 'Chocolate Manicho'); // stock 0
  const pepsi = await api.producto(t.admin, 'Pepsi', 'Botella 500 ml');
  const r1 = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: papas.id_producto, cantidad: 4 }] } });
  assert.equal(r1.status, 409); assert.equal(r1.json.error.codigo, 'STOCK_INSUFICIENTE');
  const r2 = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: choc.id_producto, cantidad: 1 }] } });
  assert.equal(r2.status, 409);
  await api.http('PATCH', `/productos/${pepsi.id_producto}/estado`, { token: t.admin, cuerpo: { estado: false } });
  const r3 = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: pepsi.id_producto, cantidad: 1 }] } });
  assert.equal(r3.status, 409); assert.equal(r3.json.error.codigo, 'PRODUCTO_INACTIVO');
  await api.http('PATCH', `/productos/${pepsi.id_producto}/estado`, { token: t.admin, cuerpo: { estado: true } });
  assert.equal((await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: 99999, cantidad: 1 }] } })).status, 409);
  assert.equal((await api.producto(t.admin, 'Papas Ruffles')).stock, 3);
});

test('atomicidad: si una línea falla, ninguna otra línea descuenta stock ni genera movimientos', async () => {
  const azucar = await api.producto(t.admin, 'Azúcar Valdez'); const papas = await api.producto(t.admin, 'Papas Ruffles');
  const antes = azucar.stock; const nm = (await movs(azucar.id_producto)).length;
  const r = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: azucar.id_producto, cantidad: 2 }, { id_producto: papas.id_producto, cantidad: 50 }] } });
  assert.equal(r.status, 409);
  assert.equal((await api.producto(t.admin, 'Azúcar Valdez')).stock, antes);
  assert.equal((await movs(azucar.id_producto)).length, nm);
});

test('validación de entrada: carrito vacío, cantidad 0, cantidad decimal, método de pago inválido', async () => {
  const coca = await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml');
  for (const cuerpo of [
    { items: [] }, { items: [{ id_producto: coca.id_producto, cantidad: 0 }] }, { items: [{ id_producto: coca.id_producto, cantidad: 1.5 }] },
    { items: [{ id_producto: coca.id_producto, cantidad: 1 }], metodo_pago: 'bitcoin' },
  ]) assert.equal((await api.http('POST', '/ventas', { token: t.vendedor, cuerpo })).status, 400);
});

test('idempotencia: reintentar con la misma clave devuelve la misma venta y descuenta una sola vez', async () => {
  const fideo = await api.producto(t.admin, 'Fideo Sumesa'); const antes = fideo.stock;
  const cuerpo = { items: [{ id_producto: fideo.id_producto, cantidad: 2 }], clave_idempotencia: 'clave-prueba-0001' };
  const a = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo });
  const b = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo });
  assert.equal(a.status, 201); assert.equal(b.status, 200);
  assert.equal(a.json.id_venta, b.json.id_venta); assert.equal(b.json.repetida, true);
  assert.equal((await api.producto(t.admin, 'Fideo Sumesa')).stock, antes - 2);
});

test('idempotencia con peticiones simultáneas: solo una venta', async () => {
  const q = await api.producto(t.admin, 'Queso Kiosko'); const antes = q.stock;
  const cuerpo = { items: [{ id_producto: q.id_producto, cantidad: 1 }], clave_idempotencia: 'clave-simultanea-01' };
  const rs = await Promise.all(Array.from({ length: 6 }, () => api.http('POST', '/ventas', { token: t.vendedor, cuerpo })));
  assert.equal(new Set(rs.map((r) => r.json.id_venta)).size, 1);
  assert.ok(rs.every((r) => [200, 201].includes(r.status)));
  assert.equal((await api.producto(t.admin, 'Queso Kiosko')).stock, antes - 1);
});

test('concurrencia: con 1 unidad y 5 compradores simultáneos, solo uno compra y el stock nunca es negativo', async () => {
  const j = await api.producto(t.admin, 'Jabón Protex');
  await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'ajuste', id_producto: j.id_producto, nuevo_stock: 1, motivo: 'Prueba de concurrencia' } });
  const rs = await Promise.all(Array.from({ length: 5 }, () => api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: j.id_producto, cantidad: 1 }] } })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409).length, 4);
  assert.equal((await api.producto(t.admin, 'Jabón Protex')).stock, 0);
});

test('cliente opcional: con cliente válido se asocia; con cliente inexistente se rechaza', async () => {
  const cl = (await api.http('GET', '/clientes?q=María', { token: t.vendedor })).json.datos[0];
  const agua = await api.producto(t.admin, 'Agua Tesalia');
  const ok = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: agua.id_producto, cantidad: 1 }], id_cliente: cl.id_cliente, metodo_pago: 'transferencia' } });
  assert.equal(ok.status, 201); assert.match(ok.json.cliente, /María/); assert.equal(ok.json.metodo_pago, 'transferencia');
  const mal = await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: agua.id_producto, cantidad: 1 }], id_cliente: 9999 } });
  assert.equal(mal.status, 400);
});

test('historial: el vendedor solo ve sus ventas; el administrador ve todas; ventas finalizadas no se editan ni borran', async () => {
  const otro = await api.http('POST', '/usuarios', { token: t.admin, cuerpo: { nombre: 'Otro', apellido: 'Vendedor', correo: 'otro@demo.com', contrasena: 'Otro123456', id_rol: 2 } });
  assert.equal(otro.status, 201);
  const tok2 = await api.login('otro@demo.com', 'Otro123456');
  const galletas = await api.producto(t.admin, 'Galletas Ricas');
  const v2 = await api.http('POST', '/ventas', { token: tok2, cuerpo: { items: [{ id_producto: galletas.id_producto, cantidad: 1 }] } });
  const mias = await api.http('GET', '/ventas?por_pagina=100', { token: t.vendedor });
  assert.ok(mias.json.datos.length > 0 && mias.json.datos.every((v) => v.vendedor === 'Vendedor Demo'));
  assert.equal((await api.http('GET', `/ventas/${v2.json.id_venta}`, { token: t.vendedor })).status, 403);
  const todas = await api.http('GET', '/ventas?por_pagina=100', { token: t.admin });
  assert.ok(todas.json.datos.some((v) => v.vendedor === 'Otro Vendedor') && todas.json.datos.some((v) => v.vendedor === 'Vendedor Demo'));
  for (const m of ['PUT', 'PATCH', 'DELETE']) assert.equal((await api.http(m, `/ventas/${v2.json.id_venta}`, { token: t.admin, cuerpo: {} })).status, 404);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const f = await api.http('GET', `/ventas?desde=${hoy}&hasta=${hoy}&canal=manual`, { token: t.admin });
  assert.equal(f.status, 200); assert.ok(f.json.paginacion.total >= 1);
  assert.equal((await api.http('GET', '/ventas?desde=ayer', { token: t.admin })).status, 400);
});

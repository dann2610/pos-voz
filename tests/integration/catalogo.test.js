import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarBD, levantar } from './helpers.js';

let api; let t;
before(async () => { reiniciarBD(); api = await levantar(); t = await api.sesion(); });
after(() => api.cerrar());

test('categorías: crear, duplicado, editar y no desactivar con productos activos', async () => {
  const c = await api.http('POST', '/categorias', { token: t.admin, cuerpo: { nombre: 'Mascotas', descripcion: 'Alimento' } });
  assert.equal(c.status, 201);
  assert.equal((await api.http('POST', '/categorias', { token: t.admin, cuerpo: { nombre: 'mascotas' } })).status, 409);
  assert.equal((await api.http('PUT', `/categorias/${c.json.id_categoria}`, { token: t.admin, cuerpo: { nombre: 'Mascotas y más' } })).status, 200);
  const bebidas = (await api.http('GET', '/categorias?q=Bebidas', { token: t.admin })).json.datos[0];
  assert.equal((await api.http('PATCH', `/categorias/${bebidas.id_categoria}/estado`, { token: t.admin, cuerpo: { estado: false } })).status, 409);
  assert.equal((await api.http('PATCH', `/categorias/${c.json.id_categoria}/estado`, { token: t.admin, cuerpo: { estado: false } })).status, 200);
});

test('productos: validación, stock inicial genera movimiento, duplicado y stock no editable por PUT', async () => {
  const cat = (await api.http('GET', '/categorias?q=Aseo', { token: t.admin })).json.datos[0];
  const malo = await api.http('POST', '/productos', { token: t.admin, cuerpo: { nombre: 'Malo', precio: -1, id_categoria: cat.id_categoria } });
  assert.equal(malo.status, 400);
  const p = await api.http('POST', '/productos', { token: t.admin, cuerpo: { nombre: 'Detergente Prueba', descripcion: 'Funda 500 g', costo: 1.4, precio: 2.15, stock: 10, stock_minimo: 3, id_categoria: cat.id_categoria } });
  assert.equal(p.status, 201); assert.equal(p.json.stock, 10);
  const movs = await api.http('GET', `/inventario/movimientos?id_producto=${p.json.id_producto}`, { token: t.admin });
  assert.equal(movs.json.datos.length, 1); assert.equal(movs.json.datos[0].motivo, 'Stock inicial');
  const dup = await api.http('POST', '/productos', { token: t.admin, cuerpo: { nombre: 'detergente prueba', descripcion: 'funda 500 g', precio: 1, id_categoria: cat.id_categoria } });
  assert.equal(dup.status, 409);
  const ed = await api.http('PUT', `/productos/${p.json.id_producto}`, { token: t.admin, cuerpo: { nombre: 'Detergente Prueba', descripcion: 'Funda 500 g', costo: 1.5, precio: 2.25, stock: 999, stock_minimo: 4, id_categoria: cat.id_categoria } });
  assert.equal(ed.status, 200); assert.equal(ed.json.precio, '2.25'); assert.equal(ed.json.stock, 10);
});

test('inventario: entrada, salida, ajuste, stock insuficiente y alertas', async () => {
  const papas = await api.producto(t.admin, 'Papas Ruffles'); // stock 3, mínimo 6 -> alerta "bajo"
  const al = await api.http('GET', '/inventario/alertas', { token: t.vendedor });
  assert.ok(al.json.datos.some((a) => a.nombre === 'Papas Ruffles' && a.nivel === 'bajo'));
  assert.ok(al.json.datos.some((a) => a.nombre === 'Chocolate Manicho' && a.nivel === 'agotado'));
  const e = await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'entrada', id_producto: papas.id_producto, cantidad: 20, motivo: 'Compra a proveedor' } });
  assert.equal(e.status, 201); assert.equal(e.json.stock_resultante, 23);
  const s = await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'salida', id_producto: papas.id_producto, cantidad: 3, motivo: 'Producto dañado' } });
  assert.equal(s.json.stock_resultante, 20);
  const exceso = await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'salida', id_producto: papas.id_producto, cantidad: 21, motivo: 'Prueba' } });
  assert.equal(exceso.status, 409); assert.equal(exceso.json.error.codigo, 'STOCK_INSUFICIENTE');
  const sinMotivo = await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'entrada', id_producto: papas.id_producto, cantidad: 1 } });
  assert.equal(sinMotivo.status, 400);
  const aj = await api.http('POST', '/inventario/movimientos', { token: t.admin, cuerpo: { tipo_movimiento: 'ajuste', id_producto: papas.id_producto, nuevo_stock: 18, motivo: 'Conteo físico' } });
  assert.equal(aj.json.stock_resultante, 18); assert.equal(aj.json.cantidad, 2);
  assert.equal((await api.producto(t.admin, 'Papas Ruffles')).stock, 18);
});

test('productos inactivos no aparecen para el vendedor', async () => {
  const p = await api.producto(t.admin, 'Pepsi', 'Botella 500 ml');
  await api.http('PATCH', `/productos/${p.id_producto}/estado`, { token: t.admin, cuerpo: { estado: false } });
  assert.equal(await api.producto(t.vendedor, 'Pepsi', 'Botella 500 ml'), undefined);
  assert.ok(await api.producto(t.admin, 'Pepsi', 'Botella 500 ml'));
  await api.http('PATCH', `/productos/${p.id_producto}/estado`, { token: t.admin, cuerpo: { estado: true } });
});

test('clientes: el vendedor ve datos limitados; el administrador, completos', async () => {
  const a = await api.http('POST', '/clientes', { token: t.admin, cuerpo: { nombre: 'Luis', apellido: 'Mora', identificacion: '0912345678', telefono: '0991112222', correo: 'luis@correo.com' } });
  assert.equal(a.status, 201);
  assert.equal((await api.http('POST', '/clientes', { token: t.admin, cuerpo: { nombre: 'Otro', identificacion: '0912345678' } })).status, 409);
  const v = (await api.http('GET', '/clientes?q=Luis', { token: t.vendedor })).json.datos[0];
  assert.equal(v.telefono, undefined); assert.equal(v.correo, undefined); assert.match(v.identificacion, /^\*+678$/);
  const ad = (await api.http('GET', '/clientes?q=Luis', { token: t.admin })).json.datos[0];
  assert.equal(ad.telefono, '0991112222');
  assert.equal((await api.http('PUT', `/clientes/${a.json.id_cliente}`, { token: t.vendedor, cuerpo: { nombre: 'X' } })).status, 403);
});

test('costo de compra: el administrador lo ve y lo edita; el vendedor no lo ve', async () => {
  const agua = await api.producto(t.admin, 'Agua Tesalia', 'Botella 600 ml');
  assert.equal(agua.costo, '0.21'); assert.equal(agua.precio, '0.50');
  const v = await api.producto(t.vendedor, 'Agua Tesalia', 'Botella 600 ml');
  assert.equal(v.costo, undefined);
  const malo = await api.http('PUT', `/productos/${agua.id_producto}`, { token: t.admin, cuerpo: { nombre: agua.nombre, descripcion: agua.descripcion, costo: -1, precio: 0.5, stock_minimo: 24, id_categoria: agua.id_categoria } });
  assert.equal(malo.status, 400);
});

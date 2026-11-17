import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarBD, levantar } from './helpers.js';

let api; let t;
before(async () => {
  reiniciarBD(); api = await levantar(); t = await api.sesion();
  const coca = await api.producto(t.admin, 'Coca-Cola', 'Botella 500 ml'); const leche = await api.producto(t.admin, 'Leche Vita', 'Funda 1 litro');
  await api.http('POST', '/ventas', { token: t.vendedor, cuerpo: { items: [{ id_producto: coca.id_producto, cantidad: 4 }, { id_producto: leche.id_producto, cantidad: 1 }], duracion_seg: 40 } });
  await api.http('POST', '/ventas', { token: t.admin, cuerpo: { items: [{ id_producto: coca.id_producto, cantidad: 2 }], metodo_pago: 'transferencia' } });
  const v = await api.http('POST', '/voz/interpretar', { token: t.vendedor, cuerpo: { texto: 'dos leche vita funda' } });
  await api.http('POST', `/voz/pedidos/${v.json.id_pedido}/confirmar`, { token: t.vendedor, cuerpo: { duracion_seg: 15 } });
});
after(() => api.cerrar());

test('dashboard con datos reales; el vendedor solo ve lo suyo', async () => {
  const a = await api.http('GET', '/dashboard', { token: t.admin });
  assert.equal(a.json.hoy.ventas, 3); assert.equal(a.json.hoy.total, '7.65'); // 3.00+1.05 + 1.50 + 2.10
  // ganancia = venta - costo: coca 6×(0.75-0.52)=1.38 ; leche 3×(1.05-0.78)=0.81
  assert.equal(a.json.hoy.ganancia, '2.19'); assert.equal(a.json.mes.ganancia, '2.19');
  assert.equal(a.json.ultimos_7_dias.length, 7); assert.ok(a.json.usuarios_activos >= 2);
  const v = await api.http('GET', '/dashboard', { token: t.vendedor });
  assert.equal(v.json.hoy.ventas, 2); assert.equal(v.json.usuarios_activos, undefined);
  assert.equal(v.json.hoy.ganancia, undefined); assert.equal(v.json.inventario, undefined); // el vendedor no ve costos ni ganancias
});
test('reportes: ventas por periodo, productos top, vendedores, métodos de pago e inventario', async () => {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  const r = await api.http('GET', `/reportes/ventas?agrupar=dia&desde=${hoy}&hasta=${hoy}`, { token: t.admin });
  assert.equal(r.json.datos.length, 1); assert.equal(r.json.datos[0].ventas, 3); assert.equal(r.json.datos[0].ganancia, '2.19'); assert.equal(r.json.datos[0].subtotal, '7.65');
  const top = await api.http('GET', '/reportes/productos-top?limite=3', { token: t.admin });
  assert.equal(top.json.datos[0].nombre, 'Coca-Cola'); assert.equal(top.json.datos[0].unidades, 6); assert.equal(top.json.datos[0].ganancia, '1.38');
  assert.equal((await api.http('GET', '/reportes/vendedores', { token: t.admin })).json.datos.length, 2);
  const mp = (await api.http('GET', '/reportes/metodos-pago', { token: t.admin })).json.datos;
  assert.ok(mp.find((x) => x.metodo_pago === 'transferencia'));
  const inv = await api.http('GET', '/reportes/inventario', { token: t.admin });
  assert.ok(Number(inv.json.valor_a_costo) > 0 && Number(inv.json.valor_a_precio_venta) > Number(inv.json.valor_a_costo)); assert.equal(inv.json.agotados, 1);
  assert.equal(Number(inv.json.ganancia_potencial).toFixed(2), (Number(inv.json.valor_a_precio_venta) - Number(inv.json.valor_a_costo)).toFixed(2));
  assert.equal((await api.http('GET', '/reportes/ventas?agrupar=siglo', { token: t.admin })).status, 400);
});
test('inventario completo: todo el catálogo con costo, precio, margen y valor; CSV descargable', async () => {
  const d = await api.http('GET', '/reportes/inventario-detalle', { token: t.admin });
  assert.ok(d.json.datos.length >= 100); // catálogo de demostración
  const agua = d.json.datos.find((p) => p.nombre === 'Agua Tesalia' && p.descripcion === 'Botella 600 ml');
  assert.equal(agua.costo, '0.21'); assert.equal(agua.precio, '0.50'); assert.equal(agua.ganancia_unidad, '0.29');
  assert.equal(Number(agua.valor_costo), Number((agua.stock * 0.21).toFixed(2)));
  const csv = await api.http('GET', '/reportes/inventario.csv', { token: t.admin, crudo: true });
  assert.equal(csv.status, 200); assert.ok(csv.texto.includes('categoria,nombre,descripcion,stock'));
  assert.equal((await api.http('GET', '/reportes/inventario-detalle', { token: t.vendedor })).status, 403);
});
test('indicadores de voz: tiempo medio por canal y estado de pedidos', async () => {
  const r = await api.http('GET', '/reportes/voz', { token: t.admin });
  const voz = r.json.canales.find((c) => c.canal === 'voz'); const man = r.json.canales.find((c) => c.canal === 'manual');
  assert.equal(voz.ventas, 1); assert.equal(Number(voz.duracion_media_seg), 15); assert.equal(Number(man.duracion_media_seg), 40);
  assert.ok(r.json.pedidos_voz.find((p) => p.estado === 'confirmado'));
});
test('exportación CSV con BOM, cabecera y protección contra inyección de fórmulas', async () => {
  const cl = await api.http('POST', '/clientes', { token: t.admin, cuerpo: { nombre: '=HYPERLINK("http://x")', apellido: 'Prueba' } });
  const agua = await api.producto(t.admin, 'Agua Tesalia');
  await api.http('POST', '/ventas', { token: t.admin, cuerpo: { items: [{ id_producto: agua.id_producto, cantidad: 1 }], id_cliente: cl.json.id_cliente } });
  const r = await api.http('GET', '/reportes/ventas.csv', { token: t.admin, crudo: true });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv/);
  assert.ok(r.texto.startsWith('﻿id_venta,fecha,vendedor,cliente,canal,metodo_pago,subtotal,impuesto,total'));
  assert.ok(r.texto.includes("'=HYPERLINK")); assert.equal(/,=HYPERLINK/.test(r.texto), false);
  assert.equal((await api.http('GET', '/reportes/ventas.csv', { token: t.vendedor, crudo: true })).status, 403);
});
test('configuración: validación y persistencia', async () => {
  assert.equal((await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: { nombre_negocio: 'X', tasa_impuesto: 150, umbral_similitud: 0.6, margen_ambiguedad: 0.08, minutos_caducidad: 5 } })).status, 400);
  const ok = await api.http('PUT', '/configuracion', { token: t.admin, cuerpo: { nombre_negocio: 'Mi Tienda', tasa_impuesto: 12, umbral_similitud: 0.7, margen_ambiguedad: 0.1, minutos_caducidad: 10 } });
  assert.equal(ok.status, 200);
  assert.equal((await api.http('GET', '/configuracion', { token: t.vendedor })).json.tasa_impuesto, 12);
});
test('tiempo de respuesta del servidor (indicador): endpoints principales < 500 ms (mediana de 20)', async () => {
  const medir = async (m, ruta, cuerpo) => {
    const ts = [];
    for (let i = 0; i < 20; i++) ts.push((await api.http(m, ruta, { token: t.admin, cuerpo })).ms);
    ts.sort((a, b) => a - b); return ts[10];
  };
  const resultados = { productos: await medir('GET', '/productos'), dashboard: await medir('GET', '/dashboard'), interpretar: await medir('POST', '/voz/interpretar', { texto: 'vender dos coca cola' }) };
  console.log('Mediana (ms):', JSON.stringify(Object.fromEntries(Object.entries(resultados).map(([k, v]) => [k, Math.round(v)]))));
  for (const [k, v] of Object.entries(resultados)) assert.ok(v < 500, `${k} tardó ${v} ms`);
});

import { query } from '../config/db.js';
import { TZ, inicioDia, finDia } from '../utils/fechas.js';

function rango(f, alias = 'v.fecha', extra = [], base = []) {
  const w = [...extra]; const v = [...base];
  if (f.desde) { v.push(f.desde); w.push(`${alias} >= ${inicioDia(v.length)}`); }
  if (f.hasta) { v.push(f.hasta); w.push(`${alias} < ${finDia(v.length)}`); }
  return { where: w.length ? `WHERE ${w.join(' AND ')}` : '', v };
}

const UNIDAD = { dia: 'day', semana: 'week', mes: 'month' };

export async function ventasPorPeriodo(f) {
  const { where, v } = rango(f);
  const unidad = UNIDAD[f.agrupar] || 'day';
  const { rows } = await query(
    `SELECT to_char(date_trunc('${unidad}', v.fecha AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS periodo,
            count(*)::int AS ventas, sum(v.total)::numeric(12,2) AS total, sum(v.impuesto)::numeric(12,2) AS impuesto,
            sum(v.subtotal)::numeric(12,2) AS subtotal,
            coalesce(sum((SELECT sum(d.subtotal - d.costo_unitario * d.cantidad) FROM detalle_venta d WHERE d.id_venta = v.id_venta)),0)::numeric(12,2) AS ganancia
       FROM ventas v ${where} GROUP BY 1 ORDER BY 1`, v);
  return rows;
}

export async function productosMasVendidos(f) {
  const { where, v } = rango(f);
  const { rows } = await query(
    `SELECT d.id_producto, d.nombre_producto AS nombre, sum(d.cantidad)::int AS unidades, sum(d.subtotal)::numeric(12,2) AS ingresos,
            sum(d.subtotal - d.costo_unitario * d.cantidad)::numeric(12,2) AS ganancia
       FROM detalle_venta d JOIN ventas v ON v.id_venta=d.id_venta ${where}
      GROUP BY d.id_producto, d.nombre_producto ORDER BY unidades DESC, ingresos DESC LIMIT ${f.limite || 10}`, v);
  return rows;
}

export async function ventasPorVendedor(f) {
  const { where, v } = rango(f);
  const { rows } = await query(
    `SELECT u.id_usuario, u.nombre || ' ' || u.apellido AS vendedor, count(*)::int AS ventas, sum(v.total)::numeric(12,2) AS total
       FROM ventas v JOIN usuarios u ON u.id_usuario=v.id_usuario ${where} GROUP BY u.id_usuario, 2 ORDER BY total DESC`, v);
  return rows;
}

export async function metodosPago(f) {
  const { where, v } = rango(f);
  const { rows } = await query(`SELECT v.metodo_pago, count(*)::int AS ventas, sum(v.total)::numeric(12,2) AS total FROM ventas v ${where} GROUP BY 1 ORDER BY total DESC`, v);
  return rows;
}

export async function inventarioValorado() {
  const { rows } = await query(
    `SELECT count(*) FILTER (WHERE estado)::int AS productos_activos,
            coalesce(sum(stock) FILTER (WHERE estado),0)::int AS unidades_totales,
            coalesce(sum(stock * costo) FILTER (WHERE estado),0)::numeric(12,2) AS valor_a_costo,
            coalesce(sum(stock * precio) FILTER (WHERE estado),0)::numeric(12,2) AS valor_a_precio_venta,
            coalesce(sum(stock * (precio - costo)) FILTER (WHERE estado),0)::numeric(12,2) AS ganancia_potencial,
            count(*) FILTER (WHERE estado AND stock = 0)::int AS agotados,
            count(*) FILTER (WHERE estado AND stock > 0 AND stock <= stock_minimo)::int AS bajos FROM productos`);
  return { ...rows[0], valor_inventario: rows[0].valor_a_precio_venta };
}

/** Inventario completo: todo lo que hay, con costo, precio, valor y margen. */
export async function inventarioDetalle(f = {}) {
  const w = []; const v = [];
  if (f.id_categoria) { v.push(f.id_categoria); w.push(`p.id_categoria = $${v.length}`); }
  if (f.solo_activos !== false) w.push('p.estado');
  const { rows } = await query(
    `SELECT p.id_producto, p.nombre, p.descripcion, c.nombre AS categoria, p.stock, p.stock_minimo, p.costo, p.precio,
            (p.precio - p.costo)::numeric(10,2) AS ganancia_unidad,
            CASE WHEN p.precio > 0 THEN round((p.precio - p.costo) / p.precio * 100, 1) ELSE 0 END AS margen_pct,
            (p.stock * p.costo)::numeric(12,2) AS valor_costo, (p.stock * p.precio)::numeric(12,2) AS valor_venta,
            CASE WHEN p.stock = 0 THEN 'agotado' WHEN p.stock <= p.stock_minimo THEN 'bajo' ELSE 'normal' END AS stock_estado
       FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
      ORDER BY c.nombre, p.nombre, p.descripcion`, v);
  return rows;
}

export async function inventarioCsv() {
  const rows = await inventarioDetalle();
  const cab = ['categoria', 'nombre', 'descripcion', 'stock', 'stock_minimo', 'costo', 'precio', 'ganancia_unidad', 'margen_pct', 'valor_costo', 'valor_venta', 'stock_estado'];
  return '\uFEFF' + [cab.join(','), ...rows.map((r) => cab.map((k) => celda(r[k])).join(','))].join('\r\n') + '\r\n';
}

/** Indicadores de la evaluación: tiempo medio de registro y volumen por canal, y desenlace de pedidos por voz. */
export async function indicadoresVoz(f) {
  const { where, v } = rango(f);
  const canales = (await query(
    `SELECT v.canal, count(*)::int AS ventas, round(avg(v.duracion_seg)::numeric, 1) AS duracion_media_seg,
            count(v.duracion_seg)::int AS ventas_con_tiempo FROM ventas v ${where} GROUP BY 1 ORDER BY 1`, v)).rows;
  const r = rango(f, 'p.creado_en');
  const pedidos = (await query(`SELECT p.estado, count(*)::int AS pedidos FROM pedidos_voz p ${r.where} GROUP BY 1 ORDER BY 1`, r.v)).rows;
  return { canales, pedidos_voz: pedidos };
}

export async function dashboard(usuario) {
  const esAdmin = usuario.rol === 'administrador';
  const filtro = esAdmin ? '' : 'AND v.id_usuario = $1';
  const par = esAdmin ? [] : [usuario.id_usuario];
  const hoy = `v.fecha >= date_trunc('day', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}'`;
  const mes = `v.fecha >= date_trunc('month', now() AT TIME ZONE '${TZ}') AT TIME ZONE '${TZ}'`;
  const [h, m, ult, top, alert] = await Promise.all([
    query(`SELECT count(*)::int AS ventas, coalesce(sum(total),0)::numeric(12,2) AS total, coalesce(sum((SELECT sum(d.subtotal - d.costo_unitario * d.cantidad) FROM detalle_venta d WHERE d.id_venta = v.id_venta)),0)::numeric(12,2) AS ganancia FROM ventas v WHERE ${hoy} ${filtro}`, par),
    query(`SELECT count(*)::int AS ventas, coalesce(sum(total),0)::numeric(12,2) AS total, coalesce(sum((SELECT sum(d.subtotal - d.costo_unitario * d.cantidad) FROM detalle_venta d WHERE d.id_venta = v.id_venta)),0)::numeric(12,2) AS ganancia FROM ventas v WHERE ${mes} ${filtro}`, par),
    query(
      `SELECT to_char(g.dia, 'YYYY-MM-DD') AS periodo, count(v.id_venta)::int AS ventas, coalesce(sum(v.total),0)::numeric(12,2) AS total
         FROM generate_series(date_trunc('day', now() AT TIME ZONE '${TZ}') - interval '6 days', date_trunc('day', now() AT TIME ZONE '${TZ}'), '1 day') g(dia)
         LEFT JOIN ventas v ON date_trunc('day', v.fecha AT TIME ZONE '${TZ}') = g.dia ${filtro}
        GROUP BY g.dia ORDER BY g.dia`, par),
    query(
      `SELECT d.nombre_producto AS nombre, sum(d.cantidad)::int AS unidades FROM detalle_venta d JOIN ventas v ON v.id_venta=d.id_venta
        WHERE ${mes} ${filtro} GROUP BY 1 ORDER BY unidades DESC LIMIT 5`, par),
    query(`SELECT count(*) FILTER (WHERE stock = 0)::int AS agotados, count(*) FILTER (WHERE stock > 0 AND stock <= stock_minimo)::int AS bajos FROM productos WHERE estado`),
  ]);
  const out = { hoy: h.rows[0], mes: m.rows[0], ultimos_7_dias: ult.rows, top_productos_mes: top.rows, alertas: alert.rows[0] };
  if (!esAdmin) { delete out.hoy.ganancia; delete out.mes.ganancia; }
  if (esAdmin) {
    out.inventario = await inventarioValorado();
    out.productos_activos = Number((await query('SELECT count(*) FROM productos WHERE estado')).rows[0].count);
    out.usuarios_activos = Number((await query('SELECT count(*) FROM usuarios WHERE estado')).rows[0].count);
    out.clientes_activos = Number((await query('SELECT count(*) FROM clientes WHERE estado')).rows[0].count);
  }
  return out;
}

const celda = (x) => {
  let s = x === null || x === undefined ? '' : String(x);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita inyección de fórmulas al abrir en Excel
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function ventasCsv(f) {
  const { where, v } = rango(f);
  const { rows } = await query(
    `SELECT v.id_venta, to_char(v.fecha AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI') AS fecha, u.nombre || ' ' || u.apellido AS vendedor,
            coalesce(c.nombre,'') AS cliente, v.canal, v.metodo_pago, v.subtotal, v.impuesto, v.total,
            (SELECT sum(d.subtotal - d.costo_unitario * d.cantidad) FROM detalle_venta d WHERE d.id_venta = v.id_venta)::numeric(12,2) AS ganancia
       FROM ventas v JOIN usuarios u ON u.id_usuario=v.id_usuario LEFT JOIN clientes c ON c.id_cliente=v.id_cliente ${where} ORDER BY v.fecha`, v);
  const cab = ['id_venta', 'fecha', 'vendedor', 'cliente', 'canal', 'metodo_pago', 'subtotal', 'impuesto', 'total'];
  return '﻿' + [cab.join(','), ...rows.map((r) => cab.map((k) => celda(r[k])).join(','))].join('\r\n') + '\r\n';
}

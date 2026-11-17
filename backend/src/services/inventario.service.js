import { query, tx } from '../config/db.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';
import { inicioDia, finDia } from '../utils/fechas.js';

export async function registrarMovimiento(d, actor) {
  return tx(async (c) => {
    const { rows } = await c.query('SELECT id_producto, nombre, stock FROM productos WHERE id_producto=$1 FOR UPDATE', [d.id_producto]);
    const p = rows[0];
    if (!p) throw notFound('Producto no encontrado.');
    let nuevo; let cantidad;
    if (d.tipo_movimiento === 'entrada') { nuevo = p.stock + d.cantidad; cantidad = d.cantidad; }
    else if (d.tipo_movimiento === 'salida') {
      if (d.cantidad > p.stock) throw conflict(`Stock insuficiente: ${p.nombre} tiene ${p.stock} unidad(es).`, 'STOCK_INSUFICIENTE');
      nuevo = p.stock - d.cantidad; cantidad = d.cantidad;
    } else {
      if (d.nuevo_stock === p.stock) throw badRequest(`El stock de ${p.nombre} ya es ${p.stock}; no hay nada que ajustar.`);
      nuevo = d.nuevo_stock; cantidad = Math.abs(d.nuevo_stock - p.stock);
    }
    await c.query('UPDATE productos SET stock=$1, actualizado_en=now() WHERE id_producto=$2', [nuevo, p.id_producto]);
    const m = await c.query(
      `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_resultante, motivo, id_usuario)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [p.id_producto, d.tipo_movimiento, cantidad, nuevo, d.motivo, actor.id_usuario]);
    return { ...m.rows[0], producto: p.nombre, stock_anterior: p.stock };
  });
}

export async function listarMovimientos(f) {
  const p = paginar(f);
  const w = []; const v = [];
  if (f.id_producto) { v.push(f.id_producto); w.push(`m.id_producto=$${v.length}`); }
  if (f.tipo) { v.push(f.tipo); w.push(`m.tipo_movimiento=$${v.length}`); }
  if (f.desde) { v.push(f.desde); w.push(`m.fecha >= ${inicioDia(v.length)}`); }
  if (f.hasta) { v.push(f.hasta); w.push(`m.fecha < ${finDia(v.length)}`); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM movimientos_inventario m ${where}`, v)).rows[0].count);
  const { rows } = await query(
    `SELECT m.*, p.nombre AS producto, u.nombre || ' ' || u.apellido AS usuario
       FROM movimientos_inventario m JOIN productos p ON p.id_producto=m.id_producto JOIN usuarios u ON u.id_usuario=m.id_usuario
       ${where} ORDER BY m.fecha DESC, m.id_movimiento DESC LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows, total, p);
}

export async function alertas() {
  const { rows } = await query(
    `SELECT p.id_producto, p.nombre, p.descripcion, p.stock, p.stock_minimo, c.nombre AS categoria,
            CASE WHEN p.stock = 0 THEN 'agotado' ELSE 'bajo' END AS nivel
       FROM productos p JOIN categorias c ON c.id_categoria=p.id_categoria
      WHERE p.estado AND p.stock <= p.stock_minimo
      ORDER BY (p.stock = 0) DESC, p.stock, p.nombre`);
  return rows;
}

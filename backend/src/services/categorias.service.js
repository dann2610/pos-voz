import { query } from '../config/db.js';
import { conflict, notFound } from '../utils/errors.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';

const SEL = `SELECT c.*, (SELECT count(*)::int FROM productos p WHERE p.id_categoria=c.id_categoria) AS total_productos FROM categorias c`;

export async function listar(f) {
  const p = paginar(f);
  const w = []; const v = [];
  if (f.q) { v.push(`%${f.q}%`); w.push(`c.nombre ILIKE $${v.length}`); }
  if (f.estado !== undefined) { v.push(f.estado); w.push(`c.estado = $${v.length}`); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM categorias c ${where}`, v)).rows[0].count);
  const { rows } = await query(`${SEL} ${where} ORDER BY c.nombre LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows, total, p);
}

export async function obtener(id) {
  const { rows } = await query(`${SEL} WHERE c.id_categoria=$1`, [id]);
  if (!rows[0]) throw notFound('Categoría no encontrada.');
  return rows[0];
}

export async function crear(d) {
  const { rows } = await query('INSERT INTO categorias (nombre, descripcion) VALUES ($1,$2) RETURNING id_categoria', [d.nombre, d.descripcion]);
  return obtener(rows[0].id_categoria);
}

export async function editar(id, d) {
  const r = await query('UPDATE categorias SET nombre=$1, descripcion=$2, actualizado_en=now() WHERE id_categoria=$3', [d.nombre, d.descripcion, id]);
  if (!r.rowCount) throw notFound('Categoría no encontrada.');
  return obtener(id);
}

export async function cambiarEstado(id, estado) {
  if (!estado) {
    const { rows } = await query('SELECT count(*)::int AS n FROM productos WHERE id_categoria=$1 AND estado', [id]);
    if (rows[0].n > 0) throw conflict(`No se puede desactivar: tiene ${rows[0].n} producto(s) activo(s). Desactívalos o muévelos antes.`, 'CATEGORIA_CON_PRODUCTOS');
  }
  const r = await query('UPDATE categorias SET estado=$1, actualizado_en=now() WHERE id_categoria=$2', [estado, id]);
  if (!r.rowCount) throw notFound('Categoría no encontrada.');
  return obtener(id);
}

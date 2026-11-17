import { query } from '../config/db.js';
import { notFound } from '../utils/errors.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';

const enmascarar = (s) => (s ? `${'*'.repeat(Math.max(0, s.length - 3))}${s.slice(-3)}` : null);

/** El vendedor solo ve lo necesario para elegir al cliente en una venta: identificación enmascarada, sin contacto. */
function vista(c, usuario) {
  if (usuario.rol === 'administrador') return c;
  return { id_cliente: c.id_cliente, nombre: c.nombre, apellido: c.apellido, identificacion: enmascarar(c.identificacion), estado: c.estado };
}

export async function listar(f, usuario) {
  const p = paginar(f);
  const w = []; const v = [];
  if (f.q) { v.push(`%${f.q}%`); w.push(`(nombre ILIKE $${v.length} OR apellido ILIKE $${v.length} OR identificacion ILIKE $${v.length})`); }
  if (usuario.rol !== 'administrador') w.push('estado');
  else if (f.estado !== undefined) { v.push(f.estado); w.push(`estado = $${v.length}`); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM clientes ${where}`, v)).rows[0].count);
  const { rows } = await query(`SELECT * FROM clientes ${where} ORDER BY nombre, apellido LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows.map((r) => vista(r, usuario)), total, p);
}

export async function obtener(id, usuario) {
  const { rows } = await query('SELECT * FROM clientes WHERE id_cliente=$1', [id]);
  if (!rows[0]) throw notFound('Cliente no encontrado.');
  return vista(rows[0], usuario);
}

export async function crear(d, usuario) {
  const { rows } = await query(
    `INSERT INTO clientes (nombre, apellido, identificacion, telefono, correo, direccion) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [d.nombre, d.apellido, d.identificacion, d.telefono, d.correo, d.direccion]);
  return vista(rows[0], usuario);
}

export async function editar(id, d, usuario) {
  const { rows } = await query(
    `UPDATE clientes SET nombre=$1, apellido=$2, identificacion=$3, telefono=$4, correo=$5, direccion=$6, actualizado_en=now() WHERE id_cliente=$7 RETURNING *`,
    [d.nombre, d.apellido, d.identificacion, d.telefono, d.correo, d.direccion, id]);
  if (!rows[0]) throw notFound('Cliente no encontrado.');
  return vista(rows[0], usuario);
}

export async function cambiarEstado(id, estado, usuario) {
  const { rows } = await query('UPDATE clientes SET estado=$1, actualizado_en=now() WHERE id_cliente=$2 RETURNING *', [estado, id]);
  if (!rows[0]) throw notFound('Cliente no encontrado.');
  return vista(rows[0], usuario);
}

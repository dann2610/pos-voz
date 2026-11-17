import bcrypt from 'bcrypt';
import { query, tx } from '../config/db.js';
import { env } from '../config/env.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';

const COLS = `u.id_usuario, u.nombre, u.apellido, u.correo, u.estado, u.id_rol, r.nombre AS rol, u.fecha_registro`;

export async function listarRoles() {
  return (await query('SELECT id_rol, nombre, descripcion FROM roles ORDER BY id_rol')).rows;
}

export async function listar(f) {
  const p = paginar(f);
  const w = []; const v = [];
  if (f.q) { v.push(`%${f.q}%`); w.push(`(u.nombre ILIKE $${v.length} OR u.apellido ILIKE $${v.length} OR u.correo ILIKE $${v.length})`); }
  if (f.id_rol) { v.push(f.id_rol); w.push(`u.id_rol = $${v.length}`); }
  if (f.estado !== undefined) { v.push(f.estado); w.push(`u.estado = $${v.length}`); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM usuarios u ${where}`, v)).rows[0].count);
  const { rows } = await query(
    `SELECT ${COLS} FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol ${where} ORDER BY u.nombre, u.apellido LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows, total, p);
}

export async function obtener(id) {
  const { rows } = await query(`SELECT ${COLS} FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1`, [id]);
  if (!rows[0]) throw notFound('Usuario no encontrado.');
  return rows[0];
}

async function validarRol(id_rol, c = { query }) {
  const { rows } = await c.query('SELECT nombre FROM roles WHERE id_rol=$1', [id_rol]);
  if (!rows[0]) throw badRequest('El rol indicado no existe.');
  return rows[0].nombre;
}

/** Garantiza que siempre quede al menos un administrador activo. */
async function adminsActivosExcepto(c, idUsuario) {
  const { rows } = await c.query(
    `SELECT count(*)::int AS n FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol
      WHERE r.nombre='administrador' AND u.estado AND u.id_usuario <> $1`, [idUsuario]);
  return rows[0].n;
}

export async function crear(d) {
  await validarRol(d.id_rol);
  const hash = await bcrypt.hash(d.contrasena, env.bcryptRounds);
  const { rows } = await query(
    `INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_rol) VALUES ($1,$2,$3,$4,$5) RETURNING id_usuario`,
    [d.nombre, d.apellido, d.correo, hash, d.id_rol]);
  return obtener(rows[0].id_usuario);
}

export async function editar(id, d, actor) {
  return tx(async (c) => {
    const { rows } = await c.query('SELECT u.id_usuario, u.estado, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1 FOR UPDATE OF u', [id]);
    if (!rows[0]) throw notFound('Usuario no encontrado.');
    const nuevoRol = await validarRol(d.id_rol, c);
    if (rows[0].rol === 'administrador' && nuevoRol !== 'administrador' && rows[0].estado && (await adminsActivosExcepto(c, id)) === 0) {
      throw conflict('No puedes quitar el rol al último administrador activo.', 'ULTIMO_ADMIN');
    }
    if (actor.id_usuario === id && nuevoRol !== actor.rol) throw conflict('No puedes cambiar tu propio rol.', 'AUTO_ROL');
    const sets = ['nombre=$1', 'apellido=$2', 'correo=$3', 'id_rol=$4', 'actualizado_en=now()'];
    const v = [d.nombre, d.apellido, d.correo, d.id_rol];
    if (d.contrasena) { v.push(await bcrypt.hash(d.contrasena, env.bcryptRounds)); sets.push(`contrasena=$${v.length}`); }
    v.push(id);
    await c.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id_usuario=$${v.length}`, v);
    return obtener(id);
  });
}

export async function cambiarEstado(id, estado, actor) {
  return tx(async (c) => {
    const { rows } = await c.query('SELECT u.id_usuario, u.estado, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1 FOR UPDATE OF u', [id]);
    if (!rows[0]) throw notFound('Usuario no encontrado.');
    if (!estado) {
      if (actor.id_usuario === id) throw conflict('No puedes desactivar tu propia cuenta.', 'AUTO_DESACTIVAR');
      if (rows[0].rol === 'administrador' && rows[0].estado && (await adminsActivosExcepto(c, id)) === 0) {
        throw conflict('No puedes desactivar al último administrador activo.', 'ULTIMO_ADMIN');
      }
    }
    await c.query('UPDATE usuarios SET estado=$1, actualizado_en=now() WHERE id_usuario=$2', [estado, id]);
    return obtener(id);
  });
}

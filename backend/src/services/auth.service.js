import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { firmarToken } from '../middleware/auth.js';
import { unauthorized, badRequest, notFound } from '../utils/errors.js';

// Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe.
const HASH_FALSO = bcrypt.hashSync('no-existe-este-usuario', 4);

const publico = (u) => ({ id_usuario: u.id_usuario, nombre: u.nombre, apellido: u.apellido, correo: u.correo, rol: u.rol });

export async function login({ correo, contrasena }) {
  const { rows } = await query(
    `SELECT u.*, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE lower(u.correo) = lower($1)`,
    [correo],
  );
  const u = rows[0];
  const ok = await bcrypt.compare(contrasena, u ? u.contrasena : HASH_FALSO);
  if (!u || !ok) throw unauthorized('Correo o contraseña incorrectos.', 'CREDENCIALES');
  if (!u.estado) throw unauthorized('Tu cuenta está desactivada. Contacta al administrador.', 'CUENTA_INACTIVA');
  return { token: firmarToken(u), usuario: publico(u) };
}

export async function actualizarPerfil(id, { nombre, apellido }) {
  const { rows } = await query(
    `UPDATE usuarios SET nombre=$1, apellido=$2, actualizado_en=now() WHERE id_usuario=$3 RETURNING id_usuario`, [nombre, apellido, id]);
  if (!rows[0]) throw notFound('Usuario no encontrado.');
  return obtenerPerfil(id);
}

export async function obtenerPerfil(id) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol WHERE u.id_usuario=$1`, [id]);
  return rows[0];
}

export async function cambiarContrasena(id, { actual, nueva }) {
  const { rows } = await query('SELECT contrasena FROM usuarios WHERE id_usuario=$1', [id]);
  if (!rows[0] || !(await bcrypt.compare(actual, rows[0].contrasena))) throw badRequest('La contraseña actual no es correcta.');
  if (actual === nueva) throw badRequest('La nueva contraseña debe ser distinta de la actual.');
  const hash = await bcrypt.hash(nueva, env.bcryptRounds);
  await query('UPDATE usuarios SET contrasena=$1, actualizado_en=now() WHERE id_usuario=$2', [hash, id]);
  return { ok: true };
}

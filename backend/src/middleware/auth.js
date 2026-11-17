import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { unauthorized, forbidden } from '../utils/errors.js';
import { asyncHandler } from '../utils/errors.js';

export const firmarToken = (u) =>
  jwt.sign({ rol: u.rol }, env.jwtSecret, { subject: String(u.id_usuario), expiresIn: env.jwtExpiresIn });

/** Verifica el JWT y recarga al usuario: un usuario desactivado pierde el acceso de inmediato. */
export const autenticar = asyncHandler(async (req, _res, next) => {
  const h = req.headers.authorization || '';
  const [tipo, token] = h.split(' ');
  if (tipo !== 'Bearer' || !token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (e) {
    if (e.name === 'TokenExpiredError') throw unauthorized('Tu sesión expiró. Inicia sesión de nuevo.', 'TOKEN_EXPIRADO');
    throw unauthorized('Sesión no válida. Inicia sesión de nuevo.', 'TOKEN_INVALIDO');
  }
  const { rows } = await query(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol WHERE u.id_usuario = $1`,
    [Number(payload.sub)],
  );
  const u = rows[0];
  if (!u || !u.estado) throw unauthorized('Tu cuenta está desactivada o no existe.', 'CUENTA_INACTIVA');
  req.usuario = u;
  next();
});

/** Autorización por rol: se valida siempre en el servidor. */
export const requiereRol = (...roles) => (req, _res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) return next(forbidden());
  next();
};
export const soloAdmin = requiereRol('administrador');
export const adminOVendedor = requiereRol('administrador', 'vendedor');

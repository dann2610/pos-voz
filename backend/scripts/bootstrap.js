// Arranque seguro para hosting (Render, etc.). Se ejecuta en cada inicio y es idempotente:
//  1) Si la BD está vacía, crea el esquema y carga el catálogo demo (NO borra nada si ya existe).
//  2) Garantiza que existan el administrador y el vendedor definidos en las variables de entorno:
//       ADMIN_EMAIL / ADMIN_PASSWORD      VENDEDOR_EMAIL / VENDEDOR_PASSWORD
//     Si el usuario ya existe no se toca (salvo RESET_PASSWORDS=true, que vuelve a poner la contraseña del entorno).
// Uso: npm run start:render   (bootstrap + servidor)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database');
const sql = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

const usuarios = [
  { correo: process.env.ADMIN_EMAIL, clave: process.env.ADMIN_PASSWORD, nombre: 'Administrador', apellido: 'Principal', rol: 'administrador' },
  { correo: process.env.VENDEDOR_EMAIL, clave: process.env.VENDEDOR_PASSWORD, nombre: 'Vendedor', apellido: 'Principal', rol: 'vendedor' },
];
const reset = process.env.RESET_PASSWORDS === 'true';

const c = await pool.connect();
try {
  const { rows } = await c.query("SELECT to_regclass('public.usuarios') AS t");
  const nueva = !rows[0].t;
  if (nueva) {
    console.log('[bootstrap] BD vacía: creando esquema y datos demo…');
    await c.query(sql('schema.sql'));
    await c.query(sql('seed.sql'));
  } else {
    console.log('[bootstrap] La BD ya existe: no se modifica el esquema ni los datos.');
  }

  for (const u of usuarios) {
    if (!u.correo || !u.clave) { console.warn(`[bootstrap] Falta correo/contraseña para el ${u.rol}; se omite.`); continue; }
    if (u.clave.length < 8) throw new Error(`La contraseña del ${u.rol} debe tener al menos 8 caracteres.`);
    const hash = await bcrypt.hash(u.clave, env.bcryptRounds);
    const existe = await c.query('SELECT id_usuario FROM usuarios WHERE lower(correo) = lower($1)', [u.correo]);
    if (existe.rowCount === 0) {
      await c.query(
        `INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_rol)
         SELECT $1, $2, $3, $4, id_rol FROM roles WHERE nombre = $5`,
        [u.nombre, u.apellido, u.correo.trim(), hash, u.rol],
      );
      console.log(`[bootstrap] Usuario ${u.rol} creado: ${u.correo}`);
    } else if (reset) {
      await c.query('UPDATE usuarios SET contrasena = $1, estado = TRUE, actualizado_en = now() WHERE id_usuario = $2', [hash, existe.rows[0].id_usuario]);
      console.log(`[bootstrap] Contraseña restablecida para ${u.correo}`);
    }
  }

  if (nueva && usuarios[0].correo) {
    await c.query(
      `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_resultante, motivo, id_usuario)
       SELECT p.id_producto, 'entrada', p.stock, p.stock, 'Stock inicial (demo)',
              (SELECT id_usuario FROM usuarios WHERE lower(correo) = lower($1))
         FROM productos p WHERE p.stock > 0`,
      [usuarios[0].correo],
    );
  }
  console.log('[bootstrap] Listo.');
} finally {
  c.release();
  await pool.end();
}

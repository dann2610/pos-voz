// Crea el esquema y, con --demo, carga datos de demostración y usuarios demo.
// Uso: npm run db:init            (solo esquema + roles + configuración mínima)
//      npm run db:init:demo       (además: catálogo, clientes y usuarios demo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'database');
const demo = process.argv.includes('--demo');

const cliente = await pool.connect();
try {
  await cliente.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
  console.log('Esquema creado.');
  if (demo) {
    await cliente.query(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
    const pa = process.env.DEMO_ADMIN_PASSWORD;
    const pv = process.env.DEMO_VENDEDOR_PASSWORD;
    if (!pa || !pv) throw new Error('Define DEMO_ADMIN_PASSWORD y DEMO_VENDEDOR_PASSWORD en .env para crear los usuarios demo.');
    const ha = await bcrypt.hash(pa, env.bcryptRounds);
    const hv = await bcrypt.hash(pv, env.bcryptRounds);
    await cliente.query(
      `INSERT INTO usuarios (nombre, apellido, correo, contrasena, id_rol)
       SELECT 'Admin', 'Demo', 'admin@demo.com', $1, id_rol FROM roles WHERE nombre='administrador'
       UNION ALL SELECT 'Vendedor', 'Demo', 'vendedor@demo.com', $2, id_rol FROM roles WHERE nombre='vendedor'`,
      [ha, hv],
    );
    await cliente.query(
      `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_resultante, motivo, id_usuario)
       SELECT p.id_producto, 'entrada', p.stock, p.stock, 'Stock inicial (demo)', (SELECT id_usuario FROM usuarios WHERE correo='admin@demo.com')
         FROM productos p WHERE p.stock > 0`,
    );
    console.log('Datos demo cargados. Usuarios: admin@demo.com y vendedor@demo.com (contraseñas definidas en .env).');
  }
} finally {
  cliente.release();
  await pool.end();
}

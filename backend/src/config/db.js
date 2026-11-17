import pg from 'pg';
import { env } from './env.js';

// NUMERIC se devuelve como cadena para no perder precisión; los servicios lo convierten.
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/** Ejecuta fn(client) dentro de una transacción; confirma o revierte. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignorar */ }
    throw err;
  } finally {
    client.release();
  }
}

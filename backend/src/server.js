import { crearApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const app = crearApp();
const server = app.listen(env.port, '0.0.0.0', () => console.log(`API POS por voz escuchando en http://localhost:${env.port}/api`));

const cerrar = async () => { server.close(); await pool.end(); process.exit(0); };
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);

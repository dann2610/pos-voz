import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend');

/** Recrea la BD de pruebas con los datos demo. */
export function reiniciarBD() {
  const r = spawnSync(process.execPath, ['scripts/init-db.js', '--demo'], { cwd: backend, env: process.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`No se pudo reiniciar la BD de pruebas:\n${r.stdout}\n${r.stderr}`);
}

export async function levantar() {
  const { crearApp } = await import('../../backend/src/app.js');
  const server = crearApp().listen(0);
  await new Promise((ok) => server.once('listening', ok));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const { pool } = await import('../../backend/src/config/db.js');

  const http = async (metodo, ruta, { token, cuerpo, crudo } = {}) => {
    const t0 = performance.now();
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const ms = performance.now() - t0;
    const buf = Buffer.from(await res.arrayBuffer());
    const texto = buf.toString('utf8');
    let json = null; try { json = JSON.parse(texto); } catch { /* CSV u otro */ }
    return crudo ? { status: res.status, texto, buf, headers: res.headers, ms } : { status: res.status, json, ms };
  };
  const login = async (correo, contrasena) => {
    const r = await http('POST', '/auth/login', { cuerpo: { correo, contrasena } });
    return r.json?.token;
  };
  const sesion = async () => ({
    admin: await login('admin@demo.com', 'Admin12345'),
    vendedor: await login('vendedor@demo.com', 'Vende12345'),
  });
  // producto(token, nombre, descripcion?): varios productos comparten nombre con distinta presentación.
  const producto = async (token, nombre, desc) => {
    const r = await http('GET', `/productos?q=${encodeURIComponent(nombre)}&por_pagina=100`, { token });
    return r.json.datos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase() && (!desc || p.descripcion === desc));
  };
  const cerrar = async () => { await new Promise((ok) => server.close(ok)); await pool.end(); };
  return { http, login, sesion, producto, cerrar, pool };
}

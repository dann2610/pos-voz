import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { reiniciarBD, levantar } from './helpers.js';

let api; let t;
before(async () => { reiniciarBD(); api = await levantar(); t = await api.sesion(); });
after(() => api.cerrar());

test('login correcto devuelve token y usuario sin contraseña', async () => {
  const r = await api.http('POST', '/auth/login', { cuerpo: { correo: 'ADMIN@demo.com', contrasena: 'Admin12345' } });
  assert.equal(r.status, 200); assert.ok(r.json.token); assert.equal(r.json.usuario.rol, 'administrador');
  assert.equal(JSON.stringify(r.json).includes('contrasena'), false);
});
test('login incorrecto: mismo mensaje para correo inexistente y clave errónea', async () => {
  const a = await api.http('POST', '/auth/login', { cuerpo: { correo: 'admin@demo.com', contrasena: 'mala-clave-1' } });
  const b = await api.http('POST', '/auth/login', { cuerpo: { correo: 'nadie@demo.com', contrasena: 'mala-clave-1' } });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.equal(a.json.error.mensaje, b.json.error.mensaje);
});
test('login con datos inválidos -> 400', async () => {
  const r = await api.http('POST', '/auth/login', { cuerpo: { correo: 'no-es-correo' } });
  assert.equal(r.status, 400); assert.ok(r.json.error.detalles.length >= 1);
});
test('rutas protegidas exigen token válido', async () => {
  assert.equal((await api.http('GET', '/productos')).status, 401);
  assert.equal((await api.http('GET', '/productos', { token: 'abc.def.ghi' })).status, 401);
});
test('permisos por rol se validan en el servidor', async () => {
  for (const [m, ruta, cuerpo] of [
    ['GET', '/usuarios'], ['GET', '/reportes/ventas'], ['GET', '/inventario/movimientos'],
    ['POST', '/productos', { nombre: 'X', precio: 1, id_categoria: 1 }],
    ['POST', '/inventario/movimientos', { tipo_movimiento: 'entrada', id_producto: 1, cantidad: 1, motivo: 'x' }],
    ['PUT', '/configuracion', { nombre_negocio: 'x', tasa_impuesto: 0, umbral_similitud: 0.6, margen_ambiguedad: 0.08, minutos_caducidad: 5 }],
    ['POST', '/categorias', { nombre: 'Z' }],
  ]) {
    const r = await api.http(m, ruta, { token: t.vendedor, cuerpo });
    assert.equal(r.status, 403, `${m} ${ruta} debería ser 403 para vendedor`);
  }
  assert.equal((await api.http('GET', '/usuarios', { token: t.admin })).status, 200);
  assert.equal((await api.http('GET', '/productos', { token: t.vendedor })).status, 200);
});
test('un usuario desactivado pierde el acceso de inmediato aunque su token siga vigente', async () => {
  const u = await api.http('POST', '/usuarios', { token: t.admin, cuerpo: { nombre: 'Temp', apellido: 'Uno', correo: 'temp@demo.com', contrasena: 'Temporal123', id_rol: 2 } });
  assert.equal(u.status, 201);
  const tok = await api.login('temp@demo.com', 'Temporal123');
  assert.equal((await api.http('GET', '/productos', { token: tok })).status, 200);
  assert.equal((await api.http('PATCH', `/usuarios/${u.json.id_usuario}/estado`, { token: t.admin, cuerpo: { estado: false } })).status, 200);
  assert.equal((await api.http('GET', '/productos', { token: tok })).status, 401);
  assert.equal(await api.login('temp@demo.com', 'Temporal123'), undefined);
});
test('correo duplicado -> 409; contraseña débil -> 400', async () => {
  const dup = await api.http('POST', '/usuarios', { token: t.admin, cuerpo: { nombre: 'A', apellido: 'B', correo: 'Admin@Demo.com', contrasena: 'Clave12345', id_rol: 1 } });
  assert.equal(dup.status, 409);
  const debil = await api.http('POST', '/usuarios', { token: t.admin, cuerpo: { nombre: 'A', apellido: 'B', correo: 'x@y.com', contrasena: '1234', id_rol: 1 } });
  assert.equal(debil.status, 400);
});
test('el último administrador activo no puede desactivarse ni cambiar de rol; nadie se desactiva a sí mismo', async () => {
  const yo = (await api.http('GET', '/auth/me', { token: t.admin })).json.usuario;
  const r1 = await api.http('PATCH', `/usuarios/${yo.id_usuario}/estado`, { token: t.admin, cuerpo: { estado: false } });
  assert.equal(r1.status, 409);
  const r2 = await api.http('PUT', `/usuarios/${yo.id_usuario}`, { token: t.admin, cuerpo: { nombre: 'Admin', apellido: 'Demo', correo: 'admin@demo.com', id_rol: 2 } });
  assert.equal(r2.status, 409);
});
test('cambio de contraseña', async () => {
  const mal = await api.http('PUT', '/auth/contrasena', { token: t.vendedor, cuerpo: { actual: 'incorrecta1', nueva: 'NuevaClave123' } });
  assert.equal(mal.status, 400);
  const ok = await api.http('PUT', '/auth/contrasena', { token: t.vendedor, cuerpo: { actual: 'Vende12345', nueva: 'NuevaClave123' } });
  assert.equal(ok.status, 200);
  assert.ok(await api.login('vendedor@demo.com', 'NuevaClave123'));
  await api.http('PUT', '/auth/contrasena', { token: await api.login('vendedor@demo.com', 'NuevaClave123'), cuerpo: { actual: 'NuevaClave123', nueva: 'Vende12345' } });
});
test('errores no exponen trazas internas', async () => {
  const r = await api.http('GET', '/productos/abc', { token: t.admin });
  assert.equal(r.status, 400); assert.equal(JSON.stringify(r.json).includes('node_modules'), false);
  const nf = await api.http('GET', '/ruta-que-no-existe', { token: t.admin });
  assert.equal(nf.status, 404);
});

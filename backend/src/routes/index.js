import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { autenticar, soloAdmin, adminOVendedor } from '../middleware/auth.js';
import { validar as v } from '../middleware/validar.js';
import * as S from '../validators/schemas.js';
import * as auth from '../controllers/auth.controller.js';
import * as usu from '../controllers/usuarios.controller.js';
import * as cat from '../controllers/categorias.controller.js';
import * as pro from '../controllers/productos.controller.js';
import * as inv from '../controllers/inventario.controller.js';
import * as cli from '../controllers/clientes.controller.js';
import * as ven from '../controllers/ventas.controller.js';
import * as voz from '../controllers/voz.controller.js';
import * as rep from '../controllers/reportes.controller.js';
import { z } from 'zod';

const r = Router();
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: env.loginMaxAttempts, standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true,
  handler: (_req, res) => res.status(429).json({ error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.' } }),
});

r.get('/salud', (_req, res) => res.json({ ok: true }));

// Autenticación
r.post('/auth/login', limiteLogin, v(S.login), auth.login);
r.get('/auth/me', autenticar, auth.me);
r.put('/auth/perfil', autenticar, v(S.perfil), auth.perfil);
r.put('/auth/contrasena', autenticar, v(S.cambioContrasena), auth.contrasena);

// Todo lo demás exige sesión
r.use(autenticar);

// Usuarios y roles (solo administrador)
r.get('/roles', soloAdmin, usu.roles);
r.get('/usuarios', soloAdmin, v(S.usuarioFiltros, 'query'), usu.listar);
r.post('/usuarios', soloAdmin, v(S.usuarioCrear), usu.crear);
r.get('/usuarios/:id', soloAdmin, v(S.idParam, 'params'), usu.obtener);
r.put('/usuarios/:id', soloAdmin, v(S.idParam, 'params'), v(S.usuarioEditar), usu.editar);
r.patch('/usuarios/:id/estado', soloAdmin, v(S.idParam, 'params'), v(S.estadoSchema), usu.estado);

// Categorías: lectura para ambos roles, escritura solo administrador
r.get('/categorias', adminOVendedor, v(S.categoriaFiltros, 'query'), cat.listar);
r.get('/categorias/:id', adminOVendedor, v(S.idParam, 'params'), cat.obtener);
r.post('/categorias', soloAdmin, v(S.categoria), cat.crear);
r.put('/categorias/:id', soloAdmin, v(S.idParam, 'params'), v(S.categoria), cat.editar);
r.patch('/categorias/:id/estado', soloAdmin, v(S.idParam, 'params'), v(S.estadoSchema), cat.estado);

// Productos
r.get('/productos', adminOVendedor, v(S.productoFiltros, 'query'), pro.listar);
r.get('/productos/:id', adminOVendedor, v(S.idParam, 'params'), pro.obtener);
r.post('/productos', soloAdmin, v(S.productoCrear), pro.crear);
r.put('/productos/:id', soloAdmin, v(S.idParam, 'params'), v(S.productoEditar), pro.editar);
r.patch('/productos/:id/estado', soloAdmin, v(S.idParam, 'params'), v(S.estadoSchema), pro.estado);

// Inventario
r.get('/inventario/alertas', adminOVendedor, inv.alertas);
r.get('/inventario/movimientos', soloAdmin, v(S.movimientoFiltros, 'query'), inv.movimientos);
r.post('/inventario/movimientos', soloAdmin, v(S.movimiento), inv.movimiento);

// Clientes (vendedor: lista limitada y alta rápida; administrador: gestión completa)
r.get('/clientes', adminOVendedor, v(S.clienteFiltros, 'query'), cli.listar);
r.get('/clientes/:id', adminOVendedor, v(S.idParam, 'params'), cli.obtener);
r.post('/clientes', adminOVendedor, v(S.cliente), cli.crear);
r.put('/clientes/:id', soloAdmin, v(S.idParam, 'params'), v(S.cliente), cli.editar);
r.patch('/clientes/:id/estado', soloAdmin, v(S.idParam, 'params'), v(S.estadoSchema), cli.estado);

// Ventas: sin edición ni borrado
r.post('/ventas', adminOVendedor, v(S.ventaCrear), ven.crear);
r.get('/ventas', adminOVendedor, v(S.ventaFiltros, 'query'), ven.listar);
r.get('/ventas/:id', adminOVendedor, v(S.idParam, 'params'), ven.obtener);

// Voz
r.post('/voz/interpretar', adminOVendedor, v(S.vozInterpretar), voz.interpretar);
r.get('/voz/pedidos/:id', adminOVendedor, v(S.uuidParam, 'params'), voz.obtener);
r.post('/voz/pedidos/:id/confirmar', adminOVendedor, v(S.uuidParam, 'params'), v(S.vozConfirmar), voz.confirmar);
r.post('/voz/pedidos/:id/cancelar', adminOVendedor, v(S.uuidParam, 'params'), voz.cancelar);
r.post('/voz/pedidos/:id/resolver', adminOVendedor, v(S.uuidParam, 'params'), v(S.vozResolver), voz.resolver);
const paramItem = z.object({ id: z.string().uuid(), indice: z.coerce.number().int().min(0) });
r.patch('/voz/pedidos/:id/items/:indice', adminOVendedor, v(paramItem, 'params'), v(z.object({ cantidad: z.coerce.number().int().min(0).max(10000) })), voz.modificar);

// Dashboard (datos propios para el vendedor) y reportes (administrador)
r.get('/dashboard', adminOVendedor, rep.dashboard);
r.get('/reportes/ventas', soloAdmin, v(S.reporteFiltros, 'query'), rep.ventas);
r.get('/reportes/productos-top', soloAdmin, v(S.reporteFiltros, 'query'), rep.top);
r.get('/reportes/vendedores', soloAdmin, v(S.reporteFiltros, 'query'), rep.vendedores);
r.get('/reportes/metodos-pago', soloAdmin, v(S.reporteFiltros, 'query'), rep.pagos);
r.get('/reportes/inventario', soloAdmin, rep.inventario);
r.get('/reportes/inventario-detalle', soloAdmin, rep.inventarioDet);
r.get('/reportes/inventario.csv', soloAdmin, rep.inventarioCsv);
r.get('/reportes/voz', soloAdmin, v(S.reporteFiltros, 'query'), rep.voz);
r.get('/reportes/ventas.csv', soloAdmin, v(S.reporteFiltros, 'query'), rep.csv);

// Configuración: lectura para ambos (impuesto y nombre), escritura solo administrador
r.get('/configuracion', adminOVendedor, rep.verConfig);
r.put('/configuracion', soloAdmin, v(S.configuracion), rep.guardarConfig);

export default r;

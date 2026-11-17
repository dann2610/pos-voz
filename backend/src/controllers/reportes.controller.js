import * as s from '../services/reportes.service.js';
import * as cfg from '../services/configuracion.service.js';
export const dashboard = async (req, res) => res.json(await s.dashboard(req.usuario));
export const ventas = async (req, res) => res.json({ datos: await s.ventasPorPeriodo(req.datos.query) });
export const top = async (req, res) => res.json({ datos: await s.productosMasVendidos(req.datos.query) });
export const vendedores = async (req, res) => res.json({ datos: await s.ventasPorVendedor(req.datos.query) });
export const pagos = async (req, res) => res.json({ datos: await s.metodosPago(req.datos.query) });
export const inventario = async (_req, res) => res.json(await s.inventarioValorado());
export const inventarioDet = async (_req, res) => res.json({ datos: await s.inventarioDetalle() });
export const inventarioCsv = async (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inventario.csv"');
  res.send(await s.inventarioCsv());
};
export const voz = async (req, res) => res.json(await s.indicadoresVoz(req.datos.query));
export const csv = async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ventas.csv"');
  res.send(await s.ventasCsv(req.datos.query));
};
export const verConfig = async (_req, res) => res.json(await cfg.obtenerConfig());
export const guardarConfig = async (req, res) => res.json(await cfg.actualizarConfig(req.datos.body));

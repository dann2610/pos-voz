import * as s from '../services/inventario.service.js';
export const movimiento = async (req, res) => res.status(201).json(await s.registrarMovimiento(req.datos.body, req.usuario));
export const movimientos = async (req, res) => res.json(await s.listarMovimientos(req.datos.query));
export const alertas = async (_req, res) => res.json({ datos: await s.alertas() });

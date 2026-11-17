import * as s from '../services/ventas.service.js';
export const crear = async (req, res) => {
  const r = await s.crearVenta(req.usuario, req.datos.body, 'manual');
  res.status(r.repetida ? 200 : 201).json({ ...r.venta, repetida: r.repetida });
};
export const listar = async (req, res) => res.json(await s.listarVentas(req.datos.query, req.usuario));
export const obtener = async (req, res) => res.json(await s.obtenerVenta(req.datos.params.id, req.usuario));

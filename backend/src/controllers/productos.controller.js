import * as s from '../services/productos.service.js';
export const listar = async (req, res) => res.json(await s.listar(req.datos.query, req.usuario));
export const obtener = async (req, res) => res.json(await s.obtener(req.datos.params.id, req.usuario));
export const crear = async (req, res) => res.status(201).json(await s.crear(req.datos.body, req.usuario));
export const editar = async (req, res) => res.json(await s.editar(req.datos.params.id, req.datos.body));
export const estado = async (req, res) => res.json(await s.cambiarEstado(req.datos.params.id, req.datos.body.estado));

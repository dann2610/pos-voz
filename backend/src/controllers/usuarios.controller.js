import * as s from '../services/usuarios.service.js';
export const roles = async (_req, res) => res.json({ datos: await s.listarRoles() });
export const listar = async (req, res) => res.json(await s.listar(req.datos.query));
export const obtener = async (req, res) => res.json(await s.obtener(req.datos.params.id));
export const crear = async (req, res) => res.status(201).json(await s.crear(req.datos.body));
export const editar = async (req, res) => res.json(await s.editar(req.datos.params.id, req.datos.body, req.usuario));
export const estado = async (req, res) => res.json(await s.cambiarEstado(req.datos.params.id, req.datos.body.estado, req.usuario));

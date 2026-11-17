import * as s from '../services/voz.service.js';
export const interpretar = async (req, res) => res.json(await s.interpretarTexto(req.usuario, req.datos.body));
export const obtener = async (req, res) => res.json(await s.obtenerPedido(req.usuario, req.datos.params.id));
export const confirmar = async (req, res) => res.json(await s.confirmarPedido(req.usuario, req.datos.params.id, req.datos.body));
export const cancelar = async (req, res) => res.json(await s.cancelarPedido(req.usuario, req.datos.params.id));
export const resolver = async (req, res) => res.json(await s.resolverItem(req.usuario, req.datos.params.id, req.datos.body));
export const modificar = async (req, res) => res.json(await s.modificarItem(req.usuario, req.datos.params.id, req.datos.params.indice, req.datos.body));

import * as s from '../services/auth.service.js';
export const login = async (req, res) => res.json(await s.login(req.datos.body));
export const me = async (req, res) => res.json({ usuario: await s.obtenerPerfil(req.usuario.id_usuario) });
export const perfil = async (req, res) => res.json({ usuario: await s.actualizarPerfil(req.usuario.id_usuario, req.datos.body) });
export const contrasena = async (req, res) => res.json(await s.cambiarContrasena(req.usuario.id_usuario, req.datos.body));

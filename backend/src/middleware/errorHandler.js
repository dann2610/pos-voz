import { AppError } from '../utils/errors.js';

export const rutaNoEncontrada = (_req, res) =>
  res.status(404).json({ error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'La ruta solicitada no existe.' } });

// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { codigo: err.code, mensaje: err.message, detalles: err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido.' } });
  }
  if (err?.code === '23505') {
    return res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con esos datos.' } });
  }
  if (err?.code === '23503') {
    return res.status(409).json({ error: { codigo: 'REFERENCIA_INVALIDA', mensaje: 'El registro está relacionado con otros datos o la referencia no existe.' } });
  }
  if (err?.code === '23514') {
    return res.status(409).json({ error: { codigo: 'RESTRICCION', mensaje: 'Los datos no cumplen una regla de la base de datos (por ejemplo, stock negativo).' } });
  }
  // No se exponen trazas ni datos internos al usuario.
  console.error('[error]', err?.message);
  return res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } });
}

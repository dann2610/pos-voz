import { badRequest } from '../utils/errors.js';

/** validar(schema, 'body'|'query'|'params'). Deja los datos limpios en req.datos[fuente]. */
export const validar = (schema, fuente = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[fuente] ?? {});
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.') || fuente, mensaje: i.message }));
    return next(badRequest(`${detalles[0].campo}: ${detalles[0].mensaje}`, detalles));
  }
  req.datos = req.datos || {};
  req.datos[fuente] = r.data;
  next();
};

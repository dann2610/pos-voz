export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (msg, details) => new AppError(400, 'DATOS_INVALIDOS', msg, details);
export const unauthorized = (msg = 'Debes iniciar sesión.', code = 'NO_AUTENTICADO') => new AppError(401, code, msg);
export const forbidden = (msg = 'No tienes permiso para realizar esta acción.') => new AppError(403, 'SIN_PERMISO', msg);
export const notFound = (msg = 'No se encontró el recurso solicitado.') => new AppError(404, 'NO_ENCONTRADO', msg);
export const conflict = (msg, code = 'CONFLICTO', details) => new AppError(409, code, msg, details);

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

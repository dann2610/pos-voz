// Cliente HTTP único: el frontend nunca habla con la base de datos, solo con la API REST.
const BASE = import.meta.env.VITE_API_URL || '/api';
const CLAVE_TOKEN = 'pos_token';

export const guardarToken = (t) => { try { t ? localStorage.setItem(CLAVE_TOKEN, t) : localStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ } };
export const leerToken = () => { try { return localStorage.getItem(CLAVE_TOKEN); } catch { return null; } };

let alExpirar = () => {};
export const alSesionExpirada = (fn) => { alExpirar = fn; };

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, detalles) { super(mensaje); this.status = status; this.codigo = codigo; this.detalles = detalles; }
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function pedir(metodo, ruta, { cuerpo, params, blob } = {}) {
  const token = leerToken();
  let res;
  try {
    res = await fetch(`${BASE}${ruta}${qs(params)}`, {
      method: metodo,
      headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.');
  }
  if (blob && res.ok) return res.blob();
  let datos = null;
  try { datos = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const e = datos?.error;
    if (res.status === 401 && token && e?.codigo !== 'CREDENCIALES') alExpirar(e?.mensaje);
    throw new ErrorApi(res.status, e?.codigo || 'ERROR', e?.mensaje || 'Ocurrió un error inesperado.', e?.detalles);
  }
  return datos;
}

export const api = {
  get: (r, params) => pedir('GET', r, { params }),
  post: (r, cuerpo) => pedir('POST', r, { cuerpo: cuerpo ?? {} }),
  put: (r, cuerpo) => pedir('PUT', r, { cuerpo }),
  patch: (r, cuerpo) => pedir('PATCH', r, { cuerpo }),
  descargar: (r, params) => pedir('GET', r, { params, blob: true }),
};

export const dinero = (v) => `$${Number(v ?? 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ZONA = 'America/Guayaquil';
export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: ZONA, dateStyle: 'short', timeStyle: 'short' }) : '');
export const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
export const hace = (dias) => new Date(Date.now() - dias * 86400000).toLocaleDateString('en-CA', { timeZone: ZONA });
export const etiquetaDia = (iso) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };

/** Total de vista previa en el carrito (el total real lo calcula el servidor). */
export function totalesPrevios(items, tasa = 0) {
  const sub = items.reduce((a, i) => a + Math.round(Number(i.precio) * 100) * i.cantidad, 0);
  const imp = Math.round((sub * Number(tasa)) / 100);
  return { subtotal: sub / 100, impuesto: imp / 100, total: (sub + imp) / 100 };
}

export const nuevaClave = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

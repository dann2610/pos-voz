// Cálculo monetario en centavos (enteros) para evitar errores de coma flotante.
export const aCentavos = (valor) => Math.round(Number(valor) * 100);
export const deCentavos = (c) => (c / 100).toFixed(2);

/** items: [{ precio (string|number), cantidad }] ; tasa en porcentaje (p. ej. 15). */
export function calcularTotales(items, tasaImpuesto = 0) {
  const subtotalC = items.reduce((acc, it) => acc + aCentavos(it.precio) * it.cantidad, 0);
  const impuestoC = Math.round((subtotalC * Number(tasaImpuesto)) / 100);
  return {
    subtotal: deCentavos(subtotalC),
    impuesto: deCentavos(impuestoC),
    total: deCentavos(subtotalC + impuestoC),
    subtotalC,
    impuestoC,
    totalC: subtotalC + impuestoC,
  };
}

/** Texto hablado: 2.75 -> "2 dólares con 75 centavos". */
export function dineroHablado(valor) {
  const c = aCentavos(valor);
  const d = Math.floor(c / 100);
  const cs = c % 100;
  const dol = `${d} ${d === 1 ? 'dólar' : 'dólares'}`;
  return cs === 0 ? dol : `${dol} con ${cs} centavos`;
}

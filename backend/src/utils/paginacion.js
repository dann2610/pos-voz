export function paginar(query, maxPorPagina = 100) {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const porPagina = Math.min(maxPorPagina, Math.max(1, parseInt(query.por_pagina, 10) || 20));
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}
export const respuestaPaginada = (filas, total, { pagina, porPagina }) => ({
  datos: filas,
  paginacion: { pagina, por_pagina: porPagina, total, paginas: Math.max(1, Math.ceil(total / porPagina)) },
});

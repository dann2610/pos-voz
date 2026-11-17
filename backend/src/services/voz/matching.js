import { similitud } from './similitud.js';
import { tokensDeBusqueda } from './texto.js';

const TOKEN_OK = 0.8; // un token "coincide" si su similitud es al menos esta

/** Prepara el catálogo una sola vez por petición. */
export function indexarCatalogo(productos) {
  return productos.map((p) => {
    const tokens = tokensDeBusqueda(p.nombre);
    const desc = tokensDeBusqueda(p.descripcion || '');
    return { producto: p, tokens, desc, frase: tokens.join(' '), junta: tokens.join('') };
  });
}

const mejor = (t, lista) => lista.reduce((m, x) => Math.max(m, similitud(t, x)), 0);

/**
 * Puntaje 0..1 entre los tokens de la consulta y los de un producto. Función pura.
 * El nombre manda; las palabras que sobran y coinciden con la descripción ("500", "litro") solo desempatan
 * entre presentaciones del mismo producto, y no penalizan.
 */
export function puntuar(consulta, entrada) {
  if (!consulta.length || !entrada.tokens.length) return { score: 0, exacto: false };
  const enDescripcion = (t) => (entrada.desc || []).some((d) => d === t);
  const sobrantes = consulta.filter((t) => mejor(t, entrada.tokens) < TOKEN_OK && enDescripcion(t));
  const q = sobrantes.length && sobrantes.length < consulta.length ? consulta.filter((t) => !sobrantes.includes(t)) : consulta;
  const fraseQ = q.join(' ');
  const fullSim = Math.max(similitud(fraseQ, entrada.frase), similitud(q.join(''), entrada.junta));
  const tokenSim = q.reduce((a, t) => a + mejor(t, entrada.tokens), 0) / q.length;
  const cobertura = entrada.tokens.filter((t) => mejor(t, q) >= TOKEN_OK).length / entrada.tokens.length;
  let score = 0.5 * fullSim + 0.3 * tokenSim + 0.2 * cobertura;
  // Contención: si todo lo dicho está en el nombre ("arroz" en "Arroz Flor"), puntúa alto aunque falten palabras.
  const contenido = q.every((t) => mejor(t, entrada.tokens) >= TOKEN_OK);
  if (contenido) {
    const extra = Math.max(0, entrada.tokens.length - q.length);
    score = Math.max(score, 0.85 - 0.05 * extra);
  }
  const bonus = sobrantes.length && q !== consulta ? Math.min(0.12, 0.06 * sobrantes.length) : 0;
  return { score: Math.min(1, score + bonus), exacto: fullSim === 1 && (q === consulta || bonus > 0) };
}

/**
 * Busca la frase en el catálogo indexado.
 * Devuelve { estado: 'ok'|'ambiguo'|'no_encontrado', mejor?, opciones[], sugerencias[] }.
 * Nunca elige en silencio cuando hay empate: devuelve las opciones.
 */
export function buscarProducto(frase, indice, { umbral = 0.6, margen = 0.08 } = {}) {
  const q = tokensDeBusqueda(frase);
  if (!q.length) return { estado: 'no_encontrado', opciones: [], sugerencias: [] };
  const ranking = indice
    .map((e) => ({ producto: e.producto, ...puntuar(q, e) }))
    .sort((a, b) => b.score - a.score || a.producto.nombre.localeCompare(b.producto.nombre));
  const top = ranking[0];
  const forma = (r) => ({ producto: r.producto, score: Math.round(r.score * 100) / 100 });
  if (!top || top.score < umbral) {
    return { estado: 'no_encontrado', opciones: [], sugerencias: ranking.filter((r) => r.score >= umbral * 0.7).slice(0, 3).map(forma) };
  }
  const empatados = ranking.filter((r) => r.score >= umbral && top.score - r.score < margen);
  const exactosUnicos = top.exacto && ranking.filter((r) => r.exacto).length === 1;
  if (empatados.length > 1 && !exactosUnicos) {
    return { estado: 'ambiguo', opciones: empatados.slice(0, 5).map(forma), sugerencias: [] };
  }
  return { estado: 'ok', mejor: forma(top), opciones: [], sugerencias: [] };
}

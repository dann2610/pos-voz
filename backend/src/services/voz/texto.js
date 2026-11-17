// Normalización de texto para el reconocimiento de comandos y la búsqueda difusa.

/** minúsculas, sin tildes, sin signos; conserva la coma como separador. */
export function normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, ' , ')
    .replace(/[^a-z0-9, ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras que no identifican al producto (cortesía, verbos de venta, artículos). */
export const RUIDO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'por', 'favor', 'para', 'quiero', 'necesito',
  'dame', 'deme', 'ponme', 'pon', 'agrega', 'agregar', 'agregame', 'anade', 'anadir', 'suma', 'sumar', 'vende', 'vender',
  'vendeme', 'venta', 'cobra', 'cobrar', 'registra', 'registrar', 'me', 'mi', 'mis', 'al', 'otro', 'otra', 'pedido', 'orden',
  'unidad', 'unidades', 'hola', 'por', 'ademas', 'tambien',
]);

/** Separadores entre productos dentro de una misma frase. */
export const SEPARADORES = new Set(['y', 'e', 'mas', 'con', ',']);

/** Pliegue fonético: unifica grafías que suenan igual (coca/koka, vaso/baso, hielo/ielo...). */
export function fonetico(token) {
  return token
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/gu(?=[ei])/g, 'g')
    .replace(/c(?=[ei])/g, 's')
    .replace(/z/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/v/g, 'b')
    .replace(/h/g, '')
    .replace(/ll/g, 'y')
    .replace(/w/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

/** Singular simple: quita la "s" final de palabras largas (galletas -> galleta). */
export const singular = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

const NUM_A_DIGITO = { uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10', doce: '12', veinte: '20' };

/** Tokens de un nombre de producto o de una frase de búsqueda, listos para comparar. */
export function tokensDeBusqueda(s) {
  return normalizar(s)
    .split(' ')
    .filter((t) => t && t !== ',' && !RUIDO.has(t))
    .map((t) => NUM_A_DIGITO[t] ?? fonetico(singular(t)))
    .filter(Boolean);
}

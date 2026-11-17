// Cantidades habladas: "dos", "treinta y cinco", "12". Hasta 100.
const BASE = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};
const DECENAS = new Set(['treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'veinte']);
const UNIDADES_1_9 = new Set(['un', 'uno', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']);
// Si tras un número viene una unidad de medida, el número es parte del nombre del producto ("agua 500 ml").
export const UNIDADES_MEDIDA = new Set(['ml', 'l', 'lt', 'lts', 'litro', 'litros', 'kg', 'kilo', 'kilos', 'g', 'gr', 'gramo', 'gramos', 'oz', 'lb', 'libra', 'libras', 'cc', 'cm']);

/** Lee un número en tokens[i]. Devuelve { valor, consumidos } o null. */
export function leerNumero(tokens, i) {
  const t = tokens[i];
  if (t === undefined) return null;
  let valor; let consumidos = 1;
  if (/^\d{1,4}$/.test(t)) valor = Number(t);
  else if (t in BASE) {
    valor = BASE[t];
    // "treinta y cinco", "cuarenta y dos"
    if (DECENAS.has(t) && tokens[i + 1] === 'y' && UNIDADES_1_9.has(tokens[i + 2])) {
      valor += BASE[tokens[i + 2]]; consumidos = 3;
    }
  } else if (t === 'media' && tokens[i + 1] === 'docena') return { valor: 6, consumidos: 2 };
  else if (t === 'docena') return { valor: 12, consumidos: 1 };
  else return null;
  if (tokens[i + consumidos] === 'docenas' || tokens[i + consumidos] === 'docena') { valor *= 12; consumidos += 1; }
  if (UNIDADES_MEDIDA.has(tokens[i + consumidos])) return null;
  return { valor, consumidos };
}

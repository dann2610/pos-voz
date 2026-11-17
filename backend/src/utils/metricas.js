// Indicadores de evaluación del proyecto (funciones puras; los scripts de backend/scripts las usan).

const palabras = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Tasa de error de palabras: WER = (S + D + I) / N, con N = palabras de la referencia.
 * Alineación por distancia de edición a nivel de palabra, con recuento de sustituciones, eliminaciones e inserciones.
 */
export function wer(referencia, hipotesis) {
  const r = palabras(referencia); const h = palabras(hipotesis);
  const d = Array.from({ length: r.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = 0; i <= r.length; i++) d[i][0] = i;
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    }
  }
  let i = r.length; let j = h.length; let S = 0; let D = 0; let I = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) { if (r[i - 1] !== h[j - 1]) S++; i--; j--; }
    else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { D++; i--; }
    else { I++; j--; }
  }
  const N = r.length;
  return { S, D, I, N, wer: N === 0 ? (h.length === 0 ? 0 : 1) : (S + D + I) / N };
}

/** WER global del conjunto: suma de errores / suma de palabras de referencia (no el promedio de porcentajes). */
export function werGlobal(pares) {
  const t = pares.reduce((a, [ref, hip]) => { const x = wer(ref, hip); return { S: a.S + x.S, D: a.D + x.D, I: a.I + x.I, N: a.N + x.N }; }, { S: 0, D: 0, I: 0, N: 0 });
  return { ...t, wer: t.N === 0 ? null : (t.S + t.D + t.I) / t.N };
}

/** Puntaje SUS de un participante: 10 respuestas 1..5. Impares: r-1; pares: 5-r; suma × 2.5 (0..100). */
export function puntajeSUS(r) {
  if (!Array.isArray(r) || r.length !== 10 || r.some((x) => !Number.isInteger(x) || x < 1 || x > 5)) throw new Error('El SUS requiere 10 respuestas enteras entre 1 y 5.');
  return r.reduce((a, x, k) => a + (k % 2 === 0 ? x - 1 : 5 - x), 0) * 2.5;
}
export const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const interpretarSUS = (p) => (p >= 80.3 ? 'Excelente' : p >= 68 ? 'Bueno / por encima del promedio (≥ 68)' : p >= 51 ? 'Regular / por debajo del promedio' : 'Deficiente');

/** Tasa de interpretación: comandos interpretados correctamente / comandos emitidos. */
export const tasaInterpretacion = (correctos, total) => (total > 0 ? correctos / total : null);

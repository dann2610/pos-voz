// Calcula el WER de un CSV con columnas: referencia,reconocido  (una fila por comando dictado).
// Uso: node scripts/wer.js ../docs/plantillas/wer.csv
import fs from 'node:fs';
import { wer, werGlobal } from '../src/utils/metricas.js';

const ruta = process.argv[2];
if (!ruta) { console.error('Uso: node scripts/wer.js <archivo.csv>  (columnas: referencia,reconocido)'); process.exit(1); }
const filas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1)
  .map((l) => { const i = l.indexOf(','); return [l.slice(0, i).replace(/^"|"$/g, ''), l.slice(i + 1).replace(/^"|"$/g, '')]; });
if (!filas.length) { console.log('El archivo no tiene datos: WER pendiente de medir.'); process.exit(0); }
filas.forEach(([r, h], k) => { const x = wer(r, h); console.log(`#${k + 1} S=${x.S} D=${x.D} I=${x.I} N=${x.N} WER=${(x.wer * 100).toFixed(1)} %  | "${r}" -> "${h}"`); });
const g = werGlobal(filas);
console.log(`\nWER global = (S+D+I)/N = (${g.S}+${g.D}+${g.I})/${g.N} = ${(g.wer * 100).toFixed(2)} %  (${filas.length} comandos)`);

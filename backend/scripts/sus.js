// Calcula el SUS de un CSV con columnas: participante,p1..p10 (respuestas 1 a 5).
// Uso: node scripts/sus.js ../docs/plantillas/sus.csv
import fs from 'node:fs';
import { puntajeSUS, promedio, interpretarSUS } from '../src/utils/metricas.js';

const ruta = process.argv[2];
if (!ruta) { console.error('Uso: node scripts/sus.js <archivo.csv>  (columnas: participante,p1,...,p10)'); process.exit(1); }
const filas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1).map((l) => l.split(','));
if (!filas.length) { console.log('El archivo no tiene datos: SUS pendiente de medir.'); process.exit(0); }
const puntajes = filas.map((f) => { const p = puntajeSUS(f.slice(1, 11).map(Number)); console.log(`${f[0]}: ${p.toFixed(1)}`); return p; });
const m = promedio(puntajes);
console.log(`\nSUS promedio = ${m.toFixed(1)} (n = ${puntajes.length}) → ${interpretarSUS(m)}`);

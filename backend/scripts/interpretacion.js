// Tasa de interpretación: CSV con columnas comando,interpretado_correctamente (1 = sí, 0 = no).
import fs from 'node:fs';
import { tasaInterpretacion } from '../src/utils/metricas.js';

const ruta = process.argv[2];
if (!ruta) { console.error('Uso: node scripts/interpretacion.js <archivo.csv>'); process.exit(1); }
const filas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).slice(1);
if (!filas.length) { console.log('El archivo no tiene datos: tasa de interpretación pendiente de medir.'); process.exit(0); }
const ok = filas.filter((l) => l.trim().endsWith(',1')).length;
console.log(`Tasa de interpretación = ${ok}/${filas.length} = ${(tasaInterpretacion(ok, filas.length) * 100).toFixed(1)} %`);

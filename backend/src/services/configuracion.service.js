import { query } from '../config/db.js';

const num = (c) => ({
  ...c,
  tasa_impuesto: Number(c.tasa_impuesto),
  umbral_similitud: Number(c.umbral_similitud),
  margen_ambiguedad: Number(c.margen_ambiguedad),
});

export async function obtenerConfig(c = { query }) {
  const { rows } = await c.query('SELECT * FROM configuracion_negocio WHERE id = 1');
  return num(rows[0]);
}

export async function actualizarConfig(d) {
  const { rows } = await query(
    `UPDATE configuracion_negocio SET nombre_negocio=$1, tasa_impuesto=$2, umbral_similitud=$3,
       margen_ambiguedad=$4, minutos_caducidad=$5, actualizado_en=now() WHERE id=1 RETURNING *`,
    [d.nombre_negocio, d.tasa_impuesto, d.umbral_similitud, d.margen_ambiguedad, d.minutos_caducidad],
  );
  return num(rows[0]);
}

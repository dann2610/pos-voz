import { env } from '../config/env.js';

// La zona horaria viene de la configuración (no del usuario); se sanea antes de interpolarla en SQL.
export const TZ = env.timezone.replace(/[^A-Za-z_/+-]/g, '');
/** Inicio del día (en la zona del negocio) de una fecha AAAA-MM-DD enlazada como parámetro $n. */
export const inicioDia = (n) => `(($${n}::date)::timestamp AT TIME ZONE '${TZ}')`;
/** Inicio del día siguiente: sirve como límite superior exclusivo. */
export const finDia = (n) => `((($${n}::date + 1))::timestamp AT TIME ZONE '${TZ}')`;

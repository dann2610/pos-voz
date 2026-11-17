import 'dotenv/config';

const req = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Copia .env.example a .env y complétala.`);
  return v;
};

const jwtSecret = req('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres (usa una cadena larga y aleatoria).');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: req('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'America/Guayaquil',
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 10),
  serveFrontend: process.env.SERVE_FRONTEND === 'true',
  // Detrás de un proxy (Render, Railway, Nginx) para que el límite de intentos vea la IP real.
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  // true si la BD exige SSL (p. ej., URL externa de Render). La URL interna no lo necesita.
  databaseSsl: process.env.DATABASE_SSL === 'true',
};

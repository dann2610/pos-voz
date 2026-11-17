import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import rutas from './routes/index.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/errorHandler.js';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.use(helmet({ contentSecurityPolicy: env.serveFrontend ? undefined : false }));
  app.use(cors({ origin: env.corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', rutas);
  app.use('/api', rutaNoEncontrada);

  if (env.serveFrontend) {
    const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }
  app.use(manejarErrores);
  return app;
}
